/* Обработчик сообщений бота. Делает два дела.
 *
 * Первое — приглашения. Метка должна доходить и тогда, когда человек
 * попадает сначала в чат с ботом, а не сразу в приложение. Такое бывает
 * постоянно — ссылку пересылают, её открывают с компьютера, жмут «Start»
 * в чате. В этом случае Telegram отдаёт метку из ссылки боту в виде
 * «/start ref_<id>», а приложение о ней не узнаёт вовсе: там метка
 * приходит только при переходе по прямой ссылке на само приложение.
 * Поэтому бот кладёт метку в отдельную таблицу — «этот телеграм-аккаунт
 * пришёл от такого-то». Когда человек заведёт профиль, вход возьмёт её
 * оттуда. Метка живёт до первого использования.
 *
 * Второе — поддержка. Бот носит переписку в обе стороны: вопрос из лички
 * складывает в базу и пересылает в чат команды, а ответ команды —
 * реплаем на пересланный вопрос — возвращает человеку в личку и в
 * приложение (см. api/_support.js и supabase_support.sql).
 *
 * Подключение — один раз, открыв в браузере:
 *   https://<домен>/api/telegram-bot?setup=<TELEGRAM_WEBHOOK_SECRET>
 * Токен бота сервер берёт сам из окружения (см. функцию setup ниже).
 *
 * Чтобы заработала поддержка, нужен ещё служебный чат:
 *   1. Завести группу и добавить туда бота.
 *   2. Сделать бота администратором группы — иначе Telegram не покажет
 *      ему обычные сообщения, и ответы команды до людей не дойдут.
 *      (Второй способ: @BotFather → /setprivacy → Disable.)
 *   3. Отправить в группе «/id» — бот ответит числом.
 *   4. Положить это число в переменную окружения SUPPORT_CHAT_ID.
 */

import { SUPPORT_CHAT_ID, adminClient, acceptQuestion, deliverAnswer } from "./_support.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Секрет из setWebhook. Telegram присылает его заголовком с каждым
// обновлением — так видно, что запрос действительно от Telegram, а не от
// того, кто просто узнал адрес.
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// Адрес самого приложения. Кнопка в приветствии открывает его напрямую,
// поэтому короткое имя мини-приложения в BotFather для приглашений уже
// не требуется.
const APP_URL = process.env.APP_URL || "https://mintlyapp.vercel.app";

const REF_PREFIX = "ref_";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function inviterFromPayload(payload) {
  if (typeof payload !== "string" || !payload.startsWith(REF_PREFIX)) return null;
  const id = payload.slice(REF_PREFIX.length).trim();
  return UUID_RE.test(id) ? id : null;
}

