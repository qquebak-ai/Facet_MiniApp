/* Приём вопросов из приложения.
 *
 * Пишет человек в приложении, а прочитать вопрос должна команда в
 * Telegram — значит, между ними нужен сервер. Он же единственный, кому
 * разрешено писать в переписку: в базе на support_messages нет политики
 * вставки, и обойти этот обработчик, отправив вопрос «в стол», нельзя
 * (см. supabase_support.sql).
 *
 * Кто пишет — решает не тело запроса, а токен сессии Supabase в
 * заголовке: подставить чужой id в json может кто угодно, подделать
 * подписанный токен — нет.
 */

import {
  BOT_TOKEN, SUPABASE_URL, SERVICE_ROLE_KEY, MAX_LEN,
  adminClient, acceptQuestion,
} from "./_support.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "server_not_configured" });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "no_session" });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch (err) {
    return res.status(400).json({ error: "bad_json" });
  }
  const text = String(body.body || "").trim();
  if (!text) return res.status(400).json({ error: "empty" });
  if (text.length > MAX_LEN) return res.status(400).json({ error: "too_long" });

  const admin = adminClient();

  const { data: сессия, error: authError } = await admin.auth.getUser(token);
  const user = сессия && сессия.user;
  if (authError || !user) return res.status(401).json({ error: "bad_session" });

  const { data: profile } = await admin
    .from("profiles")
    .select("id, nickname, telegram_id")
    .eq("id", user.id)
    .maybeSingle();
  // Профиля может не быть, если человек вошёл, но не завёл аккаунт.
  // Переписка всё равно привязывается к нему — команде просто нечего
  // будет показать, кроме внутреннего id.
  const кто = profile || { id: user.id, nickname: null, telegram_id: null };

  const итог = await acceptQuestion(admin, { profile: кто, body: text, source: "app" });
  if (!итог.ok) {
    const код = итог.error;
    const статус = код === "too_fast" || код === "too_many" ? 429 : код === "store_failed" ? 500 : 400;
    return res.status(статус).json({ error: код });
  }
  return res.status(200).json({ ok: true, message: итог.message });
}
