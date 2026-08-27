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
import { searchAll, cardFor, cardByRef, свежийГрафик, findTokens, trendingExternal, looksLikeAddress, NETWORK } from "./_market.js";
import { оценкаПокупки, оценкаПокупкиВПуле, БЫСТРЫЕ_СУММЫ } from "./_trade.js";
import { кошелёкПоTelegram, привязатьКошелёк, балансTon, жетоны, жетонныйКошелёк, нормальныйАдрес } from "./_wallet.js";
import { свопТонВЖетон, ссылкаСвопа } from "./_swap.js";

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

// Значок для подсказок, у которых нет своей картинки: без него Telegram
// рисует серый квадрат с первой буквой заголовка, и подсказка выглядит
// поломанной.
const ЗНАЧОК = `${APP_URL}/icon.PNG`;
// Имя бота нужно самим сообщениям: в группах кнопка «открыть» ведёт не в
// приложение, а в личку с ботом — web_app-кнопки Telegram пускает только
// туда.
const TG_BOT = String(process.env.TG_BOT || "MintlyAppbot").replace(/^@/, "").trim();

// В тестовой сети бирж нет, поэтому виден только Mintly. Без этой
// строки пустой ответ выглядел бы поломкой.
const ТЕСТОВАЯ = NETWORK === "testnet";
const ПОДСКАЗКА_СЕТИ = ТЕСТОВАЯ
  ? "\n\nСейчас приложение в тестовой сети: здесь видны только токены Mintly, бирж в ней нет."
  : "";

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

/* Метка запуска для ссылки «t.me/бот?start=…».
 *
 * Telegram пускает в неё только буквы, цифры, «_» и «-»: ни точки, ни
 * «~» там быть не может — с ними команда до бота просто не доходит, и
 * человек попадает в пустой чат. Поэтому сумма едет целым числом
 * сотых и стоит перед ключом: в адресе токена «_» встречается сам по
 * себе, и разделитель в конце было бы не отличить.
 */
function меткаПокупки(ref, сумма) {
  const сотые = Math.max(0, Math.round(Number(сумма) * 100));
  const ключ = String(ref || "").replace(":", "_");
  return сотые > 0 ? `buy_x${сотые}_${ключ}` : `buy_${ключ}`;
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
  const торгуемый = card.curve || card.jetton;
  const торг = торгуемый && card.ref
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
  // Продажа через бота есть только у токенов на кривой: у биржевого её
  // маршрут строится от жетонного кошелька и проще идёт в приложении.
  const продать = card.curve
    ? [[своё
        ? { text: "📉 Продать", callback_data: `s:${card.ref}` }
        : { text: "📉 Продать", url: `https://t.me/${TG_BOT}?start=buy_${card.ref.replace(":", "_")}` }]]
    : [];
  return { inline_keyboard: [суммы, ...продать, низ] };
}

/* Что показать вместо покупки, когда назвали тикер.
 *
 * Список совпавших токенов с адресами: под одним тикером их бывает
 * несколько, и выбрать должен человек, а не первая строка выдачи.
 * Каждый — своей кнопкой, за ней стоит конкретный токен, а не текст.
 */
async function выборПоТикеру(chatId, запрос) {
  let найдено = [];
  try { найдено = await searchAll(запрос, 5); } catch (err) { найдено = []; }
  if (!найдено.length) {
    await tg("sendMessage", { chat_id: chatId, text: "Такого токена нет ни в Mintly, ни на биржах TON." });
    return;
  }

  // Все разом, а не по очереди: каждая карточка — свой поход в сеть, и
  // последовательный обход превращал ответ в несколько секунд ожидания.
  const карточки = (await Promise.all(
    найдено.map((t) => cardFor(t).catch(() => null)),
  )).filter(Boolean);
  if (!карточки.length) {
    await tg("sendMessage", { chat_id: chatId, text: "Такого токена нет ни в Mintly, ни на биржах TON." });
    return;
  }

  const строки = карточки.map((c, i) => `${i + 1}. <b>$${c.ticker || "?"}</b> — <code>${c.jetton || c.curve || "—"}</code>`);
  await tg("sendMessage", {
    chat_id: chatId,
    text: [
      `Тикер <b>${String(запрос).toUpperCase()}</b> может носить любой токен — покупка идёт только по адресу контракта.`,
      "",
      ...строки,
      "",
      "Выбери нужный кнопкой ниже или пришли CA: <code>/buy CA СУММА</code>",
    ].join("\n"),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: карточки
      .filter((c) => c.ref)
      .map((c) => [{ text: `$${c.ticker || "?"} · ${(c.jetton || c.curve || "").slice(0, 6)}…`, callback_data: `x:${c.ref}` }]) },
  });
}

