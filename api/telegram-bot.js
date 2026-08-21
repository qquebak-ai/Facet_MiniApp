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
 * Второе — токены. Бот отвечает на команды в любом чате, куда его
 * добавили («/token PRSM», «/top»), и работает подсказкой в чужих
 * чатах, где его нет вовсе: «@MintlyAppbot PRSM» собирает карточку с
 * ценой, движением за сутки, мини-графиком и путём до биржи. Чтобы
 * подсказки заработали, режим нужно включить у @BotFather:
 *   /setinline → выбрать бота → написать текст подсказки, например
 *   «тикер или адрес токена».
 * Список команд там же: /setcommands →
 *   token - карточка токена по тикеру или адресу
 *   top - какие токены собрали больше всех
 *   help - что умеет бот
 *
 * Третье — поддержка в одну сторону. Вопросы принимает только
 * приложение, раздел «Поддержка»: в переписке с ботом их не собрать по
 * человеку, а без привязки к аккаунту ответ некуда вернуть. Бот носит
 * обратную половину — ответ команды, отправленный реплаем в служебном
 * чате, доходит человеку и в личку, и в приложение (см. api/_support.js
 * и supabase_support.sql).
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

import { SUPPORT_CHAT_ID, adminClient, deliverAnswer } from "./_support.js";
import { searchAll, cardFor, cardByRef, свежийГрафик, findTokens, trendingExternal, looksLikeAddress } from "./_market.js";
import { buyLink, оценкаПокупки, БЫСТРЫЕ_СУММЫ } from "./_trade.js";
import { кошелёкПоTelegram, привязатьКошелёк, балансTon, жетоны, жетонныйКошелёк, ссылкаПродажи, нормальныйАдрес } from "./_wallet.js";

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
// Имя бота нужно самим сообщениям: в группах кнопка «открыть» ведёт не в
// приложение, а в личку с ботом — web_app-кнопки Telegram пускает только
// туда.
const TG_BOT = String(process.env.TG_BOT || "MintlyAppbot").replace(/^@/, "").trim();

const REF_PREFIX = "ref_";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOKEN_PREFIX = "tok_";
function tokenFromPayload(payload) {
  if (typeof payload !== "string" || !payload.startsWith(TOKEN_PREFIX)) return null;
  const id = payload.slice(TOKEN_PREFIX.length).trim();
  return UUID_RE.test(id) ? id : null;
}

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

/* Кнопки под карточкой токена.
 *
 * Кнопка web_app живёт только в сообщениях, которые бот отправляет сам
 * в личной переписке с собой. В подсказке её быть не может: сообщение
 * уходит от имени человека, и Telegram отбивает такой ответ целиком —
 * снаружи это выглядит как «ничего не нашлось». Поэтому во всё, что
 * рождается из подсказки, идёт обычная ссылка на бота, а приложение
 * открывает уже он. */
function tokenButtons(card, своё) {
  // Сделка идёт либо через кривую, либо через приложение — мимо Mintly
  // бот торговать не отправляет: комиссия площадки живёт в самой
  // сделке, и ссылка на чужую биржу уводила бы человека вместе с ней.
  const торг = card.curve && card.ref
    ? (своё
        // В чужом чате торговать негде: суммы, расчёт и подпись — это
        // разговор, а разговор у бота бывает только в личке.
        ? { text: "💸 Торговать", callback_data: `b:${card.ref}` }
        : { text: "💸 Торговать", url: `https://t.me/${TG_BOT}?start=buy_${card.ref.replace(":", "_")}` })
    : (своё
        ? { text: "💸 Торговать", web_app: { url: card.link } }
        : { text: "💸 Торговать", url: card.botLink });

  // «Обновить» перерисовывает и текст, и картинку прямо в чате: цена
  // живёт своей жизнью, а сообщение, отправленное час назад, врёт.
  // В callback_data влезает 64 байта, поэтому там только вид и ключ.
  const обновить = card.ref ? [{ text: "🔄 Обновить", callback_data: `r:${card.ref}` }] : [];

  return { inline_keyboard: [[торг, ...обновить]] };
}

/* Второй ряд кнопок: суммы покупки. Каждая — готовая ссылка в кошелёк,
   где уже проставлены адрес кривой, сумма и тело сообщения. Подписывает
   человек, бот в цепочку не ходит и ключей не знает. */
function buyButtons(card, своё) {
  // Сумма ведёт не сразу в кошелёк, а на расчёт: сколько токенов
  // придёт, сколько уйдёт на комиссию и газ. Подписывать вслепую
  // человек не должен.
  const суммы = БЫСТРЫЕ_СУММЫ.map((n) => ({ text: `${n} TON`, callback_data: `q:${card.ref}:${n}` }));
  const низ = [
    своё
      ? { text: "Своя сумма", web_app: { url: card.link } }
      : { text: "Своя сумма", url: card.botLink },
    { text: "← Назад", callback_data: `x:${card.ref}` },
  ];
  // Продажа отдельным рядом: она требует кошелька и своего расчёта, и
  // мешать её с суммами покупки — верный способ нажать не то. В чужом
  // чате она уводит к боту: остаток и адрес — не то, что показывают
  // посреди общей переписки.
  const продать = своё
    ? { text: "📉 Продать", callback_data: `s:${card.ref}` }
    : { text: "📉 Продать", url: `https://t.me/${TG_BOT}?start=buy_${card.ref.replace(":", "_")}` };
  return { inline_keyboard: [суммы, [продать], низ] };
}

