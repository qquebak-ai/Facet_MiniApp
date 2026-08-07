// Вход в аккаунт через Telegram — серверная часть.
//
// Мини-приложение присылает сюда строку initData, которую Telegram
// подписывает ключом бота. Проверить эту подпись можно только зная токен
// бота, поэтому проверка живёт на сервере: браузеру токен не отдаётся, а
// подделать initData без него нельзя. Если подпись сходится, мы находим
// (или заводим) пользователя в Supabase по его telegram_id и возвращаем
// одноразовый токен, которым клиент открывает обычную сессию Supabase.
//
// Нужные переменные окружения (Vercel → Project Settings → Environment
// Variables), все три — серверные, без префикса VITE_:
//   TELEGRAM_BOT_TOKEN        — токен бота из @BotFather
//   SUPABASE_URL              — тот же URL, что и во VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY — service_role ключ проекта Supabase
//
// service_role ключ обходит RLS, поэтому он должен быть только здесь и
// никогда не попадать в клиентский код.

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// initData считается протухшей через сутки — столько же, сколько живёт
// сессия мини-приложения у самого Telegram.
const MAX_AUTH_AGE_SEC = 24 * 60 * 60;

/* Проверка подписи по документации Telegram: собираем строку из всех
   полей кроме hash (отсортированных по имени), считаем HMAC-SHA256 с
   ключом, который сам получен как HMAC от токена бота, и сверяем с
   присланным hash. Возвращает объект пользователя или null. */
function verifyInitData(initData) {
  if (typeof initData !== "string" || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.keys()]
    .sort()
    .map((key) => `${key}=${params.get(key)}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(hash, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > MAX_AUTH_AGE_SEC) return null;

  try {
    const user = JSON.parse(params.get("user") || "null");
    return user && user.id ? user : null;
  } catch (err) {
    return null;
  }
}

// Никнейм из профиля Telegram: сначала @username, иначе имя с фамилией,
// иначе просто user<id>. Приводим к тому же виду, что и в форме
// регистрации (латиница, цифры, подчёркивание, 3–20 символов).
function nicknameFromTelegram(user) {
  const raw = user.username || [user.first_name, user.last_name].filter(Boolean).join("_") || `user${user.id}`;
  const cleaned = raw.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);
  return cleaned.length >= 3 ? cleaned : `user${user.id}`.slice(0, 20);
}

async function freeNickname(admin, base) {
  const { data } = await admin.from("profiles").select("nickname").ilike("nickname", base).maybeSingle();
  if (!data) return base;
  // Занят — добавляем короткий суффикс, не выходя за 20 символов.
  const suffix = `_${Math.random().toString(36).slice(2, 6)}`;
  return `${base.slice(0, 20 - suffix.length)}${suffix}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "server_not_configured" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const tgUser = verifyInitData(body.initData);
  if (!tgUser) return res.status(401).json({ error: "invalid_init_data" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Технический адрес: Supabase требует email у пользователя, но письма
  // на него не уходят — вход идёт только по подписи Telegram.
  const email = `tg${tgUser.id}@telegram.local`;

  try {
    // Первый вход — заводим пользователя. Если он уже есть, Supabase
    // ответит ошибкой «already registered», и это нормальный путь.
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        telegram_id: tgUser.id,
        nickname: nicknameFromTelegram(tgUser),
        bio: "",
        avatar_url: tgUser.photo_url || null,
        emoji: tgUser.photo_url ? null : "🚀",
        wallet_address: null,
      },
    });
    if (createErr && !/already|exists|registered/i.test(createErr.message || "")) {
      console.error("[telegram-auth] createUser failed:", createErr);
      return res.status(500).json({ error: "create_user_failed", detail: createErr.message });
    }

    // generateLink и создаёт одноразовый токен входа, и возвращает самого
    // пользователя — так мы узнаём его id, не перебирая список.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkErr || !link?.properties?.hashed_token || !link?.user?.id) {
      console.error("[telegram-auth] generateLink failed:", linkErr);
      return res.status(500).json({ error: "link_failed", detail: linkErr && linkErr.message });
    }

    const userId = link.user.id;

    // Профиль заводим только если его ещё нет: при повторном входе нельзя
    // затирать никнейм, описание и аватарку, которые человек поменял сам.
    const { data: profile } = await admin.from("profiles").select("id, telegram_id").eq("id", userId).maybeSingle();
    if (!profile) {
      const nickname = await freeNickname(admin, nicknameFromTelegram(tgUser));
      const { error: insertErr } = await admin.from("profiles").upsert({
        id: userId,
        telegram_id: tgUser.id,
        nickname,
        email,
        bio: "",
        avatar_url: tgUser.photo_url || null,
        emoji: tgUser.photo_url ? null : "🚀",
      }, { onConflict: "id" });
      if (insertErr) {
        console.error("[telegram-auth] profile upsert failed:", insertErr);
        return res.status(500).json({ error: "profile_failed", detail: insertErr.message });
      }
    } else if (!profile.telegram_id) {
      // Профиль остался с прошлой (почтовой) схемы — доклеиваем привязку.
      await admin.from("profiles").update({ telegram_id: tgUser.id }).eq("id", userId);
    }

    return res.status(200).json({ token_hash: link.properties.hashed_token });
  } catch (err) {
    console.error("[telegram-auth] unexpected error:", err);
    return res.status(500).json({ error: "unexpected", detail: err && err.message });
  }
}
