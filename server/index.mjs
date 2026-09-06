/* Сервер приложения для своего железа.
 *
 * На Vercel каждый обработчик — отдельная функция, которая рождается на
 * запрос и умирает после ответа. Отсюда всё, что мешало: холодный старт
 * в секунду с лишним, кеш, живущий до конца одного ответа, лимит в
 * двенадцать функций на бесплатном тарифе и расписание раз в сутки.
 *
 * Здесь тот же код работает в постоянном процессе. Обработчики не
 * переписаны: они написаны как (req, res) и вызываются напрямую, а этот
 * файл лишь подаёт им запрос в привычном виде. Отсюда три выигрыша сами
 * собой:
 *
 *   • холодных стартов нет — процесс уже поднят;
 *   • кеш внутри api/chart.js наконец живёт по-настоящему: свечи и
 *     сделки отдаются из памяти за десятки миллисекунд;
 *   • обход ленты идёт своим циклом раз в несколько секунд, а не по
 *     расписанию чужого планировщика.
 *
 * Сайт при этом остаётся на CDN: сюда ходят только за API. Раздавать
 * статику с одного сервера — значит сделать её медленнее для всех, кто
 * далеко от него.
 *
 * Запуск:  node server/index.mjs
 * Порт:    PORT (по умолчанию 8080)
 */

import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const корень = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ПОРТ = Number(process.env.PORT) || 8080;

/* Кому разрешено обращаться. Браузер спросит об этом на каждом запросе с
   чужого домена, а домен у сайта и правда чужой: страницы отдаёт CDN, а
   API живёт здесь. */
const СВОИ = (process.env.ALLOW_ORIGINS || "https://mintly.company,https://www.mintly.company")
  .split(",")
  .map((с) => с.trim())
  .filter(Boolean);

/* Обработчики берём с диска: это те же файлы, что уходят на Vercel, и
   никакой отдельной копии для сервера не заводится — разъехаться им
   негде. Файлы с подчёркиванием — общие куски, а не маршруты. */
const каталог = path.join(корень, "api");
const маршруты = new Map();
for (const имя of fs.readdirSync(каталог)) {
  if (!имя.endsWith(".js") || имя.startsWith("_")) continue;
  маршруты.set(`/api/${имя.slice(0, -3)}`, path.join(каталог, имя));
}

const загружено = new Map();
async function обработчик(путь) {
  if (загружено.has(путь)) return загружено.get(путь);
  const файл = маршруты.get(путь);
  if (!файл) return null;
  const модуль = await import(pathToFileURL(файл).href);
  const ф = модуль.default;
  загружено.set(путь, ф);
  return ф;
}

/* Ответ в том виде, в каком его ждут обработчики: status().json(),
   setHeader(), send(). Разница с Vercel только в этих нескольких
   методах — сам Node их не даёт. */
function дополнить(res) {
  res.status = (код) => { res.statusCode = код; return res; };
  res.json = (тело) => {
    if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(тело));
    return res;
  };
  res.send = (тело) => {
    if (тело == null) { res.end(); return res; }
    if (Buffer.isBuffer(тело) || typeof тело === "string") { res.end(тело); return res; }
    return res.json(тело);
  };
  return res;
}

/* Тело запроса. Обработчики ждут его уже разобранным — так делает
   Vercel, — и json приходит объектом, а не строкой. */
function тело(req) {
  return new Promise((готово) => {
    if (req.method === "GET" || req.method === "HEAD") { готово(undefined); return; }
    const куски = [];
    let размер = 0;
    req.on("data", (к) => {
      размер += к.length;
      // Тело больше мегабайта к нам не приходит, а вот забить память
      // чужим потоком — вполне: обрываем.
      if (размер > 1024 * 1024) { req.destroy(); return; }
      куски.push(к);
    });
    req.on("end", () => {
      const сырое = Buffer.concat(куски).toString("utf8");
      if (!сырое) { готово(undefined); return; }
      const тип = String(req.headers["content-type"] || "");
      if (тип.includes("application/json")) {
        try { готово(JSON.parse(сырое)); } catch { готово(сырое); }
        return;
      }
      if (тип.includes("application/x-www-form-urlencoded")) {
        готово(Object.fromEntries(new URLSearchParams(сырое)));
        return;
      }
      готово(сырое);
    });
    req.on("error", () => готово(undefined));
  });
}

