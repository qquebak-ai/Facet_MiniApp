/* Обход кривых для витрины: считает всё разом и складывает в базу.
 *
 * До этого рыночные числа выяснял каждый телефон сам: состояние кривой,
 * её транзакции и метаданные жетона — три запроса к tonapi на токен,
 * строго по очереди, потому что ключ пускает примерно один запрос в
 * секунду. Лента из десятка токенов набиралась секунд десять, и это при
 * том, что у всех она одинаковая.
 *
 * Теперь цепочку обходит сервер: раз в минуту его дёргает расписание
 * (крон на своём сервере, см. README), а приложение забирает готовую
 * ленту одним запросом к таблице curve_cache.
 *
 * Формулы обязаны совпадать с src/App.tsx и src/curveConfig.js — это
 * те же числа, просто посчитанные в другом месте. При смене параметров
 * кривой правится и здесь.
 *
 * Переменные окружения: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * CRON_SECRET, при желании TONAPI_KEY (без него лимиты жёстче) и
 * TON_TESTNET=0 для боевой сети.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const TESTNET = process.env.TON_TESTNET !== "0";
const TONAPI = TESTNET ? "https://testnet.tonapi.io" : "https://tonapi.io";
// Только серверный ключ. Тот, что уходит в браузер (VITE_TONAPI_KEY),
// ограничен по источнику: у запроса с сервера заголовка Origin нет, и
// tonapi такой ключ отбивает — обход молча возвращал пустоту. Без ключа
// запросы идут по общему лимиту, этого хватает на пару десятков токенов
// раз в минуту.
const TONAPI_KEY = (process.env.TONAPI_KEY || "").trim();

// Сколько токенов обходим за раз. Ограничение не про базу, а про
// tonapi: на каждый токен уходит до трёх запросов.
const BATCH = 30;

// Параметры кривой по умолчанию — на случай, если контракт их не отдал.
// Те же значения, что в src/curveConfig.js.
const DEFAULT_VIRTUAL_TON = 1000n * 1000000000n;
const DEFAULT_VIRTUAL_TOKENS = 1000000000n * 1000000000n;
const DEFAULT_FEE_BPS = 100n;
const DEFAULT_SUPPLY = 1000000000; // миллиард, весь выпуск

// Газ, который кривая удерживает из каждой покупки (CURVE_GAS_BUY_OVERHEAD).
const GAS_BUY_OVERHEAD = 120000000n;

const OP_BUY = 0x42555921;
const OP_JETTON_NOTIFY = 0x7362d09c;

async function tonapi(path, init) {
  const заголовки = TONAPI_KEY ? { Authorization: `Bearer ${TONAPI_KEY}` } : undefined;
  try {
    const res = await fetch(`${TONAPI}${path}`, { ...(init || {}), headers: { ...(init && init.headers), ...заголовки } });
    if (!res.ok) {
      // В логах Vercel видно, что именно отбило: лимит, ключ или адрес.
      console.warn("[refresh-curves] tonapi", res.status, path);
      return null;
    }
    return await res.json();
  } catch (err) {
    return null;
  }
}

/* Состояние кривой. Порядок полей задан структурой CurveData в
   контракте: менять нельзя, не поправив в приложении и в api/notify.js. */
async function состояние(address) {
  // Обычным GET, как в api/notify.js: этот путь уже проверен на боевых
  // вызовах, и незачем иметь два разных способа спросить одно и то же.
  const json = await tonapi(`/v2/blockchain/accounts/${address}/methods/data`);
  const stack = json && json.stack;
  if (!Array.isArray(stack) || stack.length < 7) return null;
  const num = (i) => BigInt(stack[i].num);
  return {
    virtualTon: num(0),
    virtualTokens: num(1),
    realTon: num(2),
    tokensSold: num(3),
    tokensForSale: num(4),
    graduationTon: num(5),
    feeBps: num(6),
    graduated: stack[7] ? Number(stack[7].num) !== 0 : false,
  };
}

function opCode(msg) {
  const raw = msg && msg.op_code;
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(String(raw), 16);
  return Number.isFinite(n) ? n : null;
}

/* Цена одного токена в TON: отношение резервов, а не отдельное поле
   контракта. */
function цена(realTon, params) {
  const резервTon = params.virtualTon + realTon;
  const резервТокенов = (params.virtualTon * params.virtualTokens) / резервTon;
  if (резервТокенов <= 0n) return 0;
  return Number(резервTon) / Number(резервТокенов);
}

/* Сделки кривой из её транзакций. У покупки берём приложенную сумму за
   вычетом газа и комиссии, у продажи — сколько TON ушло продавцу: обе
   величины видны в транзакции и не требуют разбора тела сообщения. */
async function сделки(address, feeBps) {
  const json = await tonapi(`/v2/blockchain/accounts/${address}/transactions?limit=200`);
  const txs = ((json && json.transactions) || []).slice().sort((a, b) => (a.utime || 0) - (b.utime || 0));
  const ряд = [];
  let резерв = 0n;
  for (const tx of txs) {
    const in_ = tx.in_msg;
    if (!in_ || tx.success === false || tx.aborted) continue;
    const op = opCode(in_);
    if (op === OP_BUY) {
      const пришло = BigInt(in_.value || 0) - GAS_BUY_OVERHEAD;
      if (пришло <= 0n) continue;
      const чисто = пришло - (пришло * feeBps) / 10000n;
      if (чисто <= 0n) continue;
      резерв += чисто;
      ряд.push({ time: tx.utime, ton: чисто, realTon: резерв });
    } else if (op === OP_JETTON_NOTIFY) {
      // Продажа: кривая платит TON обычными переводами без опкода.
      const выплата = (tx.out_msgs || []).reduce((s, m) => (opCode(m) ? s : s + BigInt(m.value || 0)), 0n);
      if (выплата <= 0n) continue;
      резерв = резерв > выплата ? резерв - выплата : 0n;
      ряд.push({ time: tx.utime, ton: выплата, realTon: резерв });
    }
  }
  return ряд;
}

