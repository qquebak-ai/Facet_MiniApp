/* Кошелёк человека глазами бота.
 *
 * Ключей бот не знает и знать не должен: всё, что ему нужно, — адрес,
 * чтобы показать баланс и собрать ссылку на сделку. Адрес берётся из
 * профиля (его записывает приложение при подключении кошелька) или
 * задаётся руками командой в личке.
 *
 * Подпись всегда происходит в самом кошельке: бот только складывает
 * ссылку, где уже проставлены адрес получателя, сумма и тело сообщения.
 */

import { Address, beginCell, toNano } from "@ton/core";
import { adminClient } from "./_support.js";

// Сеть задаётся одним переключателем на всё приложение (см.
// TON_TESTNET_NETWORK в src/App.tsx). Здесь по умолчанию тестовая —
// вернуть боевую можно переменной окружения TON_TESTNET=0.
// Боевая сеть по умолчанию. Тестовая включается явно: TON_TESTNET=1.
const TESTNET = process.env.TON_TESTNET === "1";
const TONAPI = TESTNET ? "https://testnet.tonapi.io" : "https://tonapi.io";

// Столько прикладывается к переводу жетонов при продаже и столько
// уходит вперёд, чтобы кошелёк кривой успел прислать ей уведомление.
// Числа обязаны совпадать с CURVE_SELL_VALUE и CURVE_SELL_FORWARD_TON.
const SELL_VALUE = toNano("0.2");
const SELL_FORWARD = toNano("0.08");
const SELL_OP = 0x53454c4c; // "SELL"
const JETTON_TRANSFER_OP = 0xf8a7ea5;

async function tonapi(path) {
  try {
    const res = await fetch(`${TONAPI}${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export function нормальныйАдрес(raw) {
  try {
    return Address.parse(String(raw).trim()).toString({ testOnly: TESTNET, bounceable: false });
  } catch (err) {
    return null;
  }
}

/* Привязанный кошелёк. Приложение пишет его в профиль при подключении,
   поэтому у того, кто уже торговал, ничего спрашивать не нужно. */
export async function кошелёкПоTelegram(telegramId) {
  const admin = adminClient();
  if (!admin || !telegramId) return null;
  const { data } = await admin
    .from("profiles")
    .select("id, nickname, wallet_address")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  return data || null;
}

export async function привязатьКошелёк(telegramId, адрес) {
  const admin = adminClient();
  if (!admin) return false;
  const { error } = await admin
    .from("profiles")
    .update({ wallet_address: адрес })
    .eq("telegram_id", telegramId);
  return !error;
}

/* Баланс TON. Отдаётся в нанотонах, поэтому делим здесь же — наружу
   уходит уже число, с которым можно работать. */
export async function балансTon(адрес) {
  const json = await tonapi(`/v2/accounts/${адрес}`);
  if (!json) return null;
  return Number(json.balance || 0) / 1e9;
}

/* Жетоны на кошельке. Берём только те, что с ненулевым остатком: список
   в чате должен помещаться в экран. */
export async function жетоны(адрес) {
  const json = await tonapi(`/v2/accounts/${адрес}/jettons?currencies=ton`);
  const ряд = (json && json.balances) || [];
  return ряд
    .map((b) => ({
      master: b.jetton && b.jetton.address ? нормальныйАдрес(b.jetton.address) : null,
      masterRaw: b.jetton && b.jetton.address,
      symbol: (b.jetton && b.jetton.symbol) || "?",
      name: (b.jetton && b.jetton.name) || "",
      decimals: Number((b.jetton && b.jetton.decimals) ?? 9),
      raw: BigInt(b.balance || 0),
      wallet: b.wallet_address && b.wallet_address.address ? b.wallet_address.address : null,
    }))
    .filter((j) => j.raw > 0n)
    .map((j) => ({ ...j, amount: Number(j.raw) / 10 ** j.decimals }));
}

/* Жетонный кошелёк владельца под конкретный токен. Считать его самим
   можно, но tonapi отдаёт готовый — и заодно говорит остаток, который
   всё равно нужен, чтобы не продать больше, чем есть. */
export async function жетонныйКошелёк(владелец, master) {
  const json = await tonapi(`/v2/accounts/${владелец}/jettons/${master}`);
  if (!json || !json.wallet_address) return null;
  return {
    wallet: нормальныйАдрес(json.wallet_address.address),
    raw: BigInt(json.balance || 0),
    decimals: Number((json.jetton && json.jetton.decimals) ?? 9),
  };
}

/* Ссылка на продажу: перевод жетонов кривой с пометкой «SELL».
 *
 * Защиту от проскальзывания не ставим — minTonOut нулевой. Посчитанная
 * в чате, к моменту подписи она устареет, а сорванная из-за этого
 * сделка выглядит поломкой. Кому нужна защита — продаёт в приложении.
 */
export function ссылкаПродажи({ jettonWallet, curve, owner, raw }) {
  if (!jettonWallet || !curve || !owner || !(raw > 0n)) return null;
  let тело;
  try {
    тело = beginCell()
      .storeUint(JETTON_TRANSFER_OP, 32)
      .storeUint(0, 64)
      .storeCoins(raw)
      .storeAddress(Address.parse(curve))
      .storeAddress(Address.parse(owner))
      .storeBit(false)
      .storeCoins(SELL_FORWARD)
      .storeBit(true)
      .storeRef(beginCell().storeBit(false).storeUint(SELL_OP, 32).storeCoins(0n).endCell())
      .endCell();
  } catch (err) {
    return null;
  }
  // Тот же приём, что и в покупке: base64url и bounceable-адрес, иначе
  // кошелёк шлёт перевод без тела и сделка отбивается.
  const boc = тело.toBoc().toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  let кудa;
  try { кудa = Address.parse(jettonWallet).toString({ bounceable: true }); } catch (err) { return null; }
  return `https://app.tonkeeper.com/transfer/${кудa}?amount=${SELL_VALUE.toString()}&bin=${boc}`;
}
