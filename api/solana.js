/* Торговля мемкоинами Solana.
 *
 * Зачем через сервер. Маршрут сделки и её сборку делает Jupiter —
 * агрегатор, который сам ищет лучший путь по всем биржам сети. Ходить
 * туда прямо из браузера мешают две вещи: у их API свои лимиты на
 * источник и своя политика CORS, а ключ площадки (счёт для комиссии)
 * в браузер отдавать нельзя вовсе. Поэтому приложение спрашивает
 * котировку и готовую транзакцию здесь, а подписывает её человек в
 * своём кошельке — приватных ключей мы по-прежнему не касаемся.
 *
 * Переменные окружения (все серверные, без префикса VITE_):
 *   SOLANA_FEE_ACCOUNT — счёт площадки для комиссии. Это не обычный
 *                        адрес кошелька, а referral-счёт Jupiter под
 *                        конкретный токен; без него комиссия просто не
 *                        берётся, всё остальное работает как обычно.
 *   SOLANA_FEE_BPS     — размер комиссии в сотых долях процента
 *                        (100 = 1%, как на своей кривой).
 *   SOLANA_RPC         — узел сети для баланса и отправки. Публичный
 *                        выдерживает единичные запросы, для нагрузки
 *                        нужен свой (Helius, QuickNode).
 */

const JUP = "https://lite-api.jup.ag/swap/v1";
const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const FEE_ACCOUNT = (process.env.SOLANA_FEE_ACCOUNT || "").trim();
const FEE_BPS = Number(process.env.SOLANA_FEE_BPS || 100);

// Обёрнутый SOL: в маршрутах Jupiter обычная монета участвует именно в
// этом виде, разворачивать её обратно он умеет сам.
export const SOL_MINT = "So11111111111111111111111111111111111111112";

// Адрес в Solana — base58 длиной 32–44 символа. Проверка грубая, но
// отсекает и пустое, и чужой формат: дальше строка уходит в чужой API,
// и лучше отбить её здесь, чем ловить невнятный отказ оттуда.
const адресОк = (s) => typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

async function jup(path, init) {
  const res = await fetch(`${JUP}${path}`, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* Jupiter иногда отвечает текстом */ }
  if (!res.ok) {
    const причина = (json && (json.error || json.message)) || text.slice(0, 200);
    throw new Error(`jupiter ${res.status}: ${причина}`);
  }
  return json;
}

/* Котировка: сколько токенов дадут за столько-то SOL (или наоборот).
   Комиссию площадки закладываем в сам маршрут — Jupiter удержит её при
   исполнении, отдельным переводом брать нечего. */
export async function котировка({ input, output, amount, slippageBps = 100 }) {
  if (!адресОк(input) || !адресОк(output)) return null;
  const сумма = BigInt(amount || 0);
  if (сумма <= 0n) return null;

  const параметры = new URLSearchParams({
    inputMint: input,
    outputMint: output,
    amount: сумма.toString(),
    slippageBps: String(slippageBps),
  });
  // Комиссия берётся только когда есть куда: без referral-счёта Jupiter
  // отказывается собирать сделку целиком, а сделка людям нужнее.
  if (FEE_ACCOUNT && FEE_BPS > 0) параметры.set("platformFeeBps", String(FEE_BPS));

  return await jup(`/quote?${параметры}`);
}

/* Готовая транзакция под конкретный кошелёк. Возвращается в base64 —
   приложение перекодирует её и отдаёт кошельку на подпись. */
export async function сделка({ quote, wallet }) {
  if (!quote || !адресОк(wallet)) return null;
  const тело = {
    quoteResponse: quote,
    userPublicKey: wallet,
    // Разворачивать обёрнутый SOL обратно — забота Jupiter: иначе после
    // продажи человек получил бы не монеты, а токен-обёртку и не понял,
    // куда делись деньги.
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
  };
  if (FEE_ACCOUNT && FEE_BPS > 0) тело.feeAccount = FEE_ACCOUNT;

  const json = await jup("/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(тело),
  });
  return json && json.swapTransaction ? json.swapTransaction : null;
}

/* Баланс кошелька: сколько SOL и сколько единиц конкретного токена.
   Оба вопроса — обычные вызовы узла сети, своей библиотеки не нужно. */
async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`rpc: ${json.error.message}`);
  return json.result;
}

export async function балансы({ wallet, mint }) {
  if (!адресОк(wallet)) return null;
  const итог = { sol: 0, token: 0, decimals: 0 };
  try {
    const b = await rpc("getBalance", [wallet]);
    итог.sol = Number((b && b.value) || 0) / 1e9;
  } catch { /* узел не ответил — покажем нули, это лучше пустого экрана */ }

  if (адресОк(mint)) {
    try {
      const r = await rpc("getTokenAccountsByOwner", [
        wallet,
        { mint },
        { encoding: "jsonParsed" },
      ]);
      const счета = (r && r.value) || [];
      for (const счёт of счета) {
        const сумма = счёт?.account?.data?.parsed?.info?.tokenAmount;
        if (!сумма) continue;
        итог.token += Number(сумма.uiAmount) || 0;
        итог.decimals = Number(сумма.decimals) || итог.decimals;
      }
    } catch { /* токенового счёта может не быть вовсе — это ноль */ }
  }
  return итог;
}

export default async function handler(req, res) {
  const действие = String((req.query && req.query.action) || "");
  try {
    if (действие === "quote") {
      const q = await котировка({
        input: req.query.input,
        output: req.query.output,
        amount: req.query.amount,
        slippageBps: Number(req.query.slippage) || 100,
      });
      if (!q) return res.status(400).json({ error: "bad_request" });
      // Котировка живёт секунды: кешировать её — значит показывать цену,
      // по которой сделка уже не пройдёт.
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        input: q.inputMint,
        output: q.outputMint,
        inAmount: q.inAmount,
        outAmount: q.outAmount,
        minOut: q.otherAmountThreshold,
        impactPct: Number(q.priceImpactPct) || 0,
        feeBps: FEE_ACCOUNT ? FEE_BPS : 0,
        // Сырой ответ нужен для сборки сделки: Jupiter принимает обратно
        // ровно его, без изменений.
        quote: q,
      });
    }

    if (действие === "balances") {
      const b = await балансы({ wallet: req.query.wallet, mint: req.query.mint });
      if (!b) return res.status(400).json({ error: "bad_request" });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(b);
    }

    if (действие === "swap") {
      if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
      const тело = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const tx = await сделка({ quote: тело.quote, wallet: тело.wallet });
      if (!tx) return res.status(400).json({ error: "bad_request" });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ transaction: tx });
    }

    return res.status(400).json({ error: "unknown_action" });
  } catch (err) {
    console.warn("[solana]", err && err.message);
    return res.status(502).json({ error: "upstream_failed", detail: String((err && err.message) || err).slice(0, 200) });
  }
}
