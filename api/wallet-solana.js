/* Внутренний кошелёк приложения (Solana).
 *
 * Зачем. Каждая сделка сейчас идёт через Phantom: собрали транзакцию,
 * человек ушёл в кошелёк, подтвердил, вернулся. Пока он ходит, цена на
 * кривой уезжает, а на быстром рынке сделка успевает устареть совсем.
 * Внутренний кошелёк убирает этот шаг: монеты лежат на адресе, которым
 * управляет приложение, и покупка уходит в сеть сразу после нажатия.
 *
 * Чем за это платят. Ключ от адреса хранится у нас — зашифрованным, но
 * хранится. Это кастодиальное хранение со всеми его последствиями:
 * взлом сервера означает потерю средств на внутренних кошельках, и
 * человеку об этом сказано прямо в интерфейсе. Поэтому внутренний
 * кошелёк — не замена своему, а быстрый карман: пополнил на сделку,
 * вывел остаток.
 *
 * Баланс нигде не хранится и не считается нами: он читается из сети по
 * адресу. Расходиться с действительностью ему просто негде.
 *
 * Переменные окружения:
 *   APP_WALLET_KEY — ключ шифрования (32 байта в base64 или hex).
 *                    Без него внутренний кошелёк выключен целиком.
 *   SOLANA_RPC, SOLANA_CURVE_PROGRAM, SOLANA_FEE_ACCOUNT — как обычно.
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const LAMPORTS = 1_000_000_000;

/* Ключ шифрования. Тридцать два байта: принимаем и base64, и hex —
   удобнее вставить то, что выдал генератор под рукой. */
function ключПлощадки() {
  const raw = (process.env.APP_WALLET_KEY || "").trim();
  if (!raw) return null;
  try {
    const b = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    return b.length === 32 ? b : null;
  } catch {
    return null;
  }
}

/* Шифрование ключа кошелька. AES-GCM: он и прячет, и подписывает —
   подменённую строку расшифровать не выйдет, а не просто получить мусор.
   Соль случайная на каждую запись, поэтому одинаковые ключи не дают
   одинаковый шифротекст. */
function зашифровать(данные, ключ) {
  const соль = crypto.randomBytes(12);
  const шифр = crypto.createCipheriv("aes-256-gcm", ключ, соль);
  const тело = Buffer.concat([шифр.update(данные), шифр.final()]);
  return Buffer.concat([соль, шифр.getAuthTag(), тело]).toString("base64");
}

function расшифровать(строка, ключ) {
  const b = Buffer.from(String(строка), "base64");
  const соль = b.subarray(0, 12);
  const метка = b.subarray(12, 28);
  const тело = b.subarray(28);
  const шифр = crypto.createDecipheriv("aes-256-gcm", ключ, соль);
  шифр.setAuthTag(метка);
  return Buffer.concat([шифр.update(тело), шифр.final()]);
}

let solana = null;
async function библиотеки() {
  if (!solana) {
    const [web3, spl] = await Promise.all([
      import("@solana/web3.js"),
      import("@solana/spl-token"),
    ]);
    solana = { ...web3, ...spl };
  }
  return solana;
}

function admin() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/* Кто спрашивает. Токен приходит от приложения, проверяет его сам
   Supabase — своей проверки подписи нам не надо. */
async function хозяин(req, db) {
  const заголовок = req.headers.authorization || "";
  const токен = заголовок.startsWith("Bearer ") ? заголовок.slice(7) : "";
  if (!токен) return null;
  const { data, error } = await db.auth.getUser(токен);
  if (error || !data || !data.user) return null;
  return data.user;
}

/* Кошелёк человека: берём существующий или заводим новый. Ключ
   рождается здесь и здесь же шифруется — в открытом виде он не покидает
   память обработчика. */
async function кошелёк(db, user, ключ) {
  const { data } = await db
    .from("app_wallets")
    .select("address, secret_enc")
    .eq("user_id", user.id)
    .maybeSingle();
  if (data) return data;

  const { Keypair } = await библиотеки();
  const пара = Keypair.generate();
  const строка = {
    user_id: user.id,
    chain: "solana",
    address: пара.publicKey.toBase58(),
    secret_enc: зашифровать(Buffer.from(пара.secretKey), ключ),
  };
  const { error } = await db.from("app_wallets").insert(строка);
  if (error) {
    // Уже завели параллельным запросом — читаем, что получилось.
    const { data: снова } = await db
      .from("app_wallets")
      .select("address, secret_enc")
      .eq("user_id", user.id)
      .maybeSingle();
    if (снова) return снова;
    throw new Error(error.message);
  }
  return строка;
}