/* Покупка командой: /buy EQ… 5 — адрес контракта, потом сумма в TON.

   По тикеру покупку не начинаем: тикер никто не занимает, и под одним
   и тем же названием живёт сколько угодно токенов — деньги ушли бы в
   чужой. По тикеру показываем совпадения с адресами, а дальше человек
   выбирает кнопкой. Без суммы показываем меню, а не отказ: человек мог
   просто не знать формата. */
async function handleBuyCommand(message, хвост) {
  const { запрос, сумма } = разобратьПокупку(String(хвост || "").trim().split(/\s+/));

  if (!запрос) {
    await tg("sendMessage", {
      chat_id: message.chat.id,
      text: "Что покупаем? <code>/buy CA СУММА</code>\nНапример: <code>/buy EQAw…cuNT 5</code>\n\nПо тикеру — только поиск: <code>/token PRSM</code>",
      parse_mode: "HTML",
    });
    return;
  }

  if (!looksLikeAddress(запрос)) {
    await выборПоТикеру(message.chat.id, запрос);
    return;
  }

  const найдено = await searchAll(запрос, 1);
  if (!найдено.length) {
    await tg("sendMessage", { chat_id: message.chat.id, text: "Такого токена нет ни в Mintly, ни на биржах TON." });
    return;
  }
  const card = await cardFor(найдено[0]);

  // Кривой нет и адреса жетона тоже — торговать нечем, остаётся
  // приложение.
  if (!card.curve && !card.jetton) {
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

  const мало = await неХватает(message.from.id, сумма + 0.15);
  if (мало) {
    await tg("sendMessage", { chat_id: message.chat.id, text: мало, parse_mode: "HTML" });
    return;
  }

  // На кривой сделку собираем сами, на бирже — её же маршрутом, и там
  // нужен адрес кошелька покупателя.
  let ссылка = null;
  let текст = null;
  if (card.curve || card.pool) {
    текст = await сообщениеПокупки(card, сумма);
  } else {
    const профиль = await кошелёкПоTelegram(message.from.id);
    const кошелёк = профиль && профиль.wallet_address ? нормальныйАдрес(профиль.wallet_address) : null;
    if (!кошелёк) {
      await handleWallet(message.chat.id, message.from.id);
      return;
    }
    const своп = await свопТонВЖетон({ jetton: card.jetton, tonAmount: сумма, userWallet: кошелёк });
    if (!своп) {
      await tg("sendMessage", { chat_id: message.chat.id, text: "Биржа не ответила — попробуй ещё раз." });
      return;
    }
    ссылка = ссылкаСвопа(своп);
    текст = сообщениеСвопа(card, сумма, своп);
  }

  const вЛичке = message.chat.type === "private";
  const ряды = [
    [вЛичке
      ? { text: `💳 Купить · ${сумма} TON`, web_app: { url: `${card.link}&buy=${сумма}&auto=1` } }
      : { text: `💳 Купить · ${сумма} TON`, url: `https://t.me/${TG_BOT}?start=${меткаПокупки(card.ref, сумма)}` }],
  ];

  await tg("sendMessage", {
    chat_id: message.chat.id,
    text: текст,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: ряды },
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

  const idТокена = String(токен.ref || "").split(":")[1] || "";

  // На продажу тоже нужны TON: перевод жетонов оплачивается газом.
  const балансВладельца = await балансTon(владелец);
  if (балансВладельца != null && балансВладельца < 0.25) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: `Не хватает TON на газ: на кошельке <b>${балансВладельца.toFixed(3)}</b>, для продажи нужно около <b>0.25</b>.`,
      parse_mode: "HTML",
    });
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
      "",
      "Подпиши в кошельке — TON придёт туда же.",
    ].join("\n"),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [
      [{ text: "💳 Продать", web_app: { url: `${APP_URL}?token=${idТокена}&sell=1` } }],
    ] },
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

