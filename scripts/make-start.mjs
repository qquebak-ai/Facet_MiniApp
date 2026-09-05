/* Картинка приветствия бота.
 *
 * То, что человек видит первым после /start, поэтому здесь нет ни
 * графиков, ни цифр: знак, название, одна строка о сути и два коротких
 * обещания. Всё, что сложнее, в ленте чата ужимается до нечитаемого —
 * картинку показывают шириной с пузырь сообщения.
 *
 * Цвета — палитра приложения (DARK_THEME в src/App.tsx), знак — тот же
 * контур листа, что рисуется в интерфейсе.
 *
 * Запуск:  node scripts/make-start.mjs
 * Выход:   public/start.svg + .png — 1200×740
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const корень = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const Ц = {
  фон: "#08090B",
  панель: "#12141A",
  линия: "#242833",
  текст: "#F4F6FB",
  тусклый: "#9AA0B4",
  акцент: "#6C7CFF",
  светлый: "#CFCBFF",
};

const шрифт = "Montserrat, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/* Знак: буква M, целиком набранная листьями.
 *
 * В public/logo.svg лист только один — росток во впадине буквы, а сами
 * штрихи нарисованы обводкой. Здесь каждый штрих сам лист: две ножки и
 * две диагонали, плюс тот же росток посередине. Форма листа — половинки
 * из logo.svg, перенесённые в свою систему координат (основание в нуле,
 * рост вверх), чтобы их можно было ставить под углом.
 */
const ЛИСТ_ЛЕВАЯ = "M 0 0 C -10 -6, -13 -18, -9 -30 C -1 -23, 1.5 -11, 0 0 Z";
const ЛИСТ_ПРАВАЯ = "M 0 0 C 10 -6, 13 -18, 9 -30 C 1 -23, -1.5 -11, 0 0 Z";

/* Штрихи буквы M в квадрате 64×64: откуда растёт лист и куда смотрит
   его остриё. Диагонали растут от верха ножек вниз к середине — так их
   острия сходятся в той самой впадине, по которой буква и узнаётся.
   Листья узкие: широкие сливаются в куст, и от M ничего не остаётся. */
const ШТРИХИ = [
  { от: [14, 58], до: [14, 25], ширина: 0.62 },
  { от: [50, 58], до: [50, 25], ширина: 0.62 },
  { от: [17, 29], до: [32, 49], ширина: 0.5 },
  { от: [47, 29], до: [32, 49], ширина: 0.5 },
];

function знакИзЛистьев() {
  const лист = (от, до, ширина, цвет) => {
    const dx = до[0] - от[0];
    const dy = до[1] - от[1];
    const длина = Math.hypot(dx, dy);
    // Лист нарисован растущим вверх, поэтому поворот считаем от вертикали.
    const угол = (Math.atan2(dx, -dy) * 180) / Math.PI;
    const масштаб = длина / 30;
    return `<g transform="translate(${от[0]}, ${от[1]}) rotate(${угол.toFixed(1)}) scale(${(масштаб * ширина).toFixed(3)}, ${масштаб.toFixed(3)})">
      <path d="${ЛИСТ_ЛЕВАЯ}" fill="${цвет}"/>
      <path d="${ЛИСТ_ПРАВАЯ}" fill="${цвет}"/>
      <path d="M 0 0 L 0 -29" fill="none" stroke="${Ц.фон}" stroke-width="${(1.1 / (масштаб * ширина)).toFixed(2)}" stroke-linecap="round"/>
    </g>`;
  };
  return ШТРИХИ.map((ш) => лист(ш.от, ш.до, ш.ширина, Ц.акцент)).join("\n    ");
}

/* Шрифт вшивается в сам SVG: без него браузер рисует Liberation Sans, и
   надпись выглядит казённо. Файлы лежат в репозитории (scripts/fonts),
   поэтому картинка собирается одинаково на любой машине и без сети. */
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

const Ш = 1200;
const В = 740;