async function пара(строка, ключ) {
  const { Keypair } = await библиотеки();
  return Keypair.fromSecretKey(new Uint8Array(расшифровать(строка.secret_enc, ключ)));
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "rpc");
  return json.result;
}

/* Сколько на кошельке. Спрашиваем сеть: свой учёт разошёлся бы с ней при
   первом же переводе мимо приложения. */
async function баланс(адрес) {
  const b = await rpc("getBalance", [адрес]).catch(() => null);
  return Number((b && b.value) || 0) / LAMPORTS;
}

/* Отправка готовой транзакции с подписью внутреннего кошелька. */
async function отправить(tx, ключи) {
  const { Transaction, VersionedTransaction } = await библиотеки();
  const байты = Buffer.from(tx, "base64");
  let сериализованная;
  try {
    const версионная = VersionedTransaction.deserialize(new Uint8Array(байты));
    версионная.sign([ключи]);
    сериализованная = Buffer.from(версионная.serialize()).toString("base64");
  } catch {
    const обычная = Transaction.from(байты);
    обычная.partialSign(ключи);
    сериализованная = обычная.serialize({ requireAllSignatures: false }).toString("base64");
  }
  return await rpc("sendTransaction", [
    сериализованная,
    { encoding: "base64", skipPreflight: false, preflightCommitment: "processed", maxRetries: 3 },
  ]);
}

/* Вывод: перевод всей суммы или её части на указанный адрес. Комиссия
   сети остаётся на кошельке, поэтому «всё» — это баланс минус небольшой
   запас: иначе перевод не пройдёт вовсе. */
const ЗАПАС_НА_КОМИССИЮ = 0.00002;

async function вывести({ ключи, куда, сумма }) {
  const { Connection, PublicKey, SystemProgram, Transaction } = await библиотеки();
  const connection = new Connection(RPC, "confirmed");
  const получатель = new PublicKey(куда);
  const лямпорты = Math.floor(сумма * LAMPORTS);
  if (лямпорты <= 0) throw new Error("сумма не задана");

  const tx = new Transaction().add(SystemProgram.transfer({
    fromPubkey: ключи.publicKey,
    toPubkey: получатель,
    lamports: лямпорты,
  }));
  tx.feePayer = ключи.publicKey;
  const { blockhash } = await connection.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;
  tx.sign(ключи);
  return await rpc("sendTransaction", [
    tx.serialize().toString("base64"),
    { encoding: "base64", skipPreflight: false, preflightCommitment: "processed", maxRetries: 3 },
  ]);
}

export default async function handler(req, res) {
  const db = admin();
  const ключ = ключПлощадки();
  const действие = String((req.query && req.query.action) || "");

  // Отдельным вопросом — включён ли внутренний кошелёк вообще: без
  // ключа площадки заводить его нечем, и приложение не должна его
  // показывать.
  if (действие === "enabled") {
    return res.status(200).json({ enabled: !!(db && ключ) });
  }
  if (!db || !ключ) return res.status(503).json({ error: "not_configured" });

  try {
    const user = await хозяин(req, db);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const строка = await кошелёк(db, user, ключ);

    if (действие === "state") {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ address: строка.address, sol: await баланс(строка.address) });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
    const тело = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    // Подпись и отправка транзакции, собранной другими обработчиками
    // (кривая площадки, Jupiter). Здесь мы только ставим подпись
    // внутреннего кошелька — собирать транзакции этот обработчик не
    // умеет и не должен.
    if (действие === "sign") {
      if (!тело.transaction) return res.status(400).json({ error: "bad_request" });
      const ключи = await пара(строка, ключ);
      const подпись = await отправить(тело.transaction, ключи);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ signature: подпись });
    }

    if (действие === "withdraw") {
      const куда = String(тело.to || "").trim();
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(куда)) return res.status(400).json({ error: "bad_address" });
      const есть = await баланс(строка.address);
      const сумма = тело.all ? Math.max(0, есть - ЗАПАС_НА_КОМИССИЮ) : Number(тело.amount) || 0;
      if (сумма <= 0 || сумма > есть) return res.status(400).json({ error: "bad_amount" });
      const ключи = await пара(строка, ключ);
      const подпись = await вывести({ ключи, куда, сумма });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ signature: подпись, amount: сумма });
    }

    return res.status(400).json({ error: "unknown_action" });
  } catch (err) {
    console.warn("[wallet-solana]", err && err.message);
    return res.status(502).json({ error: "failed", detail: String((err && err.message) || err).slice(0, 200) });
  }
}
