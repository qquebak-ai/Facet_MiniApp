/* Картинка «Мемкоины в тренде» — та, что уходит над списком /top.
 *
 * В отличие от приветствия она собирается заново на каждый запрос: в ней
 * живые пятеро, отобранные по обороту за сутки, и обе сети вперемешку —
 * поэтому у каждой строки стоит значок своей цепочки.
 *
 * Здесь — черновик для оценки: тот же код, но данные читаются напрямую из
 * базы, а растр делает браузер из песочницы. На сервере вместо браузера
 * будет resvg, разметка та же.
 *
 * Запуск:  node scripts/make-top.mjs
 * Выход:   /tmp/top.png
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const корень = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const Ц = {
  фон: "#070A16",
  фонНиз: "#050710",
  плашка: "#0E1428",
  обвод: "#1B2545",
  текст: "#F4F6FB",
  тусклый: "#8C97C4",
  акцент: "#6C7CFF",
  светлый: "#CFCBFF",
  ton: "#0098EA",
  sol1: "#9945FF",
  sol2: "#14F195",
  рост: "#2ED47A",
  падение: "#FF5C6C",
};

const шрифт = "Montserrat, 'Segoe UI', Arial, sans-serif";

function листИзПриложения() {
  const исходник = fs.readFileSync(path.join(корень, "src", "App.tsx"), "utf8");
  const начало = исходник.indexOf("const LEAF_KINDS");
  const блок = исходник.slice(начало, исходник.indexOf("\n];", начало));
  return {
    outline: блок.split('outline: "')[3].split('"')[0],
    veins: блок.split("veins: [")[3].split("]")[0].split('"').filter((с) => с.trim().startsWith("M")),
  };
}
const лист = листИзПриложения();

function веточка(x, y, угол, высота, цвет, прозрачность = 1) {
  const s = высота / 30;
  return `<g transform="translate(${x}, ${y}) rotate(${угол}) scale(${s.toFixed(3)})" opacity="${прозрачность}">
    <path d="${лист.outline}" fill="${цвет}"/>
    <g fill="none" stroke="${Ц.фон}" stroke-opacity="0.4" stroke-width="0.6" stroke-linecap="round">
      ${лист.veins.map((ж) => `<path d="${ж}"/>`).join("")}
    </g>
  </g>`;
}

function шрифтВнутрь() {
  const набор = (имя, диапазон) => {
    const b64 = fs.readFileSync(path.join(корень, "scripts", "fonts", имя)).toString("base64");
    return `@font-face{font-family:Montserrat;font-style:normal;font-weight:100 900;
      src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${диапазон};}`;
  };
  return `<style>
    ${набор("montserrat-latin.woff2", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215")}
    ${набор("montserrat-cyrillic.woff2", "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116")}
  </style>`;
}

/* Шапка — готовая картинка.
 *
 * Всё, что в ней есть, от запроса к запросу не меняется: знак, огонёк,
 * заголовок и монеты. Рисовать это вектором заново — держать вторую,
 * заведомо более бедную версию того же самого; поэтому берём готовую и
 * вшиваем в разметку, а кодом собираем только список.
 *
 * Файл лежит в public: он же раздаётся сайтом, и подменить его можно, не
 * трогая код. */
const шапкаКартинка = fs.readFileSync(path.join(корень, "public", "top-header.png")).toString("base64");
const ШАПКА_Ш = 1190;
const ШАПКА_В = 455;

/* Знак сети рядом с токеном:/* Знак сети рядом с токеном: по нему видно, в какой цепочке он живёт.
   Без него две ленты в одном списке не различить. */
function знакСети(сеть, x, y, r = 17) {
  if (сеть === "solana") {
    return `<g transform="translate(${x}, ${y})">
      <circle r="${r}" fill="#150F2B" stroke="${Ц.sol1}" stroke-opacity="0.8" stroke-width="1.5"/>
      <g transform="translate(-9.5, -7) scale(0.048)" fill="url(#солГрад)">
        <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
        <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
        <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
      </g>
    </g>`;
  }
  return `<g transform="translate(${x}, ${y})">
    <circle r="${r}" fill="${Ц.ton}"/>
    <g transform="translate(-11, -11) scale(0.39)" fill="#ffffff">
      <path d="M37.56 15.63H18.44c-3.52 0-5.74 3.79-3.98 6.86l11.8 20.45c.77 1.34 2.7 1.34 3.47 0l11.8-20.45c1.77-3.06-.45-6.86-3.97-6.86zM26.25 36.81l-2.57-4.98-6.2-11.09c-.41-.71.1-1.62.95-1.62h7.82v17.69zm12.26-16.07l-6.2 11.1-2.57 4.97V19.12h7.82c.85 0 1.36.91.95 1.62z"/>
    </g>
  </g>`;
}