async function tgCall(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

async function tg(method, body) {
  try {
    await tgCall(method, body);
  } catch (err) {
    console.warn("[bot] telegram call failed:", method, err && err.message);
  }
}

/* Ответ команды. Приходит реплаем в служебном чате — по сообщению, на
   которое отвечают, и находится нужная переписка. */
async function handleTeamReply(message) {
  const текст = typeof message.text === "string" ? message.text.trim() : "";
  const цель = message.reply_to_message;
  // Не реплай — значит, команда переговаривается между собой: в такой
  // разговор лезть нечего.
  if (!текст || текст.startsWith("/") || !цель) return;

  const admin = adminClient();
  const { data: связь } = await admin
    .from("support_relay")
    .select("user_id")
    .eq("admin_message_id", цель.message_id)
    .maybeSingle();

  if (!связь) {
    await tg("sendMessage", {
      chat_id: message.chat.id,
      reply_to_message_id: message.message_id,
      text: "Не вижу, кому это адресовано. Отвечать нужно реплаем на пересланный вопрос.",
    });
    return;
  }

  const { data: профиль } = await admin
    .from("profiles")
    .select("id, nickname, telegram_id")
    .eq("id", связь.user_id)
    .maybeSingle();

  const итог = await deliverAnswer(admin, {
    userId: связь.user_id,
    telegramId: профиль && профиль.telegram_id,
    text: текст,
    adminName: (message.from && (message.from.first_name || message.from.username)) || null,
  });

  await tg("sendMessage", {
    chat_id: message.chat.id,
    reply_to_message_id: message.message_id,
    text: !итог.ok
      ? "Ответ не сохранился, попробуй ещё раз."
      : итог.delivered
        ? "✓ Отправлено"
        : "✓ Сохранено в приложении. В личку не дошло: человек не начинал диалог с ботом или заблокировал его.",
  });
}

/* Вопрос, написанный боту в личку. Тем же путём, что и из приложения:
   в базу и в чат команды разом. */
async function handlePrivateQuestion(message, from) {
  const текст = typeof message.text === "string" ? message.text.trim() : "";
  if (!текст) return;

  const admin = adminClient();
  const { data: профиль } = await admin
    .from("profiles")
    .select("id, nickname, telegram_id")
    .eq("telegram_id", from.id)
    .maybeSingle();

  // Без аккаунта переписку не к кому привязать: ответ должен вернуться
  // в приложение, а приложение узнаёт человека по профилю.
  if (!профиль) {
    await tg("sendMessage", {
      chat_id: message.chat.id,
      text: "Чтобы написать в поддержку, сначала заведи аккаунт в приложении — тогда ответ придёт и сюда, и в переписку внутри Mintly.",
      reply_markup: { inline_keyboard: [[{ text: "Открыть Mintly", web_app: { url: APP_URL } }]] },
    });
    return;
  }

  const итог = await acceptQuestion(admin, { profile: профиль, body: текст, source: "bot" });
  const ответ = итог.ok
    ? "Приняли. Ответим здесь же и в приложении."
    : итог.error === "too_fast" ? "Слишком часто. Подожди немного и напиши ещё раз."
    : итог.error === "too_many" ? "На сегодня хватит сообщений — ответим на те, что уже есть."
    : итог.error === "too_long" ? "Слишком длинно. Уложись в 2000 знаков."
    : итог.error === "undelivered" ? "Поддержка сейчас недоступна. Напиши чуть позже — сообщение не сохранилось."
    : "Не получилось отправить. Попробуй ещё раз чуть позже.";
  await tg("sendMessage", { chat_id: message.chat.id, text: ответ });
}

function welcome(chatId) {
  // Кнопка открывает приложение прямо из чата, минуя короткое имя
  // мини-приложения: если оно не задано в BotFather, ссылка вида
  // t.me/бот/приложение просто открывает бота, и человек упирается в
  // тупик. Метка ему в кнопке уже не нужна — она лежит в базе и будет
  // взята при создании профиля.
  return tg("sendMessage", {
    chat_id: chatId,
    text: "Mintly — запуск токенов в Telegram.\n\nОткрой приложение, чтобы создать свой токен или торговать чужими.\n\nЕсли что-то не работает или есть вопрос — просто напиши сюда, это и есть поддержка.",
    reply_markup: { inline_keyboard: [[{ text: "Открыть Mintly", web_app: { url: APP_URL } }]] },
  });
}

/* Подключение обработчика к боту — со стороны сервера. Ту же операцию
   можно сделать вручную запросом к Telegram, но там приходится
   переносить токен бота руками, а он длинный и его легко испортить при
   копировании: лишний пробел или обрезанный хвост дают невнятное «Not
   Found». Здесь токен уже есть в окружении, поэтому достаточно открыть
   адрес со своим секретом:
     https://<домен>/api/telegram-bot?setup=<TELEGRAM_WEBHOOK_SECRET>
   В ответ приходит имя бота и текущее состояние подключения. */
async function setup(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = `https://${host}/api/telegram-bot`;
  try {
    const me = await tgCall("getMe");
    if (!me.ok) {
      return res.status(502).json({
        error: "bad_bot_token",
        подсказка: "TELEGRAM_BOT_TOKEN в переменных окружения не принят Telegram",
        ответ: me,
      });
    }
    const set = await tgCall("setWebhook", {
      url,
      secret_token: WEBHOOK_SECRET,
      allowed_updates: ["message"],
    });
    const info = await tgCall("getWebhookInfo");
    return res.status(set.ok ? 200 : 502).json({
      бот: me.result && me.result.username,
      подключено: !!set.ok,
      адрес: url,
      состояние: info.result || info,
    });
  } catch (err) {
    return res.status(500).json({ error: "setup_failed", detail: err && err.message });
  }
}

export default async function handler(req, res) {
  // Настройка идёт обычной ссылкой в браузере, поэтому GET здесь
  // разрешён — но только со знанием секрета.
  if (req.method === "GET") {
    const asked = new URL(req.url, "https://x").searchParams.get("setup");
    if (!WEBHOOK_SECRET) return res.status(500).json({ error: "no_webhook_secret" });
    if (asked !== WEBHOOK_SECRET) return res.status(401).json({ error: "bad_secret" });
    if (!BOT_TOKEN) return res.status(500).json({ error: "server_not_configured" });
    return setup(req, res);
  }
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

  // Правки чужих сообщений разбирать нечего: ответ уже ушёл, а вопрос
  // уже в чате команды.
  const message = update.message;
  const text = message && typeof message.text === "string" ? message.text.trim() : "";
  const from = message && message.from;
  const chat = (message && message.chat) || {};
  if (!from || !message) return res.status(200).json({ ok: true });

  // Узнать id чата. Нужно ровно один раз — чтобы задать SUPPORT_CHAT_ID,
  // — но работать должно в любом чате, в том числе до того, как эта
  // переменная задана.
  if (text === "/id" || text.startsWith("/id@")) {
    await tg("sendMessage", { chat_id: chat.id, text: `id этого чата: ${chat.id}` });
    return res.status(200).json({ ok: true });
  }

  // Служебный чат команды: всё, что здесь пишут реплаем, — ответы людям.
  if (SUPPORT_CHAT_ID && String(chat.id) === String(SUPPORT_CHAT_ID)) {
    await handleTeamReply(message);
    return res.status(200).json({ ok: true });
  }

  // Личка: всё, что не «/start», — вопрос в поддержку.
  if (!text.startsWith("/start")) {
    if (chat.type === "private" && text) await handlePrivateQuestion(message, from);
    return res.status(200).json({ ok: true });
  }

  const payload = text.slice("/start".length).trim();
  const inviter = inviterFromPayload(payload);

  if (inviter) {
    const admin = adminClient();
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

  await welcome(message.chat.id);
  return res.status(200).json({ ok: true });
}
