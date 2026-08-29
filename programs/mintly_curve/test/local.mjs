/* Проверка кривой Solana на локальном валидаторе: запуск токена,
   покупка, продажа, состояние. Транзакции собирает тот же серверный
   модуль, что и приложение, — подписываем их локальным ключом вместо
   Phantom. */
import { Connection, Keypair, PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import fs from "node:fs";

const RPC = "http://127.0.0.1:8899";
const conn = new Connection(RPC, "confirmed");

const кошелёк = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(process.env.KEY, "utf8"))),
);

process.env.SOLANA_RPC = RPC;
process.env.SOLANA_CURVE_PROGRAM = process.env.PROGRAM;
process.env.SOLANA_FEE_ACCOUNT = process.env.FEE;
process.env.SOLANA_LIQUIDITY = process.env.FEE;

const модуль = await import("/home/user/Facet_MiniApp/api/solana-launch.js");
const handler = модуль.default;

function вызов(query, body) {
  return new Promise((resolve) => {
    const res = {
      _код: 200,
      status(c) { this._код = c; return this; },
      setHeader() {},
      json(j) { resolve({ код: this._код, тело: j }); },
      send(s) { resolve({ код: this._код, тело: s }); },
    };
    handler({ query, body, method: body ? "POST" : "GET", headers: { host: "localhost" } }, res);
  });
}

async function отправить(base64, доп = []) {
  const tx = Transaction.from(Buffer.from(base64, "base64"));
  tx.partialSign(кошелёк, ...доп);
  const подпись = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await conn.confirmTransaction(подпись, "confirmed");
  return подпись;
}

const баланс = () => conn.getBalance(кошелёк.publicKey);

// 1. Запуск
const запуск = await вызов({ action: "launch" }, {
  wallet: кошелёк.publicKey.toBase58(),
  name: "Проверочный",
  ticker: "TEST",
  buySol: 1,
});
if (запуск.код !== 200) { console.log("запуск не собрался:", запуск.тело); process.exit(1); }
console.log("собран запуск, токен", запуск.тело.mint);

const доSol = await баланс();
await отправить(запуск.тело.transaction);
console.log("токен создан, кривая заведена, стартовая покупка прошла");

const ata = getAssociatedTokenAddressSync(new PublicKey(запуск.тело.mint), кошелёк.publicKey);
const счёт = await getAccount(conn, ata);
const куплено = Number(счёт.amount) / 1e6;
console.log("на кошельке токенов:", куплено.toLocaleString("ru-RU"));
if (куплено <= 0) { console.log("ОШИБКА: токены не пришли"); process.exit(1); }

// 2. Состояние
const сост = await вызов({ action: "state", mint: запуск.тело.mint });
console.log("состояние:", сост.тело);

// 3. Ещё одна покупка — цена должна вырасти
const вторая = await вызов({ action: "trade" }, {
  wallet: кошелёк.publicKey.toBase58(),
  mint: запуск.тело.mint,
  sell: false,
  amount: 1,
  minOut: 0,
});
await отправить(вторая.тело.transaction);
const счёт2 = await getAccount(conn, ata);
const вторая_выдача = Number(счёт2.amount) / 1e6 - куплено;
console.log("вторая покупка на 1 SOL дала:", вторая_выдача.toLocaleString("ru-RU"));
if (!(вторая_выдача < куплено)) { console.log("ОШИБКА: цена не выросла"); process.exit(1); }

// 4. Продажа половины
const доПродажи = await баланс();
const продать = Math.floor(вторая_выдача / 2);
const продажа = await вызов({ action: "trade" }, {
  wallet: кошелёк.publicKey.toBase58(),
  mint: запуск.тело.mint,
  sell: true,
  amount: продать,
  minOut: 0,
});
await отправить(продажа.тело.transaction);
const послеПродажи = await баланс();
console.log("продано", продать.toLocaleString("ru-RU"), "токенов, вернулось",
  ((послеПродажи - доПродажи) / LAMPORTS_PER_SOL).toFixed(4), "SOL");
if (послеПродажи <= доПродажи) { console.log("ОШИБКА: монеты не вернулись"); process.exit(1); }

const итог = await вызов({ action: "state", mint: запуск.тело.mint });
console.log("итог:", итог.тело);
console.log("потрачено всего:", ((доSol - послеПродажи) / LAMPORTS_PER_SOL).toFixed(4), "SOL");
console.log("ВСЁ ПРОШЛО");
