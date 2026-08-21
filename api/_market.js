/* Сводка по токену для бота: поиск, цифры, мини-график.
 *
 * Тем же самым занят и интерфейс, но повторно использовать его код
 * нельзя: там всё завязано на браузер и на состояние React. Здесь —
 * короткий серверный пересказ: найти токен по адресу или тикеру,
 * прочитать состояние кривой с цепочки, добрать историю сделок из своей
 * базы и сложить текст, который не стыдно отправить в чужой чат.
 *
 * Почему не картинка с настоящим графиком: рисовать её на сервере не на
 * чем — своего холста в Node нет, а тянуть ради этого браузер в функцию
 * дороже, чем сам ответ. Вместо этого график набран блочными символами:
 * он читается в любом клиенте Telegram, не грузится и не ломается, а
 * настоящий график в двух касаниях — по кнопке под сообщением.
 */

import { adminClient } from "./_support.js";

const TESTNET = process.env.TON_TESTNET === "1";
const TONAPI = TESTNET ? "https://testnet.tonapi.io" : "https://tonapi.io";
export const NETWORK = TESTNET ? "testnet" : "mainnet";

export const APP_URL = process.env.APP_URL || "https://mintlyapp.vercel.app";

// Адрес TON в любом из принятых написаний: EQ/UQ/kQ/0Q и 46 знаков
// base64url. Годится, чтобы отличить адрес от тикера, а разбирать его
// по-настоящему тут незачем — сверка идёт по строке в базе.
const ADDR_RE = /^[EUkK0][QqPp][A-Za-z0-9_-]{46}$/;

export function looksLikeAddress(s) {
  return ADDR_RE.test(String(s || "").trim());
}

const nano = (v) => Number(v) / 1e9;

/* Состояние кривой прямо из контракта. Порядок полей — из структуры
   CurveData: менять его нельзя, не поправив здесь и в api/notify.js. */
export async function curveState(address) {
  if (!address) return null;
  try {
    const res = await fetch(`${TONAPI}/v2/blockchain/accounts/${address}/methods/data`, { method: "POST" });
    if (!res.ok) return null;
    const json = await res.json();
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
      graduated: stack[7] ? Number(stack[7].num) !== 0 : false,
    };
  } catch (err) {
    return null;
  }
}

/* Цена одного токена в TON по состоянию кривой. Та же формула, что и в
   интерфейсе: цена — это отношение резервов, а не отдельное поле. */
export function priceFromState(state) {
  if (!state) return 0;
  const резервTon = state.virtualTon + state.realTon;
  const резервТокенов = state.virtualTokens - state.tokensSold;
  if (резервТокенов <= 0n) return 0;
  return Number(резервTon) / Number(резервТокенов);
}

/* Поиск. Адрес ищем точным совпадением, всё остальное — по тикеру и
   названию. Порядок: сперва точное совпадение тикера, потом остальные,
   свежие выше. */
export async function findTokens(query, limit = 8) {
  const admin = adminClient();
  if (!admin) return [];
  const q = String(query || "").trim().replace(/^\$/, "");
  const колонки = "id, name, ticker, emoji, logo_url, token_address, curve_address, created_at, owner_id";

  let ряд;
  if (looksLikeAddress(q)) {
    const { data } = await admin
      .from("tokens")
      .select(колонки)
      .eq("network", NETWORK)
      .or(`token_address.eq.${q},curve_address.eq.${q}`)
      .limit(limit);
    ряд = data || [];
  } else if (q) {
    // Экранируем запятую и скобки: строка уходит в or() как выражение
    // PostgREST, и запятая в ней разделяет условия.
    const чисто = q.replace(/[,()]/g, " ").trim();
    if (!чисто) return [];
    const { data } = await admin
      .from("tokens")
      .select(колонки)
      .eq("network", NETWORK)
      .or(`ticker.ilike.%${чисто}%,name.ilike.%${чисто}%`)
      .order("created_at", { ascending: false })
      .limit(limit);
    ряд = data || [];
    const точно = чисто.toLowerCase();
    ряд.sort((a, b) => {
      const ta = String(a.ticker || "").toLowerCase() === точно ? 0 : 1;
      const tb = String(b.ticker || "").toLowerCase() === точно ? 0 : 1;
      return ta - tb;
    });
  } else {
    // Пустой запрос — витрина: самые собравшие. Собранное лежит в
    // token_notify, её обходит расписание уведомлений.
    const { data } = await admin
      .from("tokens")
      .select(`${колонки}, token_notify (last_real_ton)`)
      .eq("network", NETWORK)
      .order("created_at", { ascending: false })
      .limit(30);
    ряд = (data || [])
      .map((t) => ({ ...t, _собрано: Number((t.token_notify && t.token_notify[0] && t.token_notify[0].last_real_ton) || 0) }))
      .sort((a, b) => b._собрано - a._собрано)
      .slice(0, limit);
  }
  return ряд;
}

