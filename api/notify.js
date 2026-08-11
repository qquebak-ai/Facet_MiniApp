// Уведомления создателям токенов — серверная часть.
//
// Мини-приложение открыто не всегда, а знать о своём токене человек
// хочет постоянно. Поэтому раз в несколько минут сюда приходит расписание
// Vercel, читает состояние каждой живой кривой прямо с цепочки и, если
// с прошлого раза что-то изменилось, пишет владельцу в Telegram.
//
// Что шлём:
//   • кто-то купил — в кривой прибавилось TON;
//   • половина и девять десятых пути до листинга;
//   • кривая закрылась.
//
// Нужные переменные окружения (Vercel → Project Settings → Environment
// Variables), все серверные, без префикса VITE_:
//   TELEGRAM_BOT_TOKEN        — токен бота из @BotFather
//   SUPABASE_URL              — тот же URL, что и во VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY — service_role ключ проекта Supabase
//   CRON_SECRET               — любая длинная строка; Vercel сам шлёт её
//                               в заголовке Authorization при вызове по
//                               расписанию, а чужой вызов без неё
//                               отбивается
//
// Состояние прошлой проверки лежит в таблице token_notify (см.
// supabase_notify.sql). У неё нет ни одной политики доступа: писать в
// неё может только этот обработчик своим service_role ключом, а значит
// подделать «уже отправляли» из приложения нельзя.

import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// Сеть берём ту же, что и приложение: у токенов из тестовой сети
// состояние лежит на testnet.tonapi.io и на боевом узле его нет.
const TESTNET = process.env.TON_TESTNET !== "0";
const TONAPI = TESTNET ? "https://testnet.tonapi.io" : "https://tonapi.io";

// Сколько токенов проверяем за один заход. Ограничение не про базу, а
// про tonapi: без ключа он пускает считанные запросы в секунду, и
// длинный список упрётся в 429 на середине.
const BATCH = 25;

// Прибавка меньше этой не стоит сообщения: покупка на сотые доли TON
// разбудит человека без повода.
const MIN_BUY_TON = 0.05;

function ok(res, body) { return res.status(200).json(body); }

async function tonapi(path) {
  const res = await fetch(`${TONAPI}${path}`, { method: "POST" });
  if (!res.ok) throw new Error(`tonapi ${res.status}`);
  return res.json();
}

// Состояние кривой. Поля идут в том же порядке, что и в структуре
// CurveData контракта: менять его нельзя, не поправив здесь.
async function curveState(address) {
  const json = await tonapi(`/v2/blockchain/accounts/${address}/methods/data`);
  const stack = json?.stack || [];
  if (stack.length < 7) return null;
  const num = (i) => Number(BigInt(stack[i].num)) / 1e9;
  return {
    realTon: num(2),
    graduationTon: num(5),
    graduated: stack[7] ? Number(BigInt(stack[7].num)) !== 0 : false,
  };
}

async function tell(chatId, text) {
  if (!chatId) return false;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  // Человек мог не начинать диалог с ботом или заблокировать его —
  // это нормальный исход, а не сбой расписания.
  return res.ok;
}

const fmt = (n) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2));

export default async function handler(req, res) {
  if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "not_configured" });
  }
  // Обработчик ходит по цепочке и шлёт людям сообщения — дёргать его
  // снаружи не должен никто.
  const auth = req.headers.authorization || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: tokens, error } = await admin
    .from("tokens")
    .select("id, name, ticker, curve_address, owner_id")
    .not("curve_address", "is", null)
    .order("created_at", { ascending: false })
    .limit(BATCH);
  if (error) return res.status(500).json({ error: "tokens_failed", detail: error.message });
  if (!tokens || !tokens.length) return ok(res, { checked: 0, sent: 0 });

  const owners = [...new Set(tokens.map((t) => t.owner_id).filter(Boolean))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, telegram_id")
    .in("id", owners.length ? owners : ["00000000-0000-0000-0000-000000000000"]);
  const chatOf = new Map((profiles || []).map((p) => [p.id, p.telegram_id]));

  const { data: states } = await admin
    .from("token_notify")
    .select("token_id, last_real_ton, sent_half, sent_almost, sent_closed")
    .in("token_id", tokens.map((t) => t.id));
  const stateOf = new Map((states || []).map((s) => [s.token_id, s]));

  let sent = 0;
  let checked = 0;

  for (const tok of tokens) {
    let curve = null;
    try { curve = await curveState(tok.curve_address); } catch { /* сеть подведёт — попробуем в следующий заход */ }
    if (!curve) continue;
    checked += 1;

    const prev = stateOf.get(tok.id) || { last_real_ton: null, sent_half: false, sent_almost: false, sent_closed: false };
    const chat = chatOf.get(tok.owner_id);
    const label = `$${tok.ticker || tok.name || "?"}`;
    const target = curve.graduationTon;
    const pct = target > 0 ? (curve.realTon / target) * 100 : 0;

    const next = {
      token_id: tok.id,
      last_real_ton: curve.realTon,
      sent_half: prev.sent_half,
      sent_almost: prev.sent_almost,
      sent_closed: prev.sent_closed,
      checked_at: new Date().toISOString(),
    };

    // Первый заход по токену ничего не шлёт: сравнивать не с чем, и
    // человек получил бы «купили на 12 TON» за всю прошлую неделю.
    const known = prev.last_real_ton != null;
    const grew = known ? curve.realTon - prev.last_real_ton : 0;

    if (chat) {
      if (grew >= MIN_BUY_TON) {
        if (await tell(chat, `Купили <b>${label}</b> на ${fmt(grew)} TON\nВ кривой уже ${fmt(curve.realTon)} из ${fmt(target)} TON`)) sent += 1;
      }
      if (curve.graduated && !prev.sent_closed) {
        if (await tell(chat, `<b>${label}</b> закрыл кривую 🎉\nСобрано ${fmt(curve.realTon)} TON. Торговля в приложении закончилась, ликвидность уходит на биржу.`)) sent += 1;
        next.sent_closed = true;
      } else if (!curve.graduated && pct >= 90 && !prev.sent_almost) {
        if (await tell(chat, `<b>${label}</b> почти на бирже: ${pct.toFixed(0)}% пути\nОсталось ${fmt(Math.max(0, target - curve.realTon))} TON`)) sent += 1;
        next.sent_almost = true;
      } else if (!curve.graduated && pct >= 50 && !prev.sent_half) {
        if (await tell(chat, `<b>${label}</b> прошёл половину пути до биржи\nВ кривой ${fmt(curve.realTon)} из ${fmt(target)} TON`)) sent += 1;
        next.sent_half = true;
      }
    }

    await admin.from("token_notify").upsert(next, { onConflict: "token_id" });
  }

  return ok(res, { checked, sent });
}