/* Покупка командой: /buy PRSM 5 — тикер или адрес, потом сумма в TON.
   Без суммы показываем меню, а не отказ: человек мог просто не знать
   формата. */
async function handleBuyCommand(message, хвост) {
  const части = String(хвост || "").trim().split(/\s+/).filter(Boolean);
  const запрос = части[0] || "";
  const сумма = Number(String(части[1] || "").replace(",", "."));

  if (!запрос) {
    await tg("sendMessage", {
      chat_id: message.chat.id,
      text: "Что покупаем? <code>/buy PRSM 5</code> — тикер или адрес и сумма в TON.",
      parse_mode: "HTML",
    });
    return;
  }

  const найдено = await searchAll(запрос, 1);
  if (!найдено.length) {
    await tg("sendMessage", { chat_id: message.chat.id, text: "Такого токена нет ни в Mintly, ни на биржах TON." });
    return;
  }
  const card = await cardFor(найдено[0]);

  // Кривой нет — сделка идёт в приложении, там же и комиссия площадки.
  if (!card.curve) {
    await tg("sendMessage", {
      chat_id: message.chat.id,
      text: `${card.text}\n\nЭтот токен торгуется в приложении.`,
      parse_mode: "HTML",
      link_preview_options: card.chart ? { url: card.chart, prefer_large_media: true, show_above_text: true } : { is_disabled: true },
      reply_markup: tokenButtons(card, message.chat.type === "private"),
    });
    return;
  }

  if (!(сумма > 0)) {
    await tg("sendMessage", {
      chat_id: message.chat.id,
      text: `${card.text}\n\nСколько берём? Выбери сумму или напиши: <code>/buy ${запрос} 5</code>`,
      parse_mode: "HTML",
      link_preview_options: card.chart ? { url: card.chart, prefer_large_media: true, show_above_text: true } : { is_disabled: true },
      reply_markup: buyButtons(card, message.chat.type === "private"),
    });
    return;
  }

  const ссылка = buyLink(card.curve, сумма);
  await tg("sendMessage", {
    chat_id: message.chat.id,
    text: await сообщениеПокупки(card, сумма),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [[{ text: `💳 Подписать в кошельке · ${сумма} TON`, url: ссылка }]] },
  });
}

/* Ядро продажи: собрать ссылку по кошельку человека и показать, сколько
   уходит. Одним путём идут и команда, и кнопка под карточкой. */
async function продажа(chatId, telegramId, токен, сколько) {
  const профиль = await кошелёкПоTelegram(telegramId);
  const владелец = профиль && профиль.wallet_address ? нормальныйАдрес(профиль.wallet_address) : null;
  if (!владелец) {
    await handleWallet(chatId, telegramId);
    return;
  }
  if (!токен || !токен.curve || !токен.jetton) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "Продать отсюда можно только токен Mintly, который ещё на кривой. Остальное — в приложении.",
    });
    return;
  }

  const кошелёк = await жетонныйКошелёк(владелец, токен.jetton);
  if (!кошелёк || !(кошелёк.raw > 0n)) {
    await tg("sendMessage", { chat_id: chatId, text: `На кошельке нет $${токен.ticker}.` });
    return;
  }

  const всего = Number(кошелёк.raw) / 10 ** кошелёк.decimals;
  let raw = кошелёк.raw;
  const слово = String(сколько || "").toLowerCase();
  if (слово && слово !== "all" && слово !== "всё" && слово !== "все") {
    const n = Number(слово.replace(",", "."));
    if (!(n > 0)) {
      await tg("sendMessage", { chat_id: chatId, text: "Сколько продаём? Число или «all»." });
      return;
    }
    // Больше, чем лежит, не продаём: контракт такое просто отобьёт.
    const хочет = BigInt(Math.floor(n * 10 ** кошелёк.decimals));
    raw = хочет > кошелёк.raw ? кошелёк.raw : хочет;
  }

  const ссылка = ссылкаПродажи({ jettonWallet: кошелёк.wallet, curve: токен.curve, owner: владелец, raw });
  if (!ссылка) {
    await tg("sendMessage", { chat_id: chatId, text: "Не получилось собрать продажу. Попробуй в приложении." });
    return;
  }

  const штук = Number(raw) / 10 ** кошелёк.decimals;
  const число = (v) => (v >= 1000 ? Math.round(v).toLocaleString("ru-RU") : v.toFixed(2));
  await tg("sendMessage", {
    chat_id: chatId,
    text: [
      `<b>Продажа $${токен.ticker}</b>`,
      "",
      `Продаёшь <b>${число(штук)}</b> из ${число(всего)}`,
      "TON придёт на тот же кошелёк, комиссию удержит кривая.",
      "",
      "Сумма зависит от того, кто успеет продать раньше. Нужна защита от проскальзывания — продавай в приложении.",
    ].join("\n"),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [[{ text: "💳 Подписать в кошельке", url: ссылка }]] },
  });
}