/* Сделки токена из своей базы: по ним считаются движение цены и
   мини-график. Цепочка знает это точнее, но обход транзакций кривой
   ради строчки в чате — минуты ожидания и упор в лимиты tonapi. */
async function tradeHistory(tokenId) {
  const admin = adminClient();
  if (!admin || !tokenId) return [];
  const { data } = await admin
    .from("trades")
    .select("side, ton_amount, token_amount, created_at")
    .eq("token_id", tokenId)
    .order("created_at", { ascending: true })
    .limit(400);
  return (data || [])
    .map((с) => {
      const ton = Number(с.ton_amount) || 0;
      const шт = Number(с.token_amount) || 0;
      if (!(ton > 0) || !(шт > 0)) return null;
      return { price: ton / шт, at: new Date(с.created_at).getTime(), ton };
    })
    .filter(Boolean);
}

const БЛОКИ = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/* График строкой. Столбиков всегда одинаковое число: ряд разной длины в
   ленте чата выглядит обрывком, а не графиком. */
export function sparkline(points, ширина = 14) {
  if (!points || points.length < 2) return "";
  const шаг = points.length / ширина;
  const ряд = [];
  for (let i = 0; i < ширина; i++) {
    const кусок = points.slice(Math.floor(i * шаг), Math.max(Math.floor((i + 1) * шаг), Math.floor(i * шаг) + 1));
    if (!кусок.length) { ряд.push(ряд.length ? ряд[ряд.length - 1] : points[0].price); continue; }
    ряд.push(кусок[кусок.length - 1].price);
  }
  const мин = Math.min(...ряд);
  const макс = Math.max(...ряд);
  if (!(макс > мин)) return БЛОКИ[3].repeat(ширина);
  return ряд.map((v) => БЛОКИ[Math.min(7, Math.floor(((v - мин) / (макс - мин)) * 7.999))]).join("");
}

export function fmtTon(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  if (v >= 100) return v.toFixed(0);
  if (v >= 1) return v.toFixed(2).replace(/\.?0+$/, "");
  if (v > 0) return v.toFixed(4).replace(/\.?0+$/, "");
  return "0";
}

function fmtPrice(ton) {
  const v = Number(ton) || 0;
  if (v <= 0) return "—";
  if (v >= 0.001) return `${v.toFixed(5)} TON`;
  // Экспонента вида 8.96e−7 в чате читается как ошибка, а не как цена.
  // Показываем десятичной дробью, сколько бы нулей ни было.
  return `${v.toFixed(11).replace(/0+$/, "")} TON`;
}

/* Количество токенов: их миллионы и миллиарды, и мерка от TON тут не
   годится — «400000.0K» не число, а шум. */
