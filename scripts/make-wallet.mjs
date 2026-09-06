/* Картинка над кошельком в боте.
 *
 * Тот же приём, что у приветствия (scripts/make-start.mjs): знак, слово,
 * одна строка о сути. Разница в том, что здесь показывают не площадку, а
 * конкретный экран — кошелёк, — поэтому в середине сам кошелёк, а по
 * бокам две сети, из которых в него приходят деньги.
 *
 * Рисуется вектором, а не трёхмерной сценой: картинку в чате показывают
 * шириной с пузырь сообщения, и всё, что мельче крупного пятна, там
 * пропадает. Объём делается тем, что переживает такое уменьшение, —
 * заливкой с переходом, тенью и свечением.
 *
 * Запуск:  node scripts/make-wallet.mjs
 * Выход:   public/wallet.svg + .png — 1200×760
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const корень = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const Ц = {
  фон: "#08090B",
  панель: "#12141A",
  текст: "#F4F6FB",
  тусклый: "#9AA0B4",
  акцент: "#6C7CFF",
  светлый: "#CFCBFF",
  ton: "#0098EA",
  sol1: "#9945FF",
  sol2: "#14F195",
};

const шрифт = "Montserrat, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/* Лист берётся из приложения — тот же контур, что падает на фоне и
   растёт из знака. Своя копия здесь разъехалась бы с интерфейсом. */
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