/* Хватает ли TON на сделку. Отвечает строкой с объяснением или null,
   если всё в порядке: покупка без денег отбивается уже в кошельке, но
   там человек видит только «недостаточно средств» без единой цифры. */
async function неХватает(telegramId, нужно) {
  const профиль = await кошелёкПоTelegram(telegramId);
  const адрес = профиль && профиль.wallet_address ? нормальныйАдрес(профиль.wallet_address) : null;
  // Кошелёк не привязан — проверять нечего, а мешать покупке нельзя:
  // подпишет тем кошельком, который откроется по ссылке.
  if (!адрес) return null;
  const баланс = await балансTon(адрес);
  if (баланс == null) return null;
  if (баланс >= нужно) return null;
  return [
    "Не хватает TON.",
    "",
    `На кошельке <b>${баланс.toFixed(3)}</b>, нужно <b>${нужно.toFixed(2)}</b> — с газом.`,
    `<code>${адрес}</code>`,
  ].join("\n");
}

/* Расчёт покупки на бирже. Числа берём у самой биржи: и ожидаемый
   выход, и минимум с учётом проскальзывания — считать их у себя значит
   расходиться с тем, что произойдёт на самом деле. */
function сообщениеСвопа(card, сумма, своп) {
  const число = (v) => (v >= 1000 ? Math.round(v).toLocaleString("ru-RU") : v.toFixed(2));
  const тикер = card.ticker || "";
  // Всё лишнее убрано намеренно: проценты пулов и запас на
  // проскальзывание человеку в чате не решают ничего, а читаются как
  // мелкий шрифт в договоре. Остаются два числа — сколько отдал и
  // сколько получил.
  const газ = Math.max(0, Number(своп.value) / 1e9 - сумма);
  return [
    `<b>Покупка ${тикер}</b>`,
    "",
    `Платишь <b>${(сумма + газ).toFixed(2)} TON</b>, из них ${газ.toFixed(2)} — комиссия сети`,
    `Получишь ≈ <b>${число(своп.получит)} ${тикер}</b>`,
    "",
    "Подпиши в кошельке — токены придут туда же.",
  ].join("\n");
}