function нарисовать() {
  const знак = знакИзЛистьев();

  const знакВысота = 150;
  const знакМасштаб = знакВысота / 64;           // logo.svg нарисован в квадрате 64×64
  const названиеКегль = 108;
  const знакX = Ш / 2 - 280;
  const знакY = 180;

  const подпись = "Запуск мемкоинов на TON и Solana — прямо в Telegram";
  const чипы = ["Свой токен за минуту", "Комиссия 1%"];
  const чипКегль = 26;
  const чипВысота = 62;
  const ширинаЧипа = (т) => Math.round(т.length * чипКегль * 0.62 + чипКегль * 2.6);
  const зазор = 22;
  const общаяШирина = чипы.reduce((с, т) => с + ширинаЧипа(т), 0) + зазор;
  let чипX = (Ш - общаяШирина) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Ш}" height="${В}" viewBox="0 0 ${Ш} ${В}">
  ${шрифтВнутрь()}
  <defs>
    <radialGradient id="зарево" cx="0.5" cy="0.34" r="0.6">
      <stop offset="0%" stop-color="${Ц.акцент}" stop-opacity="0.28"/>
      <stop offset="45%" stop-color="${Ц.акцент}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${Ц.фон}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="название" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0%" stop-color="${Ц.текст}"/>
      <stop offset="100%" stop-color="${Ц.светлый}"/>
    </linearGradient>
  </defs>

  <rect width="${Ш}" height="${В}" fill="${Ц.фон}"/>
  <rect width="${Ш}" height="${В}" fill="url(#зарево)"/>

  <!-- Знак и название — одной строкой, как подпись в шапке приложения. -->
  <g transform="translate(${знакX}, ${знакY}) scale(${знакМасштаб.toFixed(3)})">
    ${знак}
  </g>
  <text x="${знакX + знакВысота + 26}" y="${знакY + знакВысота * 0.72}" fill="url(#название)" font-family="${шрифт}"
    font-size="${названиеКегль}" font-weight="800" letter-spacing="-0.02em">Mintly</text>

  <text x="${Ш / 2}" y="${знакY + знакВысота + 110}" text-anchor="middle" fill="${Ц.тусклый}" font-family="${шрифт}"
    font-size="34" font-weight="500">${подпись}</text>

  ${чипы.map((т) => {
    const ш = ширинаЧипа(т);
    const x = чипX;
    чипX += ш + зазор;
    return `<g transform="translate(${x}, ${знакY + знакВысота + 170})">
    <rect width="${ш}" height="${чипВысота}" rx="${чипВысота / 2}" fill="${Ц.панель}" stroke="${Ц.акцент}" stroke-opacity="0.55"/>
    <text x="${ш / 2}" y="${чипВысота / 2 + чипКегль * 0.36}" text-anchor="middle" fill="${Ц.светлый}"
      font-family="${шрифт}" font-size="${чипКегль}" font-weight="600">${т}</text>
  </g>`;
  }).join("\n  ")}

  <text x="${Ш / 2}" y="${В - 70}" text-anchor="middle" fill="${Ц.тусклый}" font-family="${шрифт}"
    font-size="24" font-weight="500" opacity="0.75">mintly.company</text>
</svg>
`;
}

const файл = path.join(корень, "public", "start.svg");
fs.writeFileSync(файл, нарисовать());
console.log(`public/start.svg — ${Ш}×${В}`);

/* Растр рисует тот же браузер, что показывает страницы: значит и
   выглядеть будет так же, а не «примерно так». */
try {
  const { chromium } = await import("playwright-core");
  const браузер = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
  const стр = await браузер.newPage({ viewport: { width: Ш, height: В } });
  await стр.goto(`file://${файл}`);
  await стр.waitForTimeout(400);
  await стр.screenshot({ path: path.join(корень, "public", "start.png") });
  await браузер.close();
  console.log("public/start.png");
} catch (e) {
  console.log(`PNG пропущен (${(e && e.message) || e}) — SVG на месте`);
}