/* Продажа командой: /sell PRSM 100 или /sell PRSM all. */
async function handleSellCommand(message, хвост) {
  const части = String(хвост || "").trim().split(/\s+/).filter(Boolean);
  const запрос = части[0] || "";
  if (!запрос) {
    await tg("sendMessage", {
      chat_id: message.chat.id,
      text: "Что продаём? <code>/sell PRSM 100</code> или <code>/sell PRSM all</code>.",
      parse_mode: "HTML",
    });
    return;
  }
  const найдено = await searchAll(запрос, 1);
  const строка = найдено[0];
  if (!строка || строка.external) {
    await tg("sendMessage", {
      chat_id: message.chat.id,
      text: "Продать отсюда можно только токен Mintly, который ещё на кривой. Остальное — в приложении.",
    });
    return;
  }
  const card = await cardFor(строка);
  await продажа(message.chat.id, message.from.id, card, части[1] || "all");
}

/* Расчёт покупки: что человек увидит перед тем, как открыть кошелёк. */
async function сообщениеПокупки(card, сумма) {
  const { curveState } = await import("./_market.js");
  const state = await curveState(card.curve);
  const о = state ? оценкаПокупки(state, сумма) : null;
  const шт = о ? о.токенов : 0;
  const тикер = card.title.replace(/^\$/, "").split(" ")[0];
  const строки = [
    `<b>Покупка ${тикер}</b>`,
    "",
    `Платишь <b>${о ? о.всегоTon.toFixed(2) : сумма} TON</b>`,
    о ? `Получишь ≈ <b>${шт >= 1000 ? Math.round(шт).toLocaleString("ru-RU") : шт.toFixed(2)}</b> токенов` : "Кривая не ответила — цифры уточнит кошелёк",
    о ? `Комиссия площадки ${о.комиссияTon.toFixed(3)} TON · газ ${о.газTon.toFixed(2)} TON` : "",
    "",
    "Сумма может немного разойтись: пока идёт подпись, кто-то успевает купить раньше. Нужна защита от проскальзывания — покупай в приложении.",
  ].filter(Boolean);
  return строки.join("\n");
}

/* Перерисовка по нажатию «обновить». Работает и для сообщения из
   подсказки (у него нет чата — только inline_message_id), и для
   обычного ответа на команду. */
async function handleCallback(cb) {
  const данные = String(cb.data || "");

  // Кнопки главного меню: у них своих токенов нет, только действие.
  if (данные === "w:") {
    await handleWallet(cb.message ? cb.message.chat.id : cb.from.id, cb.from.id);
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    return;
  }
  if (данные === "top:") {
    await handleTop({ chat: { id: cb.message ? cb.message.chat.id : cb.from.id }, message_id: undefined });
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    return;
  }

  // «q» несёт ещё и сумму: q:t:<id>:5
  const m = данные.match(/^([rbxqs]):([pt]):([^:]+)(?::(\d+(?:\.\d+)?))?$/);
  if (!m) {
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    return;
  }
  const действие = m[1];

  let card = null;
  try { card = await cardByRef(m[2], m[3]); } catch (err) { card = null; }
  if (!card) {
    await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Не получилось обновить — источник не ответил" });
    return;
  }

  const своё = !!(cb.message && cb.message.chat && cb.message.chat.type === "private");

  // Выбор суммы и возврат обратно меняют только кнопки: перерисовывать
  // текст с картинкой ради этого — лишняя секунда ожидания и лишний
  // поход в цепочку.
  // Продажа: столько же шагов, сколько у покупки, но сумма считается от
  // того, что реально лежит на кошельке.
  if (действие === "s") {
    const куда = cb.message ? cb.message.chat.id : (cb.from && cb.from.id);
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    if (куда) await продажа(куда, cb.from.id, card, "all");
    return;
  }

  // Расчёт покупки: отдельным сообщением, чтобы карточка с графиком
  // осталась на месте — к ней ещё вернутся.
  if (действие === "q") {
    const сумма = Number(m[4]) || 0;
    const ссылка = buyLink(card.curve, сумма);
    if (!ссылка || !сумма) {
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Не получилось собрать покупку" });
      return;
    }
    const текст = await сообщениеПокупки(card, сумма);
    const куда = cb.message ? cb.message.chat.id : (cb.from && cb.from.id);
    if (куда) {
      await tg("sendMessage", {
        chat_id: куда,
        text: текст,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: { inline_keyboard: [
          [{ text: `💳 Подписать в кошельке · ${сумма} TON`, url: ссылка }],
          [{ text: "← К токену", callback_data: `x:${card.ref}` }],
        ] },
      });
    }
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    return;
  }

  if (действие === "b" || действие === "x") {
    const кнопки = действие === "x"
      ? tokenButtons(card, своё)
      : buyButtons(card, своё);
    const цель = cb.inline_message_id
      ? { inline_message_id: cb.inline_message_id }
      : cb.message ? { chat_id: cb.message.chat.id, message_id: cb.message.message_id } : null;
    if (!цель) { await tg("answerCallbackQuery", { callback_query_id: cb.id }); return; }
    // «Назад» из расчёта возвращает не только кнопки, но и саму
    // карточку: текст к этому моменту уже заменён расчётом покупки.
    if (действие === "x") {
      await tg("editMessageText", {
        ...цель,
        text: card.text,
        parse_mode: "HTML",
        link_preview_options: card.chart
          ? { url: свежийГрафик(card.chart), prefer_large_media: true, show_above_text: true }
          : { is_disabled: true },
        reply_markup: кнопки,
      });
    } else {
      await tg("editMessageReplyMarkup", { ...цель, reply_markup: кнопки });
    }
    await tg("answerCallbackQuery", {
      callback_query_id: cb.id,
      text: действие === "b" ? "Выбери сумму — подпишешь в кошельке" : "",
    });
    return;
  }

  const тело = {
    text: card.text,
    parse_mode: "HTML",
    link_preview_options: card.chart
      ? { url: свежийГрафик(card.chart), prefer_large_media: true, show_above_text: true }
      : { is_disabled: true },
    reply_markup: tokenButtons(card, своё),
  };
  if (cb.inline_message_id) тело.inline_message_id = cb.inline_message_id;
  else if (cb.message) {
    тело.chat_id = cb.message.chat.id;
    тело.message_id = cb.message.message_id;
  } else {
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    return;
  }

  const ответ = await tgCall("editMessageText", тело);
  // «Ничего не изменилось» — не сбой: за минуту цена могла не дрогнуть.
  const без = !ответ.ok && String(ответ.description || "").includes("not modified");
  await tg("answerCallbackQuery", {
    callback_query_id: cb.id,
    text: ответ.ok ? "Обновлено" : без ? "Без изменений" : "Не получилось обновить",
  });
}

