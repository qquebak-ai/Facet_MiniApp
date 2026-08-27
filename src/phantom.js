/* Кошелёк Phantom из Telegram Mini App.
 *
 * Solana-кошелёк в мини-приложение не встраивается: TonConnect его не
 * знает, а расширения внутри Telegram нет. Остаётся способ, который
 * Phantom предлагает сам — переход по ссылке: приложение открывает
 * кошелёк, человек подтверждает там, кошелёк уходит на адрес возврата.
 *
 * Ответ шифруется: перед первым переходом здесь рождается пара ключей,
 * открытый уезжает в Phantom, общий секрет считается по его ответу.
 * Приватный ключ не покидает браузер, поэтому расшифровать сессию не
 * может ни сервер, ни кто-либо ещё, кто увидит ответ по дороге.
 *
 * Вернуться прямо в окно Telegram кошелёк не умеет, поэтому возврат
 * идёт на api/phantom.js: тот складывает ответ под ключом сессии, а
 * приложение — оно всё это время открыто — опрашивает его и забирает.
 */

import nacl from "tweetnacl";
import bs58 from "bs58";

const APP_URL = typeof window !== "undefined" ? window.location.origin : "";
const PHANTOM = "https://phantom.app/ul/v1";

// Где лежит сессия между открытиями приложения. Ключ подписи хранить
// негде и незачем — он одноразовый, но связь с кошельком переживает
// перезапуск, иначе человеку пришлось бы подключаться перед каждой
// сделкой.
const ХРАНИЛИЩЕ = "mintly.phantom.session";

function случайныйКлюч() {
  const b = new Uint8Array(16);
  (window.crypto || {}).getRandomValues?.(b);
  return bs58.encode(b).slice(0, 24);
}

function сохранить(сессия) {
  try { localStorage.setItem(ХРАНИЛИЩЕ, JSON.stringify(сессия)); } catch { /* приватный режим */ }
}

export function сохранённаяСессия() {
  try {
    const raw = localStorage.getItem(ХРАНИЛИЩЕ);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.wallet && s.session && s.secret ? s : null;
  } catch {
    return null;
  }
}

export function забыть() {
  try { localStorage.removeItem(ХРАНИЛИЩЕ); } catch { /* всё равно забудем в памяти */ }
}

/* Открыть кошелёк. В Telegram обычный переход по ссылке закрывает
   мини-приложение, а нам нужно, чтобы оно осталось открытым и дождалось
   ответа, — поэтому просим Telegram открыть ссылку снаружи. */
function открыть(url) {
  const wa = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
  if (wa && wa.openLink) wa.openLink(url, { try_instant_view: false });
  else window.open(url, "_blank", "noopener");
}

/* Ждём ответ кошелька. Опрос, а не подписка: между приложением и
   кошельком нет общего канала, единственная связь — запись, которую
   оставит адрес возврата. */
async function дождаться(id, { таймаут = 180000, шаг = 1500 } = {}) {
  const до = Date.now() + таймаут;
  while (Date.now() < до) {
    try {
      const res = await fetch(`/api/phantom?action=poll&id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.ready) return json.params || {};
      }
    } catch { /* сеть моргнула — просто попробуем ещё раз */ }
    await new Promise((r) => setTimeout(r, шаг));
  }
  return null;
}

function расшифровать(секрет, nonce, data) {
  const открытый = nacl.box.open.after(bs58.decode(data), bs58.decode(nonce), секрет);
  if (!открытый) throw new Error("не удалось расшифровать ответ кошелька");
  return JSON.parse(new TextDecoder().decode(открытый));
}

function зашифровать(секрет, полезное) {
  const nonce = nacl.randomBytes(24);
  const тело = nacl.box.after(new TextEncoder().encode(JSON.stringify(полезное)), nonce, секрет);
  return { nonce: bs58.encode(nonce), payload: bs58.encode(тело) };
}

/* Подключение. Возвращает адрес кошелька и запоминает связь, чтобы
   следующая сделка не требовала повторного подтверждения. */
export async function подключить() {
  const пара = nacl.box.keyPair();
  const id = случайныйКлюч();
  const url = `${PHANTOM}/connect?` + new URLSearchParams({
    app_url: APP_URL,
    dapp_encryption_public_key: bs58.encode(пара.publicKey),
    // Адрес возврата — чистый путь, без своих параметров: Phantom
    // дописывает ответ через «?», и на ссылке, где вопрос уже стоит,
    // получается мусор, который кошелёк отвергает целиком.
    redirect_link: `${APP_URL}/phantom/${id}`,
    cluster: "mainnet-beta",
  });

  открыть(url);
  const ответ = await дождаться(id);
  if (!ответ) throw new Error("кошелёк не ответил");
  if (ответ.errorCode || ответ.errorMessage) throw new Error(ответ.errorMessage || "кошелёк отказал");
  if (!ответ.phantom_encryption_public_key || !ответ.data || !ответ.nonce) {
    throw new Error("кошелёк ответил не тем");
  }

  const секрет = nacl.box.before(bs58.decode(ответ.phantom_encryption_public_key), пара.secretKey);
  const данные = расшифровать(секрет, ответ.nonce, ответ.data);
  const сессия = {
    wallet: данные.public_key,
    session: данные.session,
    // Общий секрет и свой открытый ключ нужны каждой следующей сделке:
    // без них Phantom не примет запрос на подпись.
    secret: bs58.encode(секрет),
    pub: bs58.encode(пара.publicKey),
  };
  сохранить(сессия);
  return сессия;
}

/* Подпись и отправка готовой транзакции. Транзакцию собирает сервер
   (api/solana.js) и отдаёт в base64 — Phantom ждёт base58, поэтому
   перекодируем по дороге. Возвращается подпись сделки в сети. */
export async function подписатьИОтправить(transactionBase64, сессия = сохранённаяСессия()) {
  if (!сессия) throw new Error("кошелёк не подключён");
  const секрет = bs58.decode(сессия.secret);
  const байты = Uint8Array.from(atob(transactionBase64), (c) => c.charCodeAt(0));

  const { nonce, payload } = зашифровать(секрет, {
    session: сессия.session,
    transaction: bs58.encode(байты),
  });

  const id = случайныйКлюч();
  const url = `${PHANTOM}/signAndSendTransaction?` + new URLSearchParams({
    dapp_encryption_public_key: сессия.pub,
    nonce,
    payload,
    redirect_link: `${APP_URL}/phantom/${id}`,
  });

  открыть(url);
  const ответ = await дождаться(id);
  if (!ответ) throw new Error("кошелёк не ответил");
  if (ответ.errorCode || ответ.errorMessage) throw new Error(ответ.errorMessage || "кошелёк отказал");
  if (!ответ.data || !ответ.nonce) throw new Error("кошелёк ответил не тем");

  const данные = расшифровать(секрет, ответ.nonce, ответ.data);
  return данные.signature;
}
