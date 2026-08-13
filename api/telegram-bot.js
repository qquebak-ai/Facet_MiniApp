/* Обработчик сообщений бота.
 *
 * Нужен ради одного: приглашение должно доходить и тогда, когда человек
 * попадает сначала в чат с ботом, а не сразу в приложение. Такое бывает
 * постоянно — ссылку пересылают, её открывают с компьютера, жмут «Start»
 * в чате. В этом случае Telegram отдаёт метку из ссылки боту в виде
 * «/start ref_<id>», а приложение о ней не узнаёт вовсе: там метка
 * приходит только при переходе по прямой ссылке на само приложение.
 *
 * Поэтому бот кладёт метку в отдельную таблицу — «этот телеграм-аккаунт
 * пришёл от такого-то». Когда человек заведёт профиль, вход возьмёт её
 * оттуда. Метка живёт до первого использования.
 *
 * Подключение (один раз, с токеном бота):
 *   curl "https://api.telegram.org/bot<ТОКЕН>/setWebhook" \
 *     -d "url=https://mintlyapp.vercel.app/api/telegram-bot" \
 *     -d "secret_token=<ТОТ_ЖЕ_СЕКРЕТ_ЧТО_В_TELEGRAM_WEBHOOK_SECRET>"
 */

import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Секрет из setWebhook. Telegram присылает его заголовком с каждым
// обновлением — так видно, что запрос действительно от Telegram, а не от
// того, кто просто узнал адрес.
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const BOT_NAME = (process.env.TELEGRAM_BOT_NAME || "MintlyAppbot").replace(/^@/, "");
const APP_NAME = process.env.TELEGRAM_APP_NAME || "Mintly";
const APP_LINK = `https://t.me/${BOT_NAME}/${APP_NAME}`;

const REF_PREFIX = "ref_";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function inviterFromPayload(payload) {
  if (typeof payload !== "string" || !payload.startsWith(REF_PREFIX)) return null;
  const id = payload.slice(REF_PREFIX.length).trim();
  return UUID_RE.test(id) ? id : null;
}

async function tg(method, body) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn("[bot] telegram call failed:", method, err && err.message);
  }
}

function welcome(chatId, startParam) {
  // Кнопка ведёт на само приложение и уносит метку с собой. Даже если
  // запись в базу почему-то не удалась, у приглашения остаётся второй
  // путь — тот, что работал и раньше.
  const url = startParam ? `${APP_LINK}?startapp=${encodeURIComponent(startParam)}` : APP_LINK;
  return tg("sendMessage", {
    chat_id: chatId,
    text: "Mintly — запуск токенов в Telegram.\n\nОткрой приложение, чтобы создать свой токен или торговать чужими.",
    reply_markup: { inline_keyboard: [[{ text: "Открыть Mintly", url }]] },
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (WEBHOOK_SECRET && req.headers["x-telegram-bot-api-secret-token"] !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: "bad_secret" });
  }
  if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "server_not_configured" });
  }

  let update;
  try {
    update = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch (err) {
    // Ответ всегда успешный: на ошибку Telegram будет слать это же
    // обновление снова и снова.
    return res.status(200).json({ ok: true });
  }

  const message = update.message || update.edited_message;
  const text = message && typeof message.text === "string" ? message.text.trim() : "";
  const from = message && message.from;
  if (!from || !text.startsWith("/start")) return res.status(200).json({ ok: true });

  const payload = text.slice("/start".length).trim();
  const inviter = inviterFromPayload(payload);

  if (inviter) {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    try {
      // Своей же ссылкой воспользоваться нельзя, и приглашать того, кто
      // уже завёл профиль, — тоже: приглашение засчитывается один раз, за
      // приход нового человека.
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("telegram_id", from.id)
        .maybeSingle();
      const { data: inviterRow } = await admin
        .from("profiles")
        .select("id")
        .eq("id", inviter)
        .maybeSingle();
      if (!existing && inviterRow) {
        await admin
          .from("pending_referrals")
          .upsert({ telegram_id: from.id, inviter }, { onConflict: "telegram_id", ignoreDuplicates: true });
      }
    } catch (err) {
      console.warn("[bot] failed to store referral:", err && err.message);
    }
  }

  await welcome(message.chat.id, inviter ? payload : "");
  return res.status(200).json({ ok: true });
}
