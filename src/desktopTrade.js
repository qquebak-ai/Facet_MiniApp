/* Сделки на сайте.
 *
 * Сайт сделан для торговли, а не для того, чтобы уводить человека в
 * Telegram: покупка и продажа заканчиваются здесь, в той же вкладке.
 * Ключей при этом ни у сайта, ни у сервера нет — подписывает кошелёк:
 *
 *   TON     — TonConnect. Тело сообщения для биржи собирает сервер
 *             (api/chart.js?what=swap), потому что для этого нужны
 *             маршрут Ston.fi и адрес жетонного кошелька;
 *   Solana  — расширение Phantom в браузере: сервер отдаёт собранную
 *             сделку Jupiter, расширение её подписывает, отправляем сами.
 *
 * Отдельный случай — кошелёк приложения (appWallet.js): там подпись
 * ставит служба на сервере, и сделка проходит вообще без кошелька.
 */

import { VersionedTransaction } from "@solana/web3.js";

const SOL = "So11111111111111111111111111111111111111112";

/* ---------- TON ---------- */

/* Готовая сделка для TonConnect: куда, сколько нанотонов и что сказать
   бирже. Собирает сервер — здесь только запрос и проверка ответа. */
export async function собратьСделкуTon({ жетон, кошелёк, сумма, продажа }) {
  const параметры = new URLSearchParams({
    what: "swap",
    network: "ton",
    jetton: жетон,
    wallet: кошелёк,
    amount: String(сумма),
    side: продажа ? "sell" : "buy",
  });
  const ответ = await fetch(`/api/chart?${параметры}`);
  if (ответ.status === 404) throw new Error("маршрут не найден: этот пул биржа не отдаёт");
  if (!ответ.ok) throw new Error("не удалось собрать сделку");
  const сделка = await ответ.json();
  if (!сделка || !сделка.to || !сделка.body) throw new Error("не удалось собрать сделку");
  return сделка;
}

export async function сделкаTon({ tonConnectUI, жетон, кошелёк, сумма, продажа }) {
  const сделка = await собратьСделкуTon({ жетон, кошелёк, сумма, продажа });
  await tonConnectUI.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 300,
    // Биржа живёт только в боевой сети: с кошельком на тестовой сделка
    // всё равно не пройдёт, и лучше отказ кошелька, чем потерянные
    // монеты в чужой цепочке.
    network: "-239",
    messages: [{ address: сделка.to, amount: сделка.value, payload: сделка.body }],
  });
  return сделка;
}

/* ---------- Solana через расширение ---------- */

export function расширениеPhantom() {
  const w = typeof window !== "undefined" ? window : null;
  const p = w && (w.phantom ? w.phantom.solana : w.solana);
  return p && p.isPhantom ? p : null;
}

export async function подключитьPhantom() {
  const p = расширениеPhantom();
  if (!p) throw new Error("Phantom не найден");
  const ответ = await p.connect();
  const адрес = (ответ && ответ.publicKey ? ответ.publicKey : p.publicKey);
  if (!адрес) throw new Error("кошелёк не ответил");
  return адрес.toString();
}

/* Обмен через Jupiter: маршрут и сборка — на сервере, подпись — в
   расширении, отправка — снова через сервер. Расширение отправлять в
   сеть само больше не умеет, да и свой узел надёжнее чужого. */
export async function сделкаSolana({ mint, кошелёк, сумма, продажа }) {
  const p = расширениеPhantom();
  if (!p) throw new Error("Phantom не найден");

  let десятичные = 6;
  let количество = Number(сумма);
  if (продажа) {
    const b = await fetch(`/api/solana?action=balances&wallet=${кошелёк}&mint=${mint}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    // Точность у каждого токена своя, и ошибка здесь — это ошибка в
    // тысячу раз по сумме: спрашиваем сеть, а не угадываем.
    if (b && b.decimals > 0) десятичные = b.decimals;
    if (b && b.token > 0 && количество > b.token) количество = b.token;
  }

  const вход = продажа ? mint : SOL;
  const выход = продажа ? SOL : mint;
  const единиц = продажа
    ? String(Math.round(количество * 10 ** десятичные))
    : String(Math.round(количество * 1e9));

  const параметры = new URLSearchParams({ input: вход, output: выход, amount: единиц, slippage: "150" });
  const кот = await fetch(`/api/solana?action=quote&${параметры}`).then((r) => r.json());
  if (!кот || кот.error || !кот.quote) throw new Error("маршрут не найден");

  const собранная = await fetch("/api/solana?action=swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quote: кот.quote, wallet: кошелёк }),
  }).then((r) => r.json());
  if (!собранная || собранная.error || !собранная.transaction) throw new Error("сделка не собралась");

  const байты = Uint8Array.from(atob(собранная.transaction), (c) => c.charCodeAt(0));
  const сделка = VersionedTransaction.deserialize(байты);
  const подписанная = await p.signTransaction(сделка);

  let двоичная = "";
  for (const b of подписанная.serialize()) двоичная += String.fromCharCode(b);

  const итог = await fetch("/api/solana?action=send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: btoa(двоичная) }),
  }).then((r) => r.json());
  if (!итог || итог.error) throw new Error("сеть не приняла сделку");
  return итог.signature;
}
