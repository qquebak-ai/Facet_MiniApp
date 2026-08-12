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

// Окно, в течение которого initData считается свежей. Строка выдаётся
// при открытии мини-приложения и после проверки обменивается на обычную
// сессию Supabase, которая дальше живёт сама и продлевается без неё.
// Значит держать окно сутки незачем: всё это время утёкшая строка
// (журнал прокси, история браузера, скриншот) остаётся годным ключом от
// аккаунта. Часа с запасом хватает на любой вход.
const MAX_AUTH_AGE_SEC = 60 * 60;

// Подробности ошибки уходят в ответ только когда это явно включено
// переменной окружения. По умолчанию наружу идёт лишь код: сообщения
// Supabase и внутренние причины — это разведданные для чужого, а
// «bad_signature (bot token len 46)» и вовсе рассказывал о длине
// секрета.
const EXPOSE_DETAIL = process.env.AUTH_DEBUG === "1";
function fail(res, status, error, detail) {
  if (detail) console.error(`[telegram-auth] ${error}:`, detail);
  return res.status(status).json(EXPOSE_DETAIL && detail ? { error, detail: String(detail) } : { error });
}

/* Проверка подписи по документации Telegram: собираем строку из всех
   полей кроме hash (отсортированных по имени), считаем HMAC-SHA256 с
   ключом, который сам получен как HMAC от токена бота, и сверяем с
   присланным hash. Возвращает { user } либо { reason } — по причине
   видно, что именно не сошлось: не тот токен бота, протухшая строка или
   мусор вместо initData. Сам токен наружу, разумеется, не уходит. */