/* Покупка через упоминание: «@бот buy PRSM 5».
 *
 * Ссылка на подпись здесь публична намеренно — она ничем не привязана к
 * отправителю: это просто покупка на кривой, и подписывает её тот, кто
 * нажмёт, своим кошельком. Продажа так работать не может, поэтому её
 * отправляют в личку.
 */
async function inlineBuy(query, части) {
  const запрос = части[0] || "";
  const сумма = Number(String(части[1] || "").replace(",", "."));

  if (!запрос) {
    await tg("answerInlineQuery", {
      inline_query_id: query.id,
      cache_time: 60,
      results: [{
        type: "article",
        id: "buy-help",
        title: "Покупка: укажи токен",
        description: `@${TG_BOT} buy PRSM 5`,
        input_message_content: {
          message_text: `Покупка через бота: <code>@${TG_BOT} buy ТИКЕР СУММА</code>`,
          parse_mode: "HTML",
        },
      }],
    });
    return;
  }

  let найдено = [];
  try { найдено = await searchAll(запрос, 1); } catch (err) { найдено = []; }
  if (!найдено.length) {
    await tg("answerInlineQuery", { inline_query_id: query.id, cache_time: 20, results: [] });
    return;
  }

  const card = await cardFor(найдено[0]);
  // Кривой нет — покупать нечего собирать, сделка идёт в приложении.
  if (!card.curve) {
    await tg("answerInlineQuery", {
      inline_query_id: query.id,
      cache_time: 20,
      results: [{
        type: "article",
        id: "buy-app",
        title: `$${card.ticker || ""} — торгуется в приложении`,
        description: "Отправить карточку токена",
        thumbnail_url: card.thumb || undefined,
        input_message_content: {
          message_text: card.text,
          parse_mode: "HTML",
          link_preview_options: card.chart
            ? { url: card.chart, prefer_large_media: true, show_above_text: true }
            : { is_disabled: true },
        },
        reply_markup: tokenButtons(card, false),
      }],
    });
    return;
  }

  // Сумма названа — сразу расчёт и подпись. Не названа — карточка с
  // рядом сумм, выбор доделает человек прямо в чате.
  const результат = сумма > 0
    ? {
      type: "article",
      id: `buy-${сумма}`,
      title: `Купить $${card.ticker || ""} на ${сумма} TON`,
      description: "Расчёт и подпись в кошельке",
      thumbnail_url: card.thumb || undefined,
      input_message_content: {
        message_text: await сообщениеПокупки(card, сумма),
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      },
      reply_markup: { inline_keyboard: [
        [{ text: `💳 Подписать в кошельке · ${сумма} TON`, url: buyLink(card.curve, сумма) }],
        [{ text: "← К токену", callback_data: `x:${card.ref}` }],
      ] },
    }
    : {
      type: "article",
      id: "buy-pick",
      title: `Купить $${card.ticker || ""}`,
      description: "Выбрать сумму в чате",
      thumbnail_url: card.thumb || undefined,
      input_message_content: {
        message_text: card.text,
        parse_mode: "HTML",
        link_preview_options: card.chart
          ? { url: card.chart, prefer_large_media: true, show_above_text: true }
          : { is_disabled: true },
      },
      reply_markup: buyButtons(card, false),
    };

  await tg("answerInlineQuery", { inline_query_id: query.id, cache_time: 15, results: [результат] });
}

/* Подсказка в любом чате: «@бот PRSM» или «@бот EQ…».
   Пустой запрос показывает те токены, что собрали больше всех. */