const сервер = http.createServer(async (req, res) => {
  const адрес = new URL(req.url, "http://x");
  дополнить(res);

  const откуда = req.headers.origin;
  if (откуда && СВОИ.includes(откуда)) {
    res.setHeader("Access-Control-Allow-Origin", откуда);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
    return;
  }

  // Проверка живости для nginx и мониторинга: отвечает без обращений к
  // базе и к чужим сервисам, чтобы не врать «жив» по чужой вине.
  if (адрес.pathname === "/health") {
    res.status(200).json({ ok: true, uptime: Math.round(process.uptime()) });
    return;
  }

  const ф = await обработчик(адрес.pathname);
  if (!ф) { res.status(404).json({ error: "not_found" }); return; }

  req.query = Object.fromEntries(адрес.searchParams);
  req.body = await тело(req);

  try {
    await ф(req, res);
  } catch (err) {
    console.error("[сервер]", адрес.pathname, err && err.message);
    if (!res.headersSent) res.status(500).json({ error: "internal" });
    else res.end();
  }
});

/* Соединение держим дольше, чем nginx.
 *
 * Nginx переиспользует открытые соединения к нам, а node по умолчанию
 * закрывает их через пять секунд. Кто успел первым — тот и прав: nginx
 * отправлял запрос в соединение, которое мы в этот момент закрывали, и
 * отвечал 502, хотя приложение было живо и здорово. Поэтому наш срок
 * заведомо больше nginx-овского (у него по умолчанию 60 с), а заголовки
 * ждём ещё чуть дольше — иначе тот же обрыв случится этажом выше. */
сервер.keepAliveTimeout = 65000;
сервер.headersTimeout = 66000;

сервер.listen(ПОРТ, () => console.log(`[сервер] порт ${ПОРТ}, маршрутов ${маршруты.size}`));

/* Обход ленты — своим циклом.
 *
 * Раньше его звал чужой планировщик по расписанию, и однажды он молчал
 * сутки, никем не замеченный. Здесь обход просто идёт по кругу: сети по
 * очереди, чтобы не выбирать лимит источника залпом, и с паузой, которую
 * можно задать одной переменной. */
const ШАГ_ОБХОДА_МС = Number(process.env.FEED_INTERVAL_MS) || 10000;

if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.FEED_LOOP !== "0") {
  const сети = ["ton", "solana"];
  let i = 0;
  const шаг = async () => {
    const сеть = сети[i++ % сети.length];
    try {
      const ф = await обработчик("/api/refresh-feed");
      // Свой вызов идёт с секретом: обход по кругу не должен упираться
      // в защиту от частых просьб снаружи.
      const запрос = {
        method: "GET",
        url: `/api/refresh-feed?chain=${сеть}`,
        query: { chain: сеть },
        headers: { authorization: `Bearer ${process.env.CRON_SECRET || ""}` },
      };
      const ответ = дополнить({
        statusCode: 200,
        headersSent: false,
        setHeader() {},
        end() { this.headersSent = true; },
      });
      await ф(запрос, ответ);
    } catch (err) {
      console.warn("[обход]", сеть, err && err.message);
    } finally {
      setTimeout(шаг, ШАГ_ОБХОДА_МС);
    }
  };
  setTimeout(шаг, 2000);
  console.log(`[обход] цикл раз в ${ШАГ_ОБХОДА_МС} мс, сети по очереди`);
}

/* Уведомления о покупках — тем же способом.
 *
 * Их тоже звал чужой планировщик, и там же ломался: секрет в настройках
 * репозитория и секрет на площадке разъезжались, а видно это было только
 * в списке запусков красными крестиками. Здесь звать некому — обработчик
 * вызывается изнутри, и секрет заведомо тот же самый. */
const ШАГ_ВЕСТЕЙ_МС = Number(process.env.NOTIFY_INTERVAL_MS) || 10 * 60 * 1000;

if (process.env.TELEGRAM_BOT_TOKEN && process.env.NOTIFY_LOOP !== "0") {
  const весть = async () => {
    try {
      const ф = await обработчик("/api/notify");
      const ответ = дополнить({
        statusCode: 200,
        headersSent: false,
        setHeader() {},
        end() { this.headersSent = true; },
      });
      await ф(
        { method: "POST", url: "/api/notify", query: {}, body: {}, headers: { authorization: `Bearer ${process.env.CRON_SECRET || ""}` } },
        ответ
      );
    } catch (err) {
      console.warn("[вести]", err && err.message);
    } finally {
      setTimeout(весть, ШАГ_ВЕСТЕЙ_МС);
    }
  };
  setTimeout(весть, 30000);
  console.log(`[вести] цикл раз в ${Math.round(ШАГ_ВЕСТЕЙ_МС / 60000)} мин`);
}

for (const сигнал of ["SIGINT", "SIGTERM"]) {
  process.on(сигнал, () => {
    console.log(`[сервер] ${сигнал}, закрываемся`);
    сервер.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