function verifyInitData(initData) {
  if (typeof initData !== "string" || !initData) return { reason: "empty_init_data" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { reason: "no_hash" };
  params.delete("hash");

  const dataCheckString = [...params.keys()]
    .sort()
    .map((key) => `${key}=${params.get(key)}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(hash, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    // Подпись не сошлась — почти всегда это чужой или испорченный
    // TELEGRAM_BOT_TOKEN.
    return { reason: "bad_signature" };
  }

  const authDate = Number(params.get("auth_date") || 0);
  const ageSec = authDate ? Math.floor(Date.now() / 1000) - authDate : null;
  if (!authDate) return { reason: "no_auth_date" };
  if (ageSec > MAX_AUTH_AGE_SEC) return { reason: `stale_init_data (${ageSec}s)` };

  try {
    const user = JSON.parse(params.get("user") || "null");
    if (!user || !user.id) return { reason: "no_user" };
    return { user };
  } catch (err) {
    return { reason: "bad_user_json" };
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

// Занят ли ник. Сравнение без учёта регистра: два «Leo» и «leo» рядом
// путали бы людей сильнее, чем отказ при регистрации.
async function nicknameTaken(admin, nickname) {
  // Подчёркивание — подстановочный знак ILIKE, а в никнеймах оно
  // разрешено: без экранирования «user_1» совпадал бы с «userA1».
  const pattern = nickname.replace(/[%_\\]/g, "\\$&");
  const { data } = await admin.from("profiles").select("nickname").ilike("nickname", pattern).maybeSingle();
  return !!data;
}

async function freeNickname(admin, base) {
  if (!(await nicknameTaken(admin, base))) return base;
  // Занят — добавляем короткий суффикс, не выходя за 20 символов.
  const suffix = `_${Math.random().toString(36).slice(2, 6)}`;
  return `${base.slice(0, 20 - suffix.length)}${suffix}`;
}

// Ник, выбранный человеком на экране входа. Правило то же, что и в
// приложении: латиница, цифры, точка и подчёркивание, 2–20 знаков,
// первая буква. Проверяем и здесь — форма в браузере ничего не гарантирует.
const NICKNAME_RE = /^[A-Za-z][A-Za-z0-9_.]{1,19}$/;
function wantedNickname(body) {
  const raw = typeof body.nickname === "string" ? body.nickname.trim() : "";
  return NICKNAME_RE.test(raw) ? raw : null;
}

// Простое ограничение частоты. Каждый вызов ходит в админский API
// Supabase и способен завести пользователя, поэтому дверь не должна быть
// бесконечной. Память общая на экземпляр функции: при нескольких
// экземплярах предел мягче номинального, но поток запросов с одного
// адреса всё равно упирается в потолок.
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 20;
const rateHits = new Map(); // ключ -> массив меток времени

function rateLimited(key) {
  const now = Date.now();
  const hits = (rateHits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateHits.set(key, hits);
  // Подчищаем чужие протухшие записи, иначе карта растёт без предела.
  if (rateHits.size > 5000) {
    for (const [k, v] of rateHits) {
      if (!v.length || now - v[v.length - 1] > RATE_WINDOW_MS) rateHits.delete(k);
    }
  }
  return hits.length > RATE_MAX;
}

function clientKey(req) {
  const fwd = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : String(fwd || "")).split(",")[0].trim();
  return ip || req.socket?.remoteAddress || "unknown";
}

// Больше строка initData не бывает: подпись, пользователь и служебные
// поля укладываются в пару килобайт. Всё, что длиннее, разбирать незачем.
const MAX_INIT_DATA_LEN = 4096;

// Кто пригласил. В ссылке приглашения после startapp= стоит ref_<id>,
// Telegram передаёт это в start_param. Значение приходит от клиента, то
// есть подделать его может кто угодно — поэтому оно только читается как
// подсказка: id обязан быть настоящим uuid, чужим (не самим собой) и
// существующим, а записывается связь единожды, при создании профиля.
const REF_PREFIX = "ref_";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Пригласивший из ссылки: он должен существовать и не быть самим
// приглашённым. Чужой или выдуманный идентификатор просто отбрасываем.
async function validInviter(admin, startParam, userId) {
  const invitedBy = inviterFromStartParam(startParam);
  if (!invitedBy || invitedBy === userId) return null;
  const { data: inviter } = await admin.from("profiles").select("id").eq("id", invitedBy).maybeSingle();
  return inviter ? invitedBy : null;
}

function inviterFromStartParam(startParam) {
  if (typeof startParam !== "string" || !startParam.startsWith(REF_PREFIX)) return null;
  const id = startParam.slice(REF_PREFIX.length).trim();
  return UUID_RE.test(id) ? id : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (rateLimited(clientKey(req))) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "too_many_requests" });
  }
  if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "server_not_configured" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch (err) {
    return fail(res, 400, "bad_body", err && err.message);
  }
  if (typeof body.initData !== "string" || body.initData.length > MAX_INIT_DATA_LEN) {
    return fail(res, 400, "bad_init_data", "missing or oversized initData");
  }
  const checked = verifyInitData(body.initData);
  if (!checked.user) {
    return fail(res, 401, "invalid_init_data", checked.reason);
  }
  const tgUser = checked.user;
  // Отдельный счётчик на самого пользователя: подпись у него настоящая,
  // но повторять вход сотнями раз в минуту незачем.
  if (rateLimited(`tg:${tgUser.id}`)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "too_many_requests" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Технический адрес: Supabase требует email у пользователя, но письма
  // на него не уходят — вход идёт только по подписи Telegram.
  const email = `tg${tgUser.id}@telegram.local`;

  // Разведка перед входом: приложение спрашивает, заводится ли аккаунт
  // впервые. Если да — на экране входа появляется поле ника, и человек
  // выбирает его сам, а не получает выдуманный из профиля Telegram.
  // Ничего не создаём и не меняем: только смотрим, есть ли профиль с этим
  // telegram_id, и предлагаем свободный ник.
  if (body.probe === true) {
    const { data: existing, error: probeErr } = await admin
      .from("profiles")
      .select("nickname")
      .eq("telegram_id", tgUser.id)
      .maybeSingle();
    if (probeErr) return fail(res, 500, "probe_failed", probeErr.message);
    if (existing) return res.status(200).json({ exists: true, nickname: existing.nickname });
    return res.status(200).json({ exists: false, nickname: await freeNickname(admin, nicknameFromTelegram(tgUser)) });
  }

  try {
    // Первый вход — заводим пользователя. Если он уже есть, Supabase
    // ответит ошибкой «already registered», и это нормальный путь.
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        telegram_id: tgUser.id,
        nickname: wantedNickname(body) || nicknameFromTelegram(tgUser),
        bio: "",
        avatar_url: tgUser.photo_url || null,
        emoji: tgUser.photo_url ? null : "🚀",
        wallet_address: null,
      },
    });
    if (createErr && !/already|exists|registered/i.test(createErr.message || "")) {
      return fail(res, 500, "create_user_failed", createErr.message);
    }

    // generateLink и создаёт одноразовый токен входа, и возвращает самого
    // пользователя — так мы узнаём его id, не перебирая список.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkErr || !link?.properties?.hashed_token || !link?.user?.id) {
      return fail(res, 500, "link_failed", linkErr && linkErr.message);
    }

    const userId = link.user.id;

    // Адрес вида tg<id>@telegram.local предсказуем: зная чей-то
    // telegram_id, на него можно было зарегистрироваться заранее обычной
    // почтой с паролем — и тогда владелец, впервые войдя через Telegram,
    // попадал бы в чужой, уже подконтрольный аккаунт. Поэтому вход
    // разрешаем только если у найденного пользователя действительно
    // стоит привязка к этому telegram_id (её ставим здесь же при
    // создании) либо если профиль привязан к нему в базе.
    const boundId = link.user.user_metadata && link.user.user_metadata.telegram_id;
    if (boundId != null && String(boundId) !== String(tgUser.id)) {
      return fail(res, 409, "account_conflict", `metadata telegram_id ${boundId} != ${tgUser.id}`);
    }

    // Профиль заводим только если его ещё нет: при повторном входе нельзя
    // затирать никнейм, описание и аватарку, которые человек поменял сам.
    const { data: profile } = await admin.from("profiles").select("id, telegram_id, invited_by").eq("id", userId).maybeSingle();
    if (profile && profile.telegram_id != null && String(profile.telegram_id) !== String(tgUser.id)) {
      return fail(res, 409, "account_conflict", `profile telegram_id ${profile.telegram_id} != ${tgUser.id}`);
    }
    if (boundId == null && profile && profile.telegram_id == null) {
      // Пользователь с таким адресом есть, но ни в метаданных, ни в
      // профиле привязки нет — значит его завели не мы. Молча
      // «доклеивать» её к чужой записи нельзя: это и есть захват.
      return fail(res, 409, "account_conflict", "existing account without telegram binding");
    }
    if (!profile) {
      // Ник, выбранный на экране входа, — главнее выдуманного из профиля
      // Telegram. Занятый не подменяем тихим «leo_a4f1»: человек только
      // что его напечатал и должен узнать, что имя не досталось.
      const chosen = wantedNickname(body);
      if (chosen && (await nicknameTaken(admin, chosen))) {
        return res.status(409).json({ error: "nickname_taken" });
      }
      const nickname = chosen || (await freeNickname(admin, nicknameFromTelegram(tgUser)));

      // Приглашение засчитывается только при первом входе и только если
      // пригласивший действительно есть в базе. Сам себя пригласить
      // нельзя, переписать связь позже — тоже: здесь она ставится один
      // раз и больше не трогается.
      const invitedBy = await validInviter(admin, body.startParam, userId);

      const { error: insertErr } = await admin.from("profiles").upsert({
        id: userId,
        telegram_id: tgUser.id,
        nickname,
        email,
        bio: "",
        avatar_url: tgUser.photo_url || null,
        emoji: tgUser.photo_url ? null : "🚀",
        invited_by: invitedBy,
      }, { onConflict: "id" });
      if (insertErr) {
        // Между проверкой и записью ник мог занять кто-то другой: тогда
        // падает уникальный ключ, и это не сбой сервера, а «имя ушло».
        if (/duplicate|unique|nickname/i.test(insertErr.message || "")) {
          return res.status(409).json({ error: "nickname_taken" });
        }
        return fail(res, 500, "profile_failed", insertErr.message);
      }
    } else if (profile.invited_by == null) {
      // Профиль уже был, но пригласившего у него нет. Засчитываем — иначе
      // ссылка работала бы только для тех, кто вообще ни разу не заходил,
      // а это почти никто. Связь ставится один раз за всю жизнь аккаунта:
      // ниже стоит условие «ещё пусто», и переписать её нельзя.
      const invitedBy = await validInviter(admin, body.startParam, userId);
      if (invitedBy) {
        const { error: linkRefErr } = await admin
          .from("profiles")
          .update({ invited_by: invitedBy })
          .eq("id", userId)
          .is("invited_by", null);
        if (linkRefErr) console.warn("[auth] failed to link referral:", linkRefErr.message);
      }
    }

    return res.status(200).json({ token_hash: link.properties.hashed_token });
  } catch (err) {
    return fail(res, 500, "unexpected", err && err.message);
  }
}