async function handleInline(query) {
  const текст = String(query.query || "").trim();

  // В переписке двух людей бота нет, и команды со слэшем туда не
  // доходят — Telegram их ему не передаёт. Поэтому те же слова
  // понимаются и здесь: «@бот top» работает как «/top».
  const слово = текст.toLowerCase();
  if (слово === "help" || слово === "помощь" || слово === "?") {
    await tg("answerInlineQuery", {
      inline_query_id: query.id,
      cache_time: 300,
      results: [{
        type: "article",
        id: "help",
        title: "Что умеет бот",
        description: "Тикер или адрес токена — и в чат уходит его карточка",
        input_message_content: {
          message_text: [
            "<b>Mintly в чате</b>",
            "",
            `<code>@${TG_BOT} PRSM</code> — карточка токена: цена, движение за сутки, график, путь до биржи`,
            `<code>@${TG_BOT} EQ…</code> — то же по адресу контракта`,
            `<code>@${TG_BOT} top</code> — что торгуют прямо сейчас`,
            `<code>@${TG_BOT} buy PRSM 5</code> — покупка: расчёт и подпись в кошельке`,
            `<code>@${TG_BOT} sell</code> и <code>@${TG_BOT} wallet</code> — продажа и кошелёк, в личке с ботом`,
            "",
            "Ищет и токены Mintly, и всё, что торгуется на биржах TON.",
          ].join("\n"),
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        },
        reply_markup: { inline_keyboard: [[{ text: "Открыть Mintly", url: `https://t.me/${TG_BOT}?start=open` }]] },
      }],
    });
    return;
  }

  // Команды через упоминание: «@бот buy PRSM 5». Со слэшем они доходят
  // только туда, где бот есть, а упоминание работает в любом чате.
  const слова = текст.split(/\s+/).filter(Boolean);
  const первое = (слова[0] || "").toLowerCase();

  if (первое === "buy" || первое === "купить") {
    await inlineBuy(query, слова.slice(1));
    return;
  }
  if (первое === "sell" || первое === "продать" || первое === "wallet" || первое === "кошелёк" || первое === "кошелек") {
    // И продажа, и кошелёк — это личное: адрес и остаток нельзя
    // выкладывать в чужой чат. Такие запросы уводим в личку с ботом.
    const продажа = первое !== "wallet" && первое !== "кошелёк" && первое !== "кошелек";
    await tg("answerInlineQuery", {
      inline_query_id: query.id,
      cache_time: 5,
      is_personal: true,
      results: [],
      button: {
        text: продажа ? "Продажа — открыть у бота" : "Кошелёк — открыть у бота",
        start_parameter: продажа ? "sell" : "wallet",
      },
    });
    return;
  }

  // «top» — то же, что пустой запрос: показать самое заметное.
  const запрос = (слово === "top" || слово === "топ") ? "" : текст;

  let найдено = [];
  try {
    найдено = await searchAll(запрос, 8);
    if (!запрос) {
      const { trendingExternal } = await import("./_market.js");
      if (найдено.length < 8) найдено = [...найдено, ...await trendingExternal(8 - найдено.length).catch(() => [])];
    }
  } catch (err) {
    console.warn("[bot] inline search failed:", err && err.message);
  }

  // Сводку собираем только для первых трёх: каждая — это поход в
  // цепочку, а ответить Telegram нужно быстро. Остальные показываем
  // строкой, цифры человек увидит, когда выберет.
  const карточки = [];
  for (const токен of найдено) {
    let подробно = null;
    if (карточки.length < 3) {
      // Сводка идёт в цепочку и на биржу — любая из них может не
      // ответить. Молчать всем списком из-за одного токена нельзя:
      // тогда в чате пусто, будто ничего не нашлось.
      try { подробно = await cardFor(токен); } catch (err) { подробно = null; }
    }
    if (подробно) {
      карточки.push(подробно);
    } else {
      const адрес = токен.external ? `pool=${токен.pool_address}` : `token=${токен.id}`;
      const метка = токен.external ? `pool_${токен.pool_address}` : `tok_${токен.id}`;
      карточки.push({
        ref: токен.external ? `p:${токен.pool_address}` : `t:${токен.id}`,
        title: `$${String(токен.ticker || "").toUpperCase()} — ${токен.name || ""}`,
        description: "Открыть карточку",
        text: `${токен.emoji || "🪙"} <b>${токен.name || ""}</b>  $${String(токен.ticker || "").toUpperCase()}`,
        link: `${APP_URL}?${адрес}`,
        botLink: `https://t.me/${TG_BOT}?start=${метка}`,
        thumb: токен.logo_url || null,
      });
    }
  }

  const results = карточки.map((c, i) => ({
    type: "article",
    id: String(i),
    title: c.title,
    description: c.description,
    thumbnail_url: c.thumb || undefined,
    input_message_content: {
      message_text: c.text,
      parse_mode: "HTML",
      // График едет отдельной картинкой поверх текста: так его видно
      // сразу, без единого касания. Ссылку задаём явно — в самом тексте
      // её нет, и искать первую попавшуюся Telegram не должен.
      link_preview_options: c.chart
        ? { url: c.chart, prefer_large_media: true, show_above_text: true }
        : { is_disabled: true },
    },
    reply_markup: tokenButtons(c, false),
  }));

  await tg("answerInlineQuery", {
    inline_query_id: query.id,
    results,
    // Кэш короткий: цена меняется с каждой сделкой, и вчерашняя
    // подсказка врала бы прямо в чужом чате.
    cache_time: 20,
    is_personal: false,
    button: результатовНет(results)
      ? { text: "Ничего не нашлось — открыть Mintly", web_app: { url: APP_URL } }
      : undefined,
  });
}
const результатовНет = (r) => !r || !r.length;

