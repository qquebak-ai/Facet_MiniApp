/* Проверка закрытия кривой на локальном валидаторе.
 *
 * Что проверяем: набрав порог, кривая закрывается, собранные монеты
 * уходят получателю, непроданный остаток выпускается ему же под
 * ликвидность, право выпуска снимается навсегда, а торговать после
 * закрытия уже нельзя.
 *
 * Запуск (валидатор уже поднят и программа развёрнута):
 *   KEY=~/.config/solana/id.json PROGRAM=<Program Id> FEE=<адрес> \
 *     node programs/mintly_curve/test/graduate.mjs
 */
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync, getAccount, getMint,
  createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import fs from "node:fs";

const RPC = process.env.RPC || "http://127.0.0.1:8899";
const conn = new Connection(RPC, "confirmed");
const кошелёк = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.KEY, "utf8"))));

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

async function отправить(tx, доп = []) {
  const готовая = typeof tx === "string" ? Transaction.from(Buffer.from(tx, "base64")) : tx;
  if (!готовая.recentBlockhash) готовая.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  if (!готовая.feePayer) готовая.feePayer = кошелёк.publicKey;
  готовая.partialSign(кошелёк, ...доп);
  const подпись = await conn.sendRawTransaction(готовая.serialize(), { skipPreflight: false });
  await conn.confirmTransaction(подпись, "confirmed");
  return подпись;
}

const провал = (что) => { console.log("ОШИБКА:", что); process.exit(1); };

// 1. Запуск с покупкой, сразу закрывающей кривую: 86 SOL за вычетом
//    процента комиссии дают чуть больше порога в 85.
const запуск = await вызов({ action: "launch" }, {
  wallet: кошелёк.publicKey.toBase58(),
  name: "Порог", ticker: "GRAD", buySol: 86,
});
if (запуск.код !== 200) провал(`запуск не собрался: ${JSON.stringify(запуск.тело)}`);
await отправить(запуск.тело.transaction);
const mint = new PublicKey(запуск.тело.mint);
console.log("токен создан:", mint.toBase58());

const до = await вызов({ action: "state", mint: mint.toBase58() });
console.log("собрано:", до.тело.solСобрано, "из", до.тело.solЦель, "· продано:", Math.round(до.тело.продано).toLocaleString("ru-RU"));
if (!(до.тело.solСобрано >= до.тело.solЦель)) провал("порог не набран — тест не о том");
if (до.тело.закрыта) провал("кривая закрылась сама, до вызова");

// 2. Закрытие. Инструкция «3», счета: кривая, токен, получатель,
//    программа токенов и счёт под ликвидность.
const [curve] = PublicKey.findProgramAddressSync(
  [Buffer.from("curve"), mint.toBuffer()],
  new PublicKey(process.env.PROGRAM),
);
const получатель = new PublicKey(process.env.FEE);
const ataПолучателя = getAssociatedTokenAddressSync(mint, получатель);

const доSol = await conn.getBalance(получатель);
const tx = new Transaction()
  .add(createAssociatedTokenAccountIdempotentInstruction(кошелёк.publicKey, ataПолучателя, получатель, mint))
  .add(new TransactionInstruction({
    programId: new PublicKey(process.env.PROGRAM),
    keys: [
      { pubkey: curve, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: получатель, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ataПолучателя, isSigner: false, isWritable: true },
    ],
    data: Buffer.from([3]),
  }));
await отправить(tx);
console.log("кривая закрыта");

// 3. Что стало.
const после = await вызов({ action: "state", mint: mint.toBase58() });
if (!после.тело.закрыта) провал("состояние не помечено закрытым");

const сталоSol = await conn.getBalance(получатель);
const пришло = (сталоSol - доSol) / LAMPORTS_PER_SOL;
console.log("получателю пришло:", пришло.toFixed(3), "SOL");
if (!(пришло > 80)) провал("монеты не ушли получателю");

const счёт = await getAccount(conn, ataПолучателя);
const ликвидность = Number(счёт.amount) / 1e6;
console.log("под ликвидность выпущено:", ликвидность.toLocaleString("ru-RU"), "токенов");
if (!(ликвидность > 0)) провал("остаток под ликвидность не выпущен");

const данныеMint = await getMint(conn, mint);
if (данныеMint.mintAuthority) провал("право выпуска не снято");
console.log("право выпуска снято");

// 4. После закрытия торговать нельзя.
const попытка = await вызов({ action: "trade" }, {
  wallet: кошелёк.publicKey.toBase58(), mint: mint.toBase58(), sell: false, amount: 1, minOut: 0,
});
let отбито = попытка.код !== 200;
if (!отбито) {
  try { await отправить(попытка.тело.transaction); } catch { отбито = true; }
}
if (!отбито) провал("покупка прошла на закрытой кривой");
console.log("покупка на закрытой кривой отбита");

console.log("ВСЁ ПРОШЛО");