/* Метаданные жетона: держатели, выпуск и картинка. Один запрос отдаёт
   всё три — отдельных ходить незачем. */
async function метаданные(address) {
  const json = await tonapi(`/v2/jettons/${address}`);
  if (!json) return null;
  const decimals = Number((json.metadata && json.metadata.decimals) ?? 9) || 9;
  return {
    holders: typeof json.holders_count === "number" ? json.holders_count : null,
    supply: json.total_supply != null ? Number(json.total_supply) / 10 ** decimals : null,
    image: (json.metadata && json.metadata.image) || json.preview || null,
  };
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "not_configured" });
  }
  const auth = req.headers.authorization || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: tokens, error } = await admin
    .from("tokens")
    .select("id, address, curve_address, logo_url")
    .not("curve_address", "is", null)
    .eq("network", TESTNET ? "testnet" : "mainnet")
    .order("created_at", { ascending: false })
    .limit(BATCH);
  if (error) return res.status(500).json({ error: "tokens_failed", detail: error.message });
  if (!tokens || !tokens.length) {
    return res.status(200).json({ updated: 0, tokens: 0, network: TESTNET ? "testnet" : "mainnet" });
  }

  const сутки = Math.floor(Date.now() / 1000) - 86400;
  const строки = [];

  // Токены обходим по очереди, а не пачкой: три параллельных запроса на
  // токен упрутся в лимит tonapi быстрее, чем принесут пользу. Обход
  // идёт в фоне, ждать его никто не будет.
  // Сколько кривых не ответило — иначе пустой ответ не отличить от
  // «токенов нет», и чинить приходится вслепую.
  let молчат = 0;
  for (const tok of tokens) {
    const st = await состояние(tok.curve_address);
    if (!st) { молчат += 1; continue; }

    const params = {
      virtualTon: st.virtualTon || DEFAULT_VIRTUAL_TON,
      virtualTokens: st.virtualTokens || DEFAULT_VIRTUAL_TOKENS,
      feeBps: st.feeBps || DEFAULT_FEE_BPS,
    };
    const [история, meta] = await Promise.all([
      сделки(tok.curve_address, params.feeBps),
      tok.address ? метаданные(tok.address) : Promise.resolve(null),
    ]);

    const заСутки = история.filter((p) => p.time >= сутки);
    const объём = заСутки.reduce((s, p) => s + Number(p.ton) / 1e9, 0);
    // Цена сутки назад — состояние кривой после последней сделки до
    // окна. Сделок до окна не было — кривая стояла на стартовой цене.
    const доОкна = история.filter((p) => p.time < сутки);
    const прежняя = цена(доОкна.length ? доОкна[доОкна.length - 1].realTon : 0n, params);
    const сейчас = цена(st.realTon, params);

    строки.push({
      token_id: tok.id,
      curve_address: tok.curve_address,
      price_ton: сейчас,
      real_ton: Number(st.realTon) / 1e9,
      graduation_ton: Number(st.graduationTon) / 1e9,
      tokens_sold: Number(st.tokensSold) / 1e9,
      supply: meta && meta.supply ? meta.supply : DEFAULT_SUPPLY,
      fee_bps: Number(params.feeBps),
      graduated: !!st.graduated,
      // Кошелёк самой кривой держателем не считаем: на нём лежит
      // непроданный запас.
      holders: meta && meta.holders != null ? Math.max(0, meta.holders - 1) : null,
      vol24_ton: объём,
      change24: прежняя > 0 && сейчас > 0 ? ((сейчас - прежняя) / прежняя) * 100 : 0,
      tx24: заСутки.length,
      logo_url: tok.logo_url || (meta && meta.image) || null,
      // История для графика. Нанотоны — строками: в JSON они не
      // помещаются в число без потери точности, а приложение всё равно
      // приводит их к BigInt.
      trades: история.map((p) => ({ t: p.time, ton: p.ton.toString(), r: p.realTon.toString() })),
      updated_at: new Date().toISOString(),
    });
  }

  if (!строки.length) {
    return res.status(200).json({ updated: 0, tokens: tokens.length, silent: молчат, network: TESTNET ? "testnet" : "mainnet" });
  }

  const { error: writeError } = await admin.from("curve_cache").upsert(строки, { onConflict: "token_id" });
  if (writeError) return res.status(500).json({ error: "cache_failed", detail: writeError.message });

  // Заодно чиним логотип в самой карточке токена: обход всё равно
  // прочитал метаданные, а без этого поле оставалось пустым у всех, кто
  // запускал токен до того, как приложение стало брать ссылку с запуска.
  const безЛоготипа = строки.filter((s) => s.logo_url && !tokens.find((t) => t.id === s.token_id).logo_url);
  for (const s of безЛоготипа) {
    await admin.from("tokens").update({ logo_url: s.logo_url }).eq("id", s.token_id);
  }

  return res.status(200).json({ updated: строки.length, tokens: tokens.length, silent: молчат, logos: безЛоготипа.length });
}