/* Расчёт покупки: что человек увидит перед тем, как открыть кошелёк. */
async function сообщениеПокупки(card, сумма) {
  const { curveState, poolState } = await import("./_market.js");
  // Пока кривая торгует — считаем по ней, после закрытия — по пулу
  // токена. Оба контракта свои, и человек в обоих случаях подписывает
  // сделку в приложении.
  const state = card.curve ? await curveState(card.curve) : null;
  const пул = !state && card.pool ? await poolState(card.pool) : null;
  const о = state
    ? оценкаПокупки(state, сумма)
    : (пул && пул.ready ? оценкаПокупкиВПуле(пул, сумма) : null);
  const шт = о ? о.токенов : 0;
  const тикер = card.title.replace(/^\$/, "").split(" ")[0];
  const строки = [
    `<b>Покупка ${тикер}</b>`,
    "",
    о
      ? `Платишь <b>${о.всегоTon.toFixed(2)} TON</b>, из них ${о.газTon.toFixed(2)} — комиссия сети`
      : `Платишь <b>${сумма} TON</b>`,
    о
      ? `Получишь ≈ <b>${шт >= 1000 ? Math.round(шт).toLocaleString("ru-RU") : шт.toFixed(2)} ${тикер}</b>`
      : "Рынок не ответил — цифры уточнит кошелёк",
    "",
    "Подпиши в кошельке — токены придут туда же.",
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
    if (!сумма) {
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Не получилось собрать покупку" });
      return;
    }

    // Пустой кошелёк — самый частый повод, по которому сделка не
    // проходит. Говорим об этом здесь, цифрами, а не отправляем человека
    // выяснять это в кошельке.
    const мало = await неХватает(cb.from.id, сумма + 0.15);
    if (мало) {
      await tg("answerCallbackQuery", {
        callback_query_id: cb.id,
        show_alert: true,
        text: мало.replace(/<[^>]+>/g, ""),
      });
      return;
    }

    let ссылка = null;
    let текст = null;
    if (card.curve) {
      текст = await сообщениеПокупки(card, сумма);
    } else {
      // Биржевой токен: маршрут свопа строится под кошелёк покупателя,
      // поэтому без привязанного адреса собрать его нечем.
      const профиль = await кошелёкПоTelegram(cb.from.id);
      const кошелёк = профиль && профиль.wallet_address ? нормальныйАдрес(профиль.wallet_address) : null;
      if (!кошелёк) {
        await tg("answerCallbackQuery", {
          callback_query_id: cb.id,
          show_alert: true,
          text: "Сначала привяжи кошелёк: открой бота и нажми «Мой кошелёк».",
        });
        return;
      }
      const своп = await свопТонВЖетон({ jetton: card.jetton, tonAmount: сумма, userWallet: кошелёк });
      if (!своп) {
        await tg("answerCallbackQuery", { callback_query_id: cb.id, show_alert: true, text: "Биржа не ответила — попробуй ещё раз" });
        return;
      }
      ссылка = ссылкаСвопа(своп);
      текст = сообщениеСвопа(card, сумма, своп);
    }
    // Первой кнопкой — сразу кошелёк: человек нажимает и видит готовую
    // транзакцию, без промежуточных экранов. Тело сообщения кодируется
    // base64url без выравнивания, как требует спецификация ton-ссылок:
    // обычный base64 кошелёк не разбирал и отправлял пустой перевод,
    // который контракт отбивал.
    const подпись = своё
      ? { text: `💳 Купить · ${сумма} TON`, web_app: { url: `${card.link}&buy=${сумма}&auto=1` } }
      : { text: `💳 Купить · ${сумма} TON`, url: `https://t.me/${TG_BOT}?start=${меткаПокупки(card.ref, сумма)}` };
    // Запасной путь на случай, если кошелёк всё же откроет пустой
    // перевод: та же сделка внутри приложения, через TonConnect.
    // Прямой ссылки в кошелёк здесь нет намеренно. Telegram открывает
    // её во встроенном браузере, и до кошелька доезжает только адрес:
    // ни суммы, ни тела сделки. Человек отправлял пустой перевод,
    // контракт отбивал его как неизвестную операцию, а в кошельке
    // светилось «Неуспешно». Подпись идёт через TonConnect.
    const вПриложении = null;

    // Своп собран под кошелёк того, кто нажал: оставлять такую ссылку в
    // общем чате нельзя — следующий заплатит своими TON, а токены уйдут
    // первому. Поэтому она уходит нажавшему в личку.
    if (!card.curve) {
      const отправлено = await tgCall("sendMessage", {
        chat_id: cb.from.id,
        text: текст,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: { inline_keyboard: [[подпись]] },
      });
      await tg("answerCallbackQuery", {
        callback_query_id: cb.id,
        show_alert: !отправлено.ok,
        text: отправлено.ok ? "Расчёт отправлен тебе в личку" : "Открой бота и нажми «Старт» — расчёт придёт туда",
      });
      return;
    }

    const кнопки = { inline_keyboard: [
      [подпись],
      ...(вПриложении ? [[вПриложении]] : []),
      [{ text: "← К токену", callback_data: `x:${card.ref}` }],
    ] };
    // Сообщение из подсказки живёт в чужом чате, куда бот писать не
    // может: там расчёт заменяет саму карточку, а «Назад» её вернёт.
    if (cb.inline_message_id) {
      await tg("editMessageText", {
        inline_message_id: cb.inline_message_id,
        text: текст,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: кнопки,
      });
    } else if (cb.message) {
      await tg("sendMessage", {
        chat_id: cb.message.chat.id,
        text: текст,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: кнопки,
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

/* Разбор «что покупаем и на сколько».
 *
 * Порядок задуман один — сперва токен, потом сумма: «buy PRSM 5», «buy
 * EQ… 5». Но пальцем в чате легко набрать наоборот, и отвечать на это
 * непониманием глупо: число здесь может быть только суммой, а всё
 * остальное — тикером или адресом.
 */
function разобратьПокупку(части) {
  const слова = (части || []).map((s) => String(s).trim()).filter(Boolean);
  let запрос = "";
  let сумма = 0;
  for (const w of слова) {
    const n = Number(w.replace(",", "."));
    const этоЧисло = Number.isFinite(n) && n > 0 && !looksLikeAddress(w);
    if (этоЧисло && !сумма) { сумма = n; continue; }
    if (!запрос) запрос = w;
  }
  return { запрос, сумма };
}

/* Покупка через упоминание: «@бот buy PRSM 5».
 *
 * Ссылка на подпись здесь публична намеренно — она ничем не привязана к
 * отправителю: это просто покупка на кривой, и подписывает её тот, кто
 * нажмёт, своим кошельком. Продажа так работать не может, поэтому её
 * отправляют в личку.
 */
async function inlineBuy(query, части) {
  const { запрос, сумма } = разобратьПокупку(части);

  if (!запрос) {
    await tg("answerInlineQuery", {
      inline_query_id: query.id,
      cache_time: 60,
      results: [{
        type: "article",
        id: "buy-help",
        title: "Покупка: укажи токен и сумму",
        description: `@${TG_BOT} buy CA СУММА`,
        thumbnail_url: ЗНАЧОК,
        input_message_content: {
          message_text: [
            `<code>@${TG_BOT} buy EQ… 5</code> — CA токена и сумма`,
            "",
            "По тикеру покупка не идёт: одно и то же название носит сколько угодно токенов.",
            `Найти нужный: <code>@${TG_BOT} PRSM</code>`,
          ].join("\n"),
          parse_mode: "HTML",
        },
      }],
    });
    return;
  }

  // Тикер к покупке не принимаем: занять его может кто угодно, и деньги
  // ушли бы в чужой токен. Отправляем искать — там карточки с адресами
  // и кнопка «Торговать» у каждой.
  if (!looksLikeAddress(запрос)) {
    await tg("answerInlineQuery", {
      inline_query_id: query.id,
      cache_time: 20,
      results: [{
        type: "article",
        id: "buy-need-address",
        title: "Для покупки нужен CA токена",
        description: `Тикер могут носить разные токены. Найди нужный: @${TG_BOT} ${запрос}`,
        thumbnail_url: ЗНАЧОК,
        input_message_content: {
          message_text: [
            `Покупка по тикеру не идёт: <b>${String(запрос).toUpperCase()}</b> может носить любой токен.`,
            "",
            `Найти нужный: <code>@${TG_BOT} ${запрос}</code> — и купить кнопкой в его карточке.`,
            `Или сразу по CA: <code>@${TG_BOT} buy EQ… 5</code>`,
          ].join("\n"),
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
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
  // Ни кривой, ни адреса жетона — торговать нечем, остаётся приложение.
  if (!card.curve && !card.jetton) {
    await tg("answerInlineQuery", {
      inline_query_id: query.id,
      cache_time: 20,
      results: [{
        type: "article",
        id: "buy-app",
        title: `$${card.ticker || ""} — торгуется в приложении`,
        description: "Отправить карточку токена",
        thumbnail_url: card.thumb || ЗНАЧОК,
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
  // Готовый расчёт кладём в сообщение только для кривой: её ссылка ни к
  // кому не привязана. Своп на бирже собирается под кошелёк покупателя,
  // и в общем чате такой ссылке не место — заплатит один, а токены
  // придут другому. Там сумму выбирают кнопкой, и расчёт уходит в личку.
  const результат = сумма > 0 && card.curve
    ? {
      type: "article",
      id: `buy-${сумма}`,
      title: `Купить $${card.ticker || ""} на ${сумма} TON`,
      description: "Расчёт и подпись в кошельке",
      thumbnail_url: card.thumb || ЗНАЧОК,
      input_message_content: {
        message_text: await сообщениеПокупки(card, сумма),
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      },
      reply_markup: { inline_keyboard: [
        // В чужом чате web_app-кнопки нет, поэтому через бота: он
        // откроет приложение с этой же суммой и позовёт кошелёк.
        [{ text: `💳 Купить · ${сумма} TON`, url: `https://t.me/${TG_BOT}?start=${меткаПокупки(card.ref, сумма)}` }],
        [{ text: "← К токену", callback_data: `x:${card.ref}` }],
      ] },
    }
    : {
      type: "article",
      id: "buy-pick",
      title: `Купить $${card.ticker || ""}`,
      description: "Выбрать сумму в чате",
      thumbnail_url: card.thumb || ЗНАЧОК,
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
            `<code>@${TG_BOT} buy PRSM 5</code> — покупка по тикеру или адресу: расчёт и подпись в кошельке`,
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
  // Первые три собираем со сводкой — и все три разом. Раньше они шли по
  // очереди, и на каждую уходил свой поход в сеть: подсказка успевала
  // истечь раньше, чем собиралась третья карточка.
  const подробности = await Promise.all(
    найдено.slice(0, 3).map((т) => cardFor(т).catch(() => null)),
  );

  const карточки = [];
  for (const [i, токен] of найдено.entries()) {
    // Сводка идёт в цепочку и на биржу — любая из них может не
    // ответить. Молчать всем списком из-за одного токена нельзя:
    // тогда в чате пусто, будто ничего не нашлось.
    const подробно = i < 3 ? подробности[i] : null;
    if (подробно) {
      карточки.push(подробно);
    } else {
      const адрес = токен.external ? `pool=${токен.pool_address}` : `token=${токен.id}`;
      const метка = токен.external ? `pool_${токен.pool_address}` : `tok_${токен.id}`;
      карточки.push({
        ref: токен.external ? `p:${токен.pool_address}` : `t:${токен.id}`,
        title: `$${String(токен.ticker || "").toUpperCase()} — ${токен.name || ""}`,
        description: "Открыть карточку",
        text: `${токен.emoji || (токен.external ? "🪙" : "🚀")} <b>${токен.name || ""}</b>  $${String(токен.ticker || "").toUpperCase()}`,
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
    thumbnail_url: c.thumb || ЗНАЧОК,
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
      ? {
        text: ТЕСТОВАЯ ? "Пусто — тестовая сеть, открыть Mintly" : "Ничего не нашлось — открыть Mintly",
        web_app: { url: APP_URL },
      }
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
      text: (ТЕСТОВАЯ
        ? "Ничего не нашлось. Проверь тикер или пришли CA токена."
        : "Ничего не нашлось — ни в Mintly, ни на биржах TON. Проверь тикер или пришли CA токена.") + ПОДСКАЗКА_СЕТИ,
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
    await tg("sendMessage", { chat_id: chat.id, text: `Пока пусто — ни одного токена.${ПОДСКАЗКА_СЕТИ}` });
    return;
  }
  const строки = найдено.map((t, i) => {
    const хвост = t.external ? " · с биржи" : "";
    return `${i + 1}. ${t.emoji || (t.external ? "🪙" : "🚀")} <b>$${String(t.ticker || "").toUpperCase()}</b> — ${t.name || ""}${хвост}`;
  });
  await tg("sendMessage", {
    chat_id: chat.id,
    reply_to_message_id: message.message_id,
    text: [
      "🔥 <b>Топ мемкоинов за последнее время</b>",
      "",
      "Какие мемкоины сейчас забирают внимание рынка? 👀",
      "",
      ...строки,
      "",
      "🔎 Хочешь подробнее узнать о токене?",
      "Пиши: <code>/token ТИКЕР</code>",
    ].join("\n"),
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
      `<code>@${TG_BOT} PRSM</code> — карточка токена в любом чате, добавлять бота туда не нужно`,
      `<code>@${TG_BOT} buy EQAw…cuNT 5</code> — покупка прямо в переписке`,
      "<code>/token PRSM</code> — цена, движение, путь до биржи",
      "<code>/top</code> — кто собрал больше всех",
      "<code>/menu</code> — кошелёк и всё остальное",
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
    // Ни списка команд, ни пересказа кнопок: они и так на экране. Тут
    // только про место — зачем оно и что здесь можно сделать.
    text: [
      "<b>Добро пожаловать в Mintly</b>",
      "",
      "Твой инструмент для запуска токенов — без комиссии.",
      "",
      "Создавай токены",
      "Торгуй чужими",
      "Запускай за 1 клик с 0% комиссии.",
      "",
      "Mintly — твой лучший помощник в торговле.",
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
    "<b>💼 Кошелёк Mintly</b>",
    "",
    "🔗 <b>Адрес</b>",
    `<code>${адрес}</code>`,
    "",
    "💎 <b>Баланс</b>",
    `${ton == null ? "—" : ton.toFixed(3)} TON`,
  ];
  if (список && список.length) {
    строки.push("");
    строки.push("🪙 <b>Токены</b>");
    for (const ж of список.slice(0, 12)) {
      const шт = ж.amount >= 1000 ? Math.round(ж.amount).toLocaleString("ru-RU") : ж.amount.toFixed(2);
      // Тикер всегда с долларом: так он читается как тикер, а не как
      // случайное слово рядом с числом.
      строки.push(`• $${String(ж.symbol || "?").toUpperCase()} — ${шт}`);
    }
    if (список.length > 12) строки.push(`…и ещё ${список.length - 12}`);
  } else {
    строки.push("");
    строки.push("🪙 <b>Токены</b>");
    строки.push("Пока пусто.");
  }
  строки.push("");
  строки.push("━━━━━━━━━━━━━━");
  строки.push("💡 Управляй своими активами прямо в Mintly.");

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
    // «buy_x50_t_<id>» — сумма в сотых впереди, дальше вид и ключ.
    let хвост = payload.slice(4);
    let сумма = 0;
    const сСуммой = хвост.match(/^x(\d+)_([\s\S]+)$/);
    if (сСуммой) {
      сумма = Number(сСуммой[1]) / 100;
      хвост = сСуммой[2];
    }
    const вид = хвост.startsWith("p_") ? "p" : хвост.startsWith("t_") ? "t" : null;
    const ключ = вид ? хвост.slice(2) : null;
    if (вид && ключ) {
      let card = null;
      try { card = await cardByRef(вид, ключ); } catch (err) { card = null; }
      if (card) {
        // Сумму назвали заранее — открываем сразу подпись, без выбора.
        const кнопки = сумма > 0 && card.curve
          ? { inline_keyboard: [
            [{ text: `💳 Купить · ${сумма} TON`, web_app: { url: `${card.link}&buy=${сумма}&auto=1` } }],
                [{ text: "Другая сумма", callback_data: `b:${card.ref}` }],
          ] }
          : (card.curve || card.jetton) ? buyButtons(card, true) : tokenButtons(card, true);
        await tg("sendMessage", {
          chat_id: message.chat.id,
          text: сумма > 0 && card.curve ? await сообщениеПокупки(card, сумма) : card.text,
          parse_mode: "HTML",
          link_preview_options: сумма > 0 && card.curve
            ? { is_disabled: true }
            : card.chart
              ? { url: card.chart, prefer_large_media: true, show_above_text: true }
              : { is_disabled: true },
          reply_markup: кнопки,
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
