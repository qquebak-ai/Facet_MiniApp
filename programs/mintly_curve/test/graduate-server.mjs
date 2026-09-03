/* Закрытие кривой тем же кодом, что и на сервере: собираем транзакцию
   через собратьЗакрытие, подписываем локальным ключом и проверяем, что
   ликвидность ушла получателю. */
import { Connection, Keypair, PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount, getMint } from "@solana/spl-token";
import fs from "node:fs";

const RPC = process.env.RPC || "http://127.0.0.1:8899";
const conn = new Connection(RPC, "confirmed");
const кошелёк = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.KEY, "utf8"))));

process.env.SOLANA_RPC = RPC;
process.env.SOLANA_CURVE_PROGRAM = process.env.PROGRAM;
process.env.SOLANA_FEE_ACCOUNT = process.env.FEE;
process.env.SOLANA_LIQUIDITY = process.env.LIQ || process.env.FEE;

const модуль = await import("/home/user/Facet_MiniApp/api/solana-launch.js");
const { проверитьТранзакцию } = await import("/home/user/Facet_MiniApp/api/_txguard.js");
const handler = модуль.default;

function вызов(query, body) {
  return new Promise((resolve) => {
    const res = {
      _код: 200, status(c) { this._код = c; return this; }, setHeader() {},
      json(j) { resolve({ код: this._код, тело: j }); }, send(s) { resolve({ код: this._код, тело: s }); },
    };
    handler({ query, body, method: body ? "POST" : "GET", headers: { host: "localhost" } }, res);
  });
}

async function отправить(base64) {
  const tx = Transaction.from(Buffer.from(base64, "base64"));
  tx.partialSign(кошелёк);
  const п = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await conn.confirmTransaction(п, "confirmed");
  return п;
}

const провал = (что) => { console.log("ОШИБКА:", что); process.exit(1); };

const запуск = await вызов({ action: "launch" }, {
  wallet: кошелёк.publicKey.toBase58(), name: "Серверное", ticker: "SRV", buySol: 86,
});
if (запуск.код !== 200) провал(JSON.stringify(запуск.тело));
await отправить(запуск.тело.transaction);
const mint = запуск.тело.mint;
console.log("токен:", mint);

const получатель = new PublicKey(process.env.LIQ || process.env.FEE);
const ata = getAssociatedTokenAddressSync(new PublicKey(mint), получатель);
const былоТокенов = await getAccount(conn, ata).then((с) => Number(с.amount)).catch(() => 0);
const былоSol = await conn.getBalance(получатель);

// Цену запоминаем до закрытия: после него резерв кривой уходит
// получателю, и её собственная цена возвращается к стартовой.
const доЗакрытия = await вызов({ action: "state", mint });
const ценаКривой = доЗакрытия.тело.ценаSol;

const закрытие = await модуль.собратьЗакрытие({ payer: кошелёк.publicKey.toBase58(), mint });

// Та же проверка, через которую проходит любая транзакция перед подписью.
await проверитьТранзакцию(закрытие.transaction, {
  владелец: кошелёк.publicKey.toBase58(),
  дело: "graduate",
  максПеревода: 0,
  кривая: process.env.PROGRAM,
});
console.log("разбор транзакции пройден");

await отправить(закрытие.transaction);

const сост = await вызов({ action: "state", mint });
if (!сост.тело.закрыта) провал("кривая не закрылась");
const сталоТокенов = await getAccount(conn, ata).then((с) => Number(с.amount));
const пришлоТокенов = (сталоТокенов - былоТокенов) / 1e6;
const пришлоSol = (await conn.getBalance(получатель) - былоSol) / LAMPORTS_PER_SOL;
console.log("получателю:", пришлоSol.toFixed(3), "SOL и", пришлоТокенов.toLocaleString("ru-RU"), "токенов");

// Цена в паре должна совпасть с последней ценой кривой — иначе листинг
// открывается разрывом, и первый же покупатель платит втридорога.
const ценаПула = пришлоSol / пришлоТокенов;
const расхождение = Math.abs(ценаПула - ценаКривой) / ценаКривой;
console.log("цена в паре:", ценаПула.toExponential(3), "· на кривой:", ценаКривой.toExponential(3),
  "· расхождение:", (расхождение * 100).toFixed(2), "%");
if (!(расхождение < 0.03)) провал("цена в паре разошлась с ценой кривой");

const данные = await getMint(conn, new PublicKey(mint));
if (данные.mintAuthority) провал("право выпуска не снято");
if (Number(данные.supply) / 1e6 !== 1_000_000_000) провал(`эмиссия не миллиард: ${Number(данные.supply) / 1e6}`);
console.log("эмиссия ровно миллиард, право выпуска снято");
console.log("ВСЁ ПРОШЛО");