const деньги = (v) => {
  const n = Number(v) || 0;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const экран = (с) => String(с || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Логотип монеты. Картинку вшиваем прямо в разметку: растровщик на
   сервере в сеть не ходит, да и ждать чужие домены при отрисовке нельзя.
   Не отдалась — рисуем кружок с двумя буквами тикера, как в приложении. */
async function логотип(url, тикер, r) {
  if (url) {
    try {
      const ответ = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (ответ.ok) {
        const тип = ответ.headers.get("content-type") || "image/png";
        const b64 = Buffer.from(await ответ.arrayBuffer()).toString("base64");
        return `<image href="data:${тип};base64,${b64}" x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}"
          preserveAspectRatio="xMidYMid slice" clip-path="circle(${r}px at ${r}px ${r}px)"/>`;
      }
    } catch { /* чужой сервер молчит — не беда */ }
  }
  return `<circle r="${r}" fill="#1A2140"/>
    <text y="${r * 0.34}" text-anchor="middle" fill="${Ц.тусклый}" font-family="${шрифт}"
      font-size="${r * 0.8}" font-weight="700">${экран(String(тикер || "?").slice(0, 2).toUpperCase())}</text>`;
}

async function нарисовать(строки) {
  const Ш = 1080;
  // Высота шапки — от ширины: картинка ложится во всю ширину без обрезки.
  const шапка = Math.round((ШАПКА_В * Ш) / ШАПКА_Ш);
  const шагСтроки = 128;
  const В = шапка + 26 + строки.length * шагСтроки + 90;

  const плашки = [];
  for (let i = 0; i < строки.length; i++) {
    const т = строки[i];
    const y = шапка + 26 + i * шагСтроки;
    const лого = await логотип(т.лого, т.тикер, 38);
    плашки.push(`<g transform="translate(60, ${y})">
      <rect width="960" height="104" rx="52" fill="${Ц.плашка}" stroke="${Ц.обвод}" stroke-width="1.5"/>
      <circle cx="66" cy="52" r="30" fill="#131A33"/>
      <text x="66" y="62" text-anchor="middle" fill="${Ц.светлый}" font-family="${шрифт}" font-size="27" font-weight="800">${i + 1}</text>
      <g transform="translate(158, 52)">${лого}</g>
      ${знакСети(т.сеть, 186, 78, 16)}
      <text x="222" y="46" fill="${Ц.текст}" font-family="${шрифт}" font-size="34" font-weight="800">$${экран(т.тикер)}</text>
      <text x="222" y="78" fill="${Ц.тусклый}" font-family="${шрифт}" font-size="22" font-weight="500">${экран(т.имя)}</text>
      <text x="900" y="46" text-anchor="end" fill="${т.движение >= 0 ? Ц.рост : Ц.падение}" font-family="${шрифт}"
        font-size="28" font-weight="700">${т.движение >= 0 ? "+" : ""}${т.движение.toFixed(1)}%</text>
      <text x="900" y="78" text-anchor="end" fill="${Ц.тусклый}" font-family="${шрифт}" font-size="21" font-weight="500">${деньги(т.объём)} за сутки</text>
    </g>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Ш}" height="${В}" viewBox="0 0 ${Ш} ${В}">
  ${шрифтВнутрь()}
  <defs>
    <linearGradient id="фон" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#060A19"/>
      <stop offset="55%" stop-color="#070B1B"/>
      <stop offset="100%" stop-color="#04060F"/>
    </linearGradient>
    <radialGradient id="зарево" cx="0.72" cy="0.16" r="0.55">
      <stop offset="0%" stop-color="${Ц.акцент}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="${Ц.акцент}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="стык" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0A1024" stop-opacity="1"/>
      <stop offset="100%" stop-color="#0A1024" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="солГрад" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="${Ц.sol1}"/>
      <stop offset="100%" stop-color="${Ц.sol2}"/>
    </linearGradient>
    <linearGradient id="название" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0%" stop-color="${Ц.текст}"/>
      <stop offset="100%" stop-color="${Ц.светлый}"/>
    </linearGradient>
    <linearGradient id="ребро-тон" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#7FD8FF"/>
      <stop offset="100%" stop-color="#0A79C4"/>
    </linearGradient>
    <linearGradient id="поле-тон" x1="0.3" y1="0" x2="0.7" y2="1">
      <stop offset="0%" stop-color="#1FA6EE"/>
      <stop offset="100%" stop-color="#02598F"/>
    </linearGradient>
    <radialGradient id="свечение-тон" cx="0.5" cy="0.5" r="0.5">
      <stop offset="40%" stop-color="${Ц.ton}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${Ц.ton}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ребро-сол" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#C6A6FF"/>
      <stop offset="60%" stop-color="#8455E8"/>
      <stop offset="100%" stop-color="#37E3B4"/>
    </linearGradient>
    <linearGradient id="поле-сол" x1="0.3" y1="0" x2="0.7" y2="1">
      <stop offset="0%" stop-color="#2A1B4E"/>
      <stop offset="100%" stop-color="#150E2A"/>
    </linearGradient>
    <radialGradient id="свечение-сол" cx="0.5" cy="0.5" r="0.5">
      <stop offset="40%" stop-color="${Ц.sol1}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="${Ц.sol1}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ребро-тьма" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#586AB8"/>
      <stop offset="100%" stop-color="#222A54"/>
    </linearGradient>
    <linearGradient id="поле-тьма" x1="0.3" y1="0" x2="0.7" y2="1">
      <stop offset="0%" stop-color="#2A3363"/>
      <stop offset="100%" stop-color="#141931"/>
    </linearGradient>
    <radialGradient id="свечение-тьма" cx="0.5" cy="0.5" r="0.5">
      <stop offset="40%" stop-color="${Ц.акцент}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${Ц.акцент}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="огонь" x1="0" y1="1" x2="0.4" y2="0">
      <stop offset="0%" stop-color="#4B5BFF"/>
      <stop offset="100%" stop-color="#9AA5FF"/>
    </linearGradient>
  </defs>

  <rect width="${Ш}" height="${В}" fill="url(#фон)"/>
  <image href="data:image/png;base64,${шапкаКартинка}" x="0" y="0" width="${Ш}" height="${шапка}"/>
  <!-- Свечение шапки продолжается вниз и гаснет: без этого на её нижнем
       крае была видна ступенька — картинка чуть светлее фона. -->
  <rect x="0" y="${шапка - 2}" width="${Ш}" height="96" fill="url(#стык)"/>

  ${плашки.join("\n  ")}

  <text x="${Ш / 2}" y="${В - 36}" text-anchor="middle" fill="${Ц.тусклый}" font-family="${шрифт}"
    font-size="24" font-weight="500" opacity="0.75">mintly.company</text>
</svg>
`;
}

/* ---------- данные ---------- */

const env = Object.fromEntries(
  fs.readFileSync(path.join(корень, ".env"), "utf8").split("\n").filter(Boolean).map((с) => {
    const i = с.indexOf("=");
    return [с.slice(0, i).trim(), с.slice(i + 1).trim()];
  })
);
const кл = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

/* Пятёрка собирается из обеих сетей, а не просто по обороту подряд:
   Solana торгует на порядок больше, и общий список выходил бы целиком
   из неё — а показать нужно обе. Поэтому берём лучших в каждой и
   сводим вместе.
   Одинаковые тикеры схлопываем: у токена бывает несколько пулов, и
   список превращался в один и тот же STONK дважды. */
async function лучшие(цепь, сколько) {
  const { data } = await кл
    .from("feed_cache")
    .select("chain, name, ticker, logo_url, vol24, change24")
    .eq("chain", цепь)
    .order("vol24", { ascending: false })
    .limit(40);
  const видели = new Set();
  const итог = [];
  for (const r of data || []) {
    if (!r.ticker || !r.name) continue;
    const т = String(r.ticker).toUpperCase().slice(0, 10);
    if (видели.has(т)) continue;
    видели.add(т);
    итог.push({
      сеть: цепь === "solana" ? "solana" : "ton",
      имя: String(r.name).slice(0, 28),
      тикер: т,
      лого: r.logo_url,
      объём: Number(r.vol24) || 0,
      движение: Number(r.change24) || 0,
    });
    if (итог.length >= сколько) break;
  }
  return итог;
}

const [сол, тон] = await Promise.all([лучшие("solana", 3), лучшие("ton", 2)]);
const строки = [...сол, ...тон].sort((a, b) => b.объём - a.объём);

const svg = await нарисовать(строки);
fs.writeFileSync("/tmp/top.svg", svg);

const { chromium } = await import("playwright-core");
const браузер = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const высота = Number(svg.match(/height="(\d+)"/)[1]);
const стр = await браузер.newPage({ viewport: { width: 1080, height: высота }, deviceScaleFactor: 1 });
await стр.goto("file:///tmp/top.svg");
await стр.waitForTimeout(600);
await стр.screenshot({ path: "/tmp/top.png" });
await браузер.close();
console.log(`/tmp/top.png — 1080×${высота}, строк ${строки.length}`);