function fmtCount(n) {
  const v = Number(n) || 0;
  // Хвостовые нули срезаем только после точки: иначе «400» превращалось
  // в «4», и проданное падало в сто раз.
  const без = (s) => s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  if (v >= 1e9) return `${без((v / 1e9).toFixed(v >= 1e10 ? 0 : 2))}B`;
  if (v >= 1e6) return `${без((v / 1e6).toFixed(v >= 1e8 ? 0 : 1))}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

function fmtAge(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const мин = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (мин < 60) return `${мин} мин`;
  const ч = Math.floor(мин / 60);
  if (ч < 24) return `${ч} ч`;
  const д = Math.floor(ч / 24);
  return д < 30 ? `${д} дн` : `${Math.floor(д / 30)} мес`;
}

const escape = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Полная сводка по одному токену: и текст сообщения, и короткая строка
   для списка в inline-подсказке. */
export async function tokenCard(token) {
  const [state, история] = await Promise.all([
    curveState(token.curve_address),
    tradeHistory(token.id),
  ]);

  const цена = priceFromState(state);
  const собрано = state ? nano(state.realTon) : 0;
  const цель = state ? nano(state.graduationTon) : 0;
  const выпуск = state ? nano(state.tokensSold) : 0;
  const капа = цена > 0 ? цена * 1000000000 : 0; // весь выпуск — миллиард

  // Движение за сутки считаем по своим сделкам: первая за 24 часа против
  // текущей цены кривой. Сделок нет — движения тоже нет, и рисовать
  // «+0.00%» честнее, чем выдумывать.
  const сутки = Date.now() - 24 * 3600 * 1000;
  const заСутки = история.filter((p) => p.at >= сутки);
  const старт = заСутки.length ? заСутки[0].price : (история.length ? история[0].price : 0);
  const движение = старт > 0 && цена > 0 ? ((цена - старт) / старт) * 100 : 0;
  const оборот = заСутки.reduce((s, p) => s + p.ton, 0);

  const график = sparkline(история.length >= 2 ? история : [], 14);
  const доля = цель > 0 ? Math.max(0, Math.min(1, собрано / цель)) : 0;
  const делений = 12;
  const полоса = "█".repeat(Math.round(доля * делений)) + "░".repeat(делений - Math.round(доля * делений));

  const имя = escape(token.name || token.ticker || "?");
  const тикер = escape(String(token.ticker || "").toUpperCase());
  const знак = движение >= 0 ? "+" : "";
  const стрелка = движение > 0 ? "▲" : движение < 0 ? "▼" : "•";

  const строки = [
    `${token.emoji || "🪙"} <b>${имя}</b>  $${тикер}`,
    "",
    `Цена   <code>${fmtPrice(цена)}</code>`,
    `Капа   <code>${fmtTon(капа)} TON</code>   ${стрелка} ${знак}${движение.toFixed(2)}% за 24ч`,
  ];
  if (график) строки.push(`График <code>${график}</code>`);
  if (цель > 0) {
    строки.push("");
    строки.push(state && state.graduated
      ? `🎉 Кривая закрыта, собрано ${fmtTon(собрано)} TON — токен на бирже`
      : `До биржи <code>${полоса}</code> ${(доля * 100).toFixed(0)}%\n${fmtTon(собрано)} из ${fmtTon(цель)} TON`);
  }
  строки.push("");
  строки.push(`Оборот 24ч ${fmtTon(оборот)} TON · Сделок ${история.length} · Возраст ${fmtAge(token.created_at)}`);
  if (выпуск > 0) строки.push(`Продано ${fmtCount(выпуск)} из ${fmtCount(state ? nano(state.tokensForSale) : 0)} токенов`);
  if (token.token_address) строки.push(`\n<code>${escape(token.token_address)}</code>`);

  const описание = state
    ? `${fmtPrice(цена)} · ${знак}${движение.toFixed(1)}% · ${fmtTon(собрано)}/${fmtTon(цель)} TON`
    : "Кривая ещё не отвечает — открой в приложении";

  return {
    text: строки.join("\n"),
    title: `$${тикер} — ${имя}`,
    description: описание,
    link: `${APP_URL}?token=${token.id}`,
    botLink: `https://t.me/${(process.env.TG_BOT || "MintlyAppbot").replace(/^@/, "")}?start=tok_${token.id}`,
    thumb: token.logo_url || null,
  };
}