/* Команда в чате или в личке: /token PRSM, /p EQ…, /top. */
async function handleTokenCommand(message, запрос) {
  const chat = message.chat || {};
  // Личка с ботом — единственное место, где Telegram пускает кнопку,
  // открывающую мини-приложение прямо из сообщения.
  const своё = chat.type === "private";
  const текст = String(запрос || "").trim();

  if (!текст) {
    await tg("sendMessage", {
      chat_id: chat.id,
      reply_to_message_id: message.message_id,
      text: `Напиши тикер или адрес: <code>/token PRSM</code>\nИли прямо в любом чате: <code>@${TG_BOT} PRSM</code>`,
      parse_mode: "HTML",
    });
    return;
  }

  const найдено = await searchAll(текст, 5);
  if (!найдено.length) {
    await tg("sendMessage", {
      chat_id: chat.id,
      reply_to_message_id: message.message_id,
      text: "Ничего не нашлось — ни в Mintly, ни на биржах TON. Проверь тикер или пришли адрес контракта.",
    });
    return;
  }

  const card = await cardFor(найдено[0]);
  // Нашлось несколько — остальные перечисляем строкой, чтобы человек не
  // гадал, тот ли токен ему показали.
  const ещё = найдено.slice(1, 5).map((t) => `$${String(t.ticker || "").toUpperCase()}`).join(" · ");
  await tg("sendMessage", {
    chat_id: chat.id,
    reply_to_message_id: message.message_id,
    text: ещё ? `${card.text}\n\nТакже нашлось: ${ещё}` : card.text,
    parse_mode: "HTML",
    link_preview_options: card.chart
      ? { url: card.chart, prefer_large_media: true, show_above_text: true }
      : { is_disabled: true },
    reply_markup: tokenButtons(card, своё),
  });
}

async function handleTop(message) {
  const chat = message.chat || {};
  // Сперва запущенное в Mintly, потом лента бирж — ровно тем же
  // порядком, каким это видно на главной.
  const свои = await findTokens("", 5).catch(() => []);
  const чужие = свои.length >= 5 ? [] : await trendingExternal(5 - свои.length).catch(() => []);
  const найдено = [...свои, ...чужие];
  if (!найдено.length) {
    await tg("sendMessage", { chat_id: chat.id, text: "Пока пусто — ни одного токена." });
    return;
  }
  const строки = найдено.map((t, i) => {
    const хвост = t.external ? " · с биржи" : "";
    return `${i + 1}. ${t.emoji || "🪙"} <b>$${String(t.ticker || "").toUpperCase()}</b> — ${t.name || ""}${хвост}`;
  });
  await tg("sendMessage", {
    chat_id: chat.id,
    reply_to_message_id: message.message_id,
    text: `${строки.join("\n")}\n\nПодробнее: <code>/token ТИКЕР</code>`,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "Открыть Mintly", url: `https://t.me/${TG_BOT}?start=open` }]] },
  });
}

async function handleHelp(message) {
  await tg("sendMessage", {
    chat_id: (message.chat || {}).id,
    text: [
      "Что умеет бот:",
      "",
      `<code>@${TG_BOT} PRSM</code> — карточка токена прямо в любом чате, бота добавлять не нужно`,
      `<code>@${TG_BOT} top</code> — то же, что /top, но работает и в переписке с человеком`,
      `<code>@${TG_BOT} buy PRSM 5</code> — покупка прямо в чате`,
      "<code>/token PRSM</code> или адрес контракта — цена, движение, путь до биржи",
      "<code>/top</code> — какие токены собрали больше всех",
      "",
      "В личке можно просто написать вопрос — это поддержка.",
    ].join("\n"),
    parse_mode: "HTML",
  });
}

/* Главное меню бота. Всё, что человек делает в переписке, начинается
   отсюда: найти токен, посмотреть кошелёк, открыть приложение. */
function menuButtons() {
  return {
    inline_keyboard: [
      [{ text: "🔍 Найти токен", switch_inline_query_current_chat: "" }],
      [{ text: "👛 Мой кошелёк", callback_data: "w:" }, { text: "🏆 Топ", callback_data: "top:" }],
      [{ text: "📱 Открыть приложение", web_app: { url: APP_URL } }],
    ],
  };
}

async function handleMenu(message) {
  await tg("sendMessage", {
    chat_id: message.chat.id,
    text: [
      "<b>Mintly</b>",
      "",
      "🔍 Найти токен — по тикеру или адресу, прямо здесь",
      "👛 Мой кошелёк — баланс и что на нём лежит",
      "💸 Покупка и продажа — кнопками под карточкой токена",
      "",
      "Быстрее командой:",
      "<code>/buy PRSM 5</code> — купить на 5 TON",
      "<code>/sell PRSM 100</code> — продать 100 токенов",
      "<code>/token PRSM</code> — карточка с графиком",
    ].join("\n"),
    parse_mode: "HTML",
    reply_markup: menuButtons(),
  });
}