/* Знак: буква M, из угла которой растут два листа. */
function знак() {
  return `<path d="M 12 92 V 20 L 50 62 L 88 20 V 92" fill="none" stroke="${Ц.акцент}"
      stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
    ${веточка(86, 26, 8, 42, Ц.светлый)}
    ${веточка(88, 26, 38, 32, "#9AA5FF")}`;
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

/* Монета сети: круг с ободком, свечением и знаком внутри. */
function монета(x, y, r, цвет, внутри, свет) {
  return `<g transform="translate(${x}, ${y})">
    <circle r="${r * 1.5}" fill="url(#${свет})"/>
    <circle r="${r}" fill="url(#${свет}-тело)" stroke="${цвет}" stroke-opacity="0.9" stroke-width="2"/>
    <circle r="${r}" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="1" transform="translate(0,-1)"/>
    ${внутри}
  </g>`;
}

const знакTON = `<g transform="translate(-27, -27) scale(0.96)">
  <path fill="#ffffff" d="M37.56 15.63H18.44c-3.52 0-5.74 3.79-3.98 6.86l11.8 20.45c.77 1.34 2.7 1.34 3.47 0l11.8-20.45c1.77-3.06-.45-6.86-3.97-6.86zM26.25 36.81l-2.57-4.98-6.2-11.09c-.41-.71.1-1.62.95-1.62h7.82v17.69zm12.26-16.07l-6.2 11.1-2.57 4.97V19.12h7.82c.85 0 1.36.91.95 1.62z"/>
</g>`;

const знакSOL = `<g transform="translate(-26, -20) scale(0.13)">
  <g fill="url(#сол)">
    <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
    <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
    <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
  </g>
</g>`;

/* Сам кошелёк. Корпус, отогнутая крышка с застёжкой и знак на боку —
   силуэт узнают с одного взгляда, а деталей больше и не нужно. */
function кошелёк(x, y) {
  return `<g transform="translate(${x}, ${y})">
    <ellipse cx="180" cy="250" rx="205" ry="26" fill="#000000" opacity="0.55"/>
    <rect x="0" y="0" width="360" height="240" rx="30" fill="url(#корпус)" stroke="${Ц.акцент}" stroke-opacity="0.5" stroke-width="2"/>
    <rect x="0" y="0" width="360" height="240" rx="30" fill="url(#блик)"/>
    <path d="M 10 176 H 350" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
    <!-- Застёжка: язычок с кнопкой, вынесенный за правый край. -->
    <rect x="250" y="86" width="128" height="72" rx="26" fill="url(#язычок)" stroke="${Ц.акцент}" stroke-opacity="0.45" stroke-width="2"/>
    <circle cx="344" cy="122" r="15" fill="#7C8BFF"/>
    <circle cx="344" cy="122" r="15" fill="url(#кнопка)"/>
    <!-- Знак на корпусе. -->
    <g transform="translate(112, 92) scale(0.62)">
      <path d="M 12 92 V 20 L 50 62 L 88 20 V 92" fill="none" stroke="#8EA0FF" stroke-width="17"
        stroke-linecap="round" stroke-linejoin="round"/>
      ${веточка(86, 26, 8, 40, "#CFCBFF")}
    </g>
  </g>`;
}

function нарисовать() {
  const Ш = 1200;
  const В = 760;

  // Слово с знаком вместо первой буквы — как в приветствии.
  const кегль = 92;
  const высотаЛитеры = кегль * 0.72;
  const масштаб = высотаЛитеры / 72;
  const ширинаЗнака = 76 * масштаб;
  const хвост = "intly";
  const ширинаХвоста = хвост.length * кегль * 0.5 + кегль * 0.3;
  const знакX = (Ш - (ширинаЗнака + ширинаХвоста)) / 2;
  const знакY = 150 - 92 * масштаб;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Ш}" height="${В}" viewBox="0 0 ${Ш} ${В}">
  ${шрифтВнутрь()}
  <defs>
    <radialGradient id="зарево" cx="0.5" cy="0.62" r="0.62">
      <stop offset="0%" stop-color="${Ц.акцент}" stop-opacity="0.30"/>
      <stop offset="45%" stop-color="${Ц.акцент}" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="${Ц.фон}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="название" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0%" stop-color="${Ц.текст}"/>
      <stop offset="100%" stop-color="${Ц.светлый}"/>
    </linearGradient>
    <linearGradient id="корпус" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="#2B3AC0"/>
      <stop offset="55%" stop-color="#1B2280"/>
      <stop offset="100%" stop-color="#141A5E"/>
    </linearGradient>
    <linearGradient id="язычок" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#33429E"/>
      <stop offset="100%" stop-color="#1A2166"/>
    </linearGradient>
    <linearGradient id="блик" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="кнопка" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="тон" cx="0.5" cy="0.5" r="0.5">
      <stop offset="55%" stop-color="${Ц.ton}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${Ц.ton}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="тон-тело" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#37B6FF"/>
      <stop offset="100%" stop-color="#0079C4"/>
    </linearGradient>
    <radialGradient id="сола" cx="0.5" cy="0.5" r="0.5">
      <stop offset="55%" stop-color="${Ц.sol1}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${Ц.sol1}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="сола-тело" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#241A44"/>
      <stop offset="100%" stop-color="#120E22"/>
    </linearGradient>
    <linearGradient id="сол" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="${Ц.sol1}"/>
      <stop offset="100%" stop-color="${Ц.sol2}"/>
    </linearGradient>

    <linearGradient id="нить-л" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${Ц.ton}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${Ц.акцент}" stop-opacity="0.15"/>
    </linearGradient>
    <linearGradient id="нить-п" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0%" stop-color="${Ц.sol1}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${Ц.акцент}" stop-opacity="0.15"/>
    </linearGradient>
  </defs>

  <rect width="${Ш}" height="${В}" fill="${Ц.фон}"/>
  <rect width="${Ш}" height="${В}" fill="url(#зарево)"/>

  <!-- Слово с знаком вместо первой буквы. -->
  <g transform="translate(${знакX}, ${знакY}) scale(${масштаб.toFixed(3)})">${знак()}</g>
  <text x="${знакX + ширинаЗнака + кегль * 0.3}" y="150" fill="url(#название)" font-family="${шрифт}"
    font-size="${кегль}" font-weight="800" letter-spacing="-0.02em">${хвост}</text>

  <text x="${Ш / 2}" y="238" text-anchor="middle" fill="${Ц.текст}" font-family="${шрифт}"
    font-size="52" font-weight="800">Твой крипто-кошелёк</text>
  <text x="${Ш / 2}" y="286" text-anchor="middle" fill="${Ц.тусклый}" font-family="${шрифт}"
    font-size="27" font-weight="500">TON и Solana — всё в одном месте</text>

  <!-- Нити от монет к кошельку: видно, что деньги стекаются сюда. -->
  <path d="M 250 470 C 340 470 380 500 420 508" fill="none" stroke="url(#нить-л)" stroke-width="3" stroke-linecap="round"/>
  <path d="M 950 470 C 860 470 820 500 780 508" fill="none" stroke="url(#нить-п)" stroke-width="3" stroke-linecap="round"/>

  ${кошелёк(420, 390)}

  ${монета(250, 470, 62, Ц.ton, знакTON, "тон")}
  ${монета(950, 470, 62, Ц.sol1, знакSOL, "сола")}

  <!-- Листья: те же, что падают в приложении. -->
  ${веточка(160, 560, -18, 54, Ц.акцент, 0.5)}
  ${веточка(330, 620, 24, 40, Ц.светлый, 0.35)}
  ${веточка(1040, 585, 16, 52, Ц.акцент, 0.45)}
  ${веточка(880, 640, -26, 38, Ц.светлый, 0.3)}

  <text x="${Ш / 2}" y="${В - 40}" text-anchor="middle" fill="${Ц.тусклый}" font-family="${шрифт}"
    font-size="23" font-weight="500" opacity="0.75">mintly.company</text>
</svg>
`;
}

const файл = path.join(корень, "public", "wallet.svg");
fs.writeFileSync(файл, нарисовать());
console.log("public/wallet.svg — 1200×760");

try {
  const { chromium } = await import("playwright-core");
  const браузер = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
  // Вдвое плотнее: Telegram пережимает картинку по-своему, и из одного
  // пикселя на точку выходит мыло на экранах с высокой плотностью.
  const стр = await браузер.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2 });
  await стр.goto(`file://${файл}`);
  await стр.waitForTimeout(400);
  await стр.screenshot({ path: path.join(корень, "public", "wallet.png") });
  await браузер.close();
  console.log("public/wallet.png");
} catch (e) {
  console.log(`PNG пропущен (${(e && e.message) || e}) — SVG на месте`);
}
