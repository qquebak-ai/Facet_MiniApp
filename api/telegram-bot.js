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
 * Третье — поддержка. Бот носит переписку в обе стороны: вопрос из лички
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
import { searchAll, cardFor, cardByRef, свежийГрафик, findTokens, trendingExternal, looksLikeAddress } from "./_market.js";
import { buyLink, БЫСТРЫЕ_СУММЫ } from "./_trade.js";

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

/* Кнопки под карточкой токена.
 *
 * Кнопка web_app живёт только в сообщениях, которые бот отправляет сам
 * в личной переписке с собой. В подсказке её быть не может: сообщение
 * уходит от имени человека, и Telegram отбивает такой ответ целиком —
 * снаружи это выглядит как «ничего не нашлось». Поэтому во всё, что
 * рождается из подсказки, идёт обычная ссылка на бота, а приложение
 * открывает уже он. */
function tokenButtons(card, своё) {
  const открыть = своё
    ? { text: "📈 Открыть в Mintly", web_app: { url: card.link } }
    : { text: "📈 Открыть в Mintly", url: card.botLink };
  // «Обновить» перерисовывает и текст, и картинку прямо в чате: цена
  // живёт своей жизнью, а сообщение, отправленное час назад, врёт.
  // В callback_data влезает 64 байта, поэтому там только вид и ключ.
  const обновить = card.ref ? [{ text: "🔄 Обновить", callback_data: `r:${card.ref}` }] : [];

  // Торговля. У токена на кривой покупка собирается ссылкой в кошелёк —
  // отсюда лишний шаг с выбором суммы; у токена с биржи покупать нечего
  // собирать, там своп на самой бирже.
  const ряды = [[открыть, ...обновить]];
  if (card.swap) ряды.push([{ text: "💸 Купить", url: card.swap }]);
  else if (card.curve && card.ref) ряды.push([{ text: "💸 Купить", callback_data: `b:${card.ref}` }]);

  return { inline_keyboard: ряды };
}

/* Второй ряд кнопок: суммы покупки. Каждая — готовая ссылка в кошелёк,
   где уже проставлены адрес кривой, сумма и тело сообщения. Подписывает
   человек, бот в цепочку не ходит и ключей не знает. */
function buyButtons(card, своё) {
  const суммы = БЫСТРЫЕ_СУММЫ
    .map((n) => ({ text: `${n} TON`, url: buyLink(card.curve, n) }))
    .filter((b) => b.url);
  const низ = [
    своё
      ? { text: "Своя сумма", web_app: { url: card.link } }
      : { text: "Своя сумма", url: card.botLink },
    { text: "← Назад", callback_data: `x:${card.ref}` },
  ];
  return { inline_keyboard: суммы.length ? [суммы, низ] : [низ] };
}

/* Перерисовка по нажатию «обновить». Работает и для сообщения из
   подсказки (у него нет чата — только inline_message_id), и для
   обычного ответа на команду. */
async function handleCallback(cb) {
  const данные = String(cb.data || "");
  const m = данные.match(/^([rbx]):([pt]):(.+)$/);
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
  if (действие === "b" || действие === "x") {
    const кнопки = действие === "b" ? buyButtons(card, своё) : tokenButtons(card, своё);
    const цель = cb.inline_message_id
      ? { inline_message_id: cb.inline_message_id }
      : cb.message ? { chat_id: cb.message.chat.id, message_id: cb.message.message_id } : null;
    if (!цель) { await tg("answerCallbackQuery", { callback_query_id: cb.id }); return; }
    await tg("editMessageReplyMarkup", { ...цель, reply_markup: кнопки });
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
      "<code>/token PRSM</code> или адрес контракта — цена, движение, путь до биржи",
      "<code>/top</code> — какие токены собрали больше всех",
      "",
      "В личке можно просто написать вопрос — это поддержка.",
    ].join("\n"),
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
  const команда = text.match(/^\/([a-z_]+)(?:@([\w_]+))?(?:\s+([\s\S]*))?$/i);
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

  // Личка: всё, что не «/start», — вопрос в поддержку.
  if (!text.startsWith("/start")) {
    if (chat.type === "private" && text) await handlePrivateQuestion(message, from);
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