/* Кошелёк. Адрес берётся из профиля — его записывает приложение при
   подключении. Не подключал — покажем, как привязать руками. */
async function handleWallet(chatId, telegramId) {
  const профиль = await кошелёкПоTelegram(telegramId);
  const адрес = профиль && профиль.wallet_address ? нормальныйАдрес(профиль.wallet_address) : null;

  if (!адрес) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: [
        "Кошелёк не привязан.",
        "",
        "Подключи его в приложении — адрес запомнится сам. Или пришли сюда командой:",
        "<code>/wallet UQ…</code>",
        "",
        "Ключи бот не спрашивает и знать не может: адрес нужен только чтобы показать баланс и собрать сделку, подписываешь всегда сам в кошельке.",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "📱 Подключить в приложении", web_app: { url: APP_URL } }]] },
    });
    return;
  }

  const [ton, список] = await Promise.all([балансTon(адрес), жетоны(адрес)]);
  const строки = [
    "<b>Кошелёк</b>",
    `<code>${адрес}</code>`,
    "",
    `TON: <b>${ton == null ? "—" : ton.toFixed(3)}</b>`,
  ];
  if (список && список.length) {
    строки.push("");
    строки.push("<b>Токены</b>");
    for (const ж of список.slice(0, 12)) {
      const шт = ж.amount >= 1000 ? Math.round(ж.amount).toLocaleString("ru-RU") : ж.amount.toFixed(2);
      строки.push(`${ж.symbol} — ${шт}`);
    }
    if (список.length > 12) строки.push(`…и ещё ${список.length - 12}`);
  } else {
    строки.push("");
    строки.push("Токенов пока нет.");
  }

  await tg("sendMessage", {
    chat_id: chatId,
    text: строки.join("\n"),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [
      [{ text: "🔄 Обновить", callback_data: "w:" }],
      [{ text: "📱 Открыть приложение", web_app: { url: APP_URL } }],
    ] },
  });
}

/* Привязка кошелька руками — для тех, кто в приложение ещё не заходил. */
async function handleWalletSet(message, аргумент) {
  const адрес = нормальныйАдрес(аргумент);
  if (!адрес) {
    await tg("sendMessage", { chat_id: message.chat.id, text: "Не похоже на адрес TON. Пришли в виде UQ… или EQ…" });
    return;
  }
  const ок = await привязатьКошелёк(message.from.id, адрес);
  await tg("sendMessage", {
    chat_id: message.chat.id,
    text: ок
      ? `Кошелёк привязан:\n<code>${адрес}</code>`
      : "Не получилось сохранить. Заведи аккаунт в приложении и попробуй снова.",
    parse_mode: "HTML",
  });
}

function welcome(chatId) {
  // Кнопка открывает приложение прямо из чата, минуя короткое имя
  // мини-приложения: если оно не задано в BotFather, ссылка вида
  // t.me/бот/приложение просто открывает бота, и человек упирается в
  // тупик. Метка ему в кнопке уже не нужна — она лежит в базе и будет
  // взята при создании профиля.
  return tg("sendMessage", {
    chat_id: chatId,
    text: "Mintly — запуск токенов в Telegram.\n\nЗдесь можно смотреть цены, покупать и продавать, не выходя из переписки: /menu\n\nВопрос или поломка — «Профиль» → «Поддержка» в приложении.",
    reply_markup: menuButtons(),
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
      allowed_updates: ["message", "inline_query", "callback_query"],
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
    const параметры = new URL(req.url, "https://x").searchParams;
    // Проверка поиска: видно, что нашлось у себя, что на бирже и чем
    // биржа ответила. Без этого пустой список в чате не отличить от
    // отказа источника.
    if (параметры.get("probe")) {
      if (!WEBHOOK_SECRET || параметры.get("probe") !== WEBHOOK_SECRET) return res.status(401).json({ error: "bad_secret" });
      const q = параметры.get("q") || "NOT";
      const { findExternal, gtLast } = await import("./_market.js");
      let свои = [];
      let ошибкаСвоих = null;
      try { свои = await findTokens(q, 5); } catch (err) { ошибкаСвоих = err && err.message; }
      let чужие = [];
      let ошибкаЧужих = null;
      try { чужие = await findExternal(q, 5); } catch (err) { ошибкаЧужих = err && err.message; }
      return res.status(200).json({
        запрос: q,
        свои: свои.map((t) => t.ticker),
        ошибкаСвоих,
        биржа: чужие.map((t) => `${t.ticker} ${t.name}`),
        ошибкаЧужих,
        последнийЗапросКБирже: gtLast,
      });
    }
    const asked = параметры.get("setup");
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

  // Нажали «обновить» под карточкой.
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return res.status(200).json({ ok: true });
  }

  // Подсказка из чужого чата: бота там нет, есть только упоминание.
  if (update.inline_query) {
    await handleInline(update.inline_query);
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

  // Команды про токены работают везде: и в личке, и в группе, куда
  // бота добавили. Суффикс «@имя_бота» Telegram дописывает сам, когда в
  // группе несколько ботов.
  const команда = text.match(/^\/([a-zа-яё_]+)(?:@([\w_]+))?(?:\s+([\s\S]*))?$/i);
  if (команда) {
    const имя = команда[1].toLowerCase();
    const кому = команда[2];
    // Команда, адресованная другому боту, — не наше дело.
    if (!кому || кому.toLowerCase() === TG_BOT.toLowerCase()) {
      const хвост = команда[3] || "";
      if (имя === "token" || имя === "t" || имя === "price" || имя === "p") {
        await handleTokenCommand(message, хвост);
        return res.status(200).json({ ok: true });
      }
      if (имя === "menu" || имя === "меню" || имя === "start_menu") {
        await handleMenu(message);
        return res.status(200).json({ ok: true });
      }
      if (имя === "buy" || имя === "b") {
        await handleBuyCommand(message, хвост);
        return res.status(200).json({ ok: true });
      }
      if (имя === "sell" || имя === "s") {
        await handleSellCommand(message, хвост);
        return res.status(200).json({ ok: true });
      }
      if (имя === "wallet" || имя === "w") {
        if (хвост.trim()) await handleWalletSet(message, хвост.trim());
        else await handleWallet(chat.id, from.id);
        return res.status(200).json({ ok: true });
      }
      if (имя === "top") {
        await handleTop(message);
        return res.status(200).json({ ok: true });
      }
      if (имя === "help") {
        await handleHelp(message);
        return res.status(200).json({ ok: true });
      }
    }
  }

  // Служебный чат команды: всё, что здесь пишут реплаем, — ответы людям.
  if (SUPPORT_CHAT_ID && String(chat.id) === String(SUPPORT_CHAT_ID)) {
    await handleTeamReply(message);
    return res.status(200).json({ ok: true });
  }

  // Личка: всё, что не «/start» и не команда, — просто разговор. Бот на
  // него отвечает подсказкой: поддержка живёт в приложении, где вопрос
  // привязан к аккаунту и ответ есть куда вернуть.
  if (!text.startsWith("/start")) {
    if (chat.type === "private" && text) {
      await tg("sendMessage", {
        chat_id: chat.id,
        text: [
          "Я понимаю команды — начни с /menu.",
          "",
          "Если что-то не работает или есть вопрос, напиши в приложении: «Профиль» → «Поддержка». Оттуда ответ вернётся и сюда, и в саму переписку внутри Mintly.",
        ].join("\n"),
        reply_markup: menuButtons(),
      });
    }
    return res.status(200).json({ ok: true });
  }

  const payload = text.slice("/start".length).trim();

  // Ссылка на конкретный токен: так открываются карточки, отправленные
  // в группы, — там кнопка web_app недоступна и ведёт сюда.
  const токен = tokenFromPayload(payload);
  if (токен) {
    await tg("sendMessage", {
      chat_id: message.chat.id,
      text: "Открываю токен в Mintly.",
      reply_markup: { inline_keyboard: [[{ text: "📈 Открыть график", web_app: { url: `${APP_URL}?token=${токен}` } }]] },
    });
    return res.status(200).json({ ok: true });
  }

  // Кнопка над списком подсказок ведёт сюда: показать кошелёк или
  // объяснить, как продавать.
  if (payload === "wallet") {
    await handleWallet(message.chat.id, from.id);
    return res.status(200).json({ ok: true });
  }
  if (payload === "sell") {
    await tg("sendMessage", {
      chat_id: message.chat.id,
      text: [
        "Продажа идёт здесь: остаток и адрес кошелька — не то, что показывают посреди общей переписки.",
        "",
        "Напиши <code>/sell ТИКЕР all</code> или найди токен и нажми «Продать».",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: menuButtons(),
    });
    return res.status(200).json({ ok: true });
  }

  // Пришли из чужого чата по кнопке «Торговать»: показываем карточку
  // сразу с торговым меню — за этим и шли.
  if (payload.startsWith("buy_")) {
    const хвост = payload.slice(4);
    const вид = хвост.startsWith("p_") ? "p" : хвост.startsWith("t_") ? "t" : null;
    const ключ = вид ? хвост.slice(2) : null;
    if (вид && ключ) {
      let card = null;
      try { card = await cardByRef(вид, ключ); } catch (err) { card = null; }
      if (card) {
        await tg("sendMessage", {
          chat_id: message.chat.id,
          text: card.text,
          parse_mode: "HTML",
          link_preview_options: card.chart
            ? { url: card.chart, prefer_large_media: true, show_above_text: true }
            : { is_disabled: true },
          reply_markup: card.curve ? buyButtons(card, true) : tokenButtons(card, true),
        });
        return res.status(200).json({ ok: true });
      }
      await tg("sendMessage", { chat_id: message.chat.id, text: "Не получилось открыть токен — источник не ответил. Попробуй ещё раз." });
      return res.status(200).json({ ok: true });
    }
  }

  // Токен с биржи: у него нет своей строки в базе, поэтому в ссылке
  // едет адрес пула.
  if (payload.startsWith("pool_")) {
    const пул = payload.slice(5).trim();
    if (looksLikeAddress(пул)) {
      await tg("sendMessage", {
        chat_id: message.chat.id,
        text: "Открываю токен в Mintly.",
        reply_markup: { inline_keyboard: [[{ text: "📈 Открыть график", web_app: { url: `${APP_URL}?pool=${пул}` } }]] },
      });
      return res.status(200).json({ ok: true });
    }
  }

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
