/* Аватарка бота.
 *
 * Прежняя не работала там, где её видят. Аватарка живёт в списке чатов
 * размером в сорок точек, а на ней был лист с девятью прожилками,
 * вписанный в квадрат со скруглением: круг Telegram срезал углы этого
 * квадрата, прожилки сливались в тёмное пятно, и от знака оставалась
 * фиолетовая клякса. Плюс сам фиолетовый был не наш — в приложении
 * акцент #6C7CFF, а не сиреневый.
 *
 * Правило простое: то, что не читается в сорок точек, на аватарке
 * лишнее. Поэтому здесь силуэт листа во весь круг, одна жилка вместо
 * девяти и никакой внутренней рамки — круг задаёт Telegram, второй
 * контур внутри только съедает место.
 *
 * Форма листа взята из приложения (LEAF_KINDS[2] в src/App.tsx): знак
 * должен совпадать с тем, что человек увидит внутри.
 *
 * Запуск:  node scripts/make-avatar.mjs
 * Выход:   public/avatar-<вариант>.svg + .png, 512×512
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const корень = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const Ц = {
  фон: "#08090B",
  тёмный: "#0E1017",
  акцент: "#6C7CFF",
  светлый: "#9AA5FF",
  рост: "#2ED47A",
};

/* Лист из приложения. Координаты его собственные: примерно 26 в ширину
   и 32 в высоту, черешок ниже нуля, вершина в -32. */
const ЛИСТ = "M 0.00 -0.00 Q 4.67 -1.95 5.32 -3.00 Q 8.54 -4.95 8.11 -6.00 Q 10.76 -7.95 9.61 -9.00 Q 11.63 -10.95 10.01 -12.00 Q 11.29 -13.95 9.41 -15.00 Q 9.93 -16.95 7.97 -18.00 Q 7.71 -19.95 5.84 -21.00 Q 4.83 -22.95 3.18 -24.00 Q 1.42 -25.95 0.00 -27.00 Q -1.66 -25.05 -1.90 -24.00 Q -3.71 -22.05 -3.43 -21.00 Q -5.46 -19.05 -4.73 -18.00 Q -6.86 -16.05 -5.73 -15.00 Q -7.78 -13.05 -6.32 -12.00 Q -8.06 -10.05 -6.55 -9.00 Q -8.31 -7.05 -6.79 -6.00 Q -8.13 -3.95 -5.06 -3.00 Q -4.44 -1.95 0.00 -0.00 Z";
const ЖИЛКА = "M 0 -1.6 Q 0.5 -14 0 -25.4";
const ЧЕРЕШОК = "M 0 -0.2 Q -0.6 2.0 -1.4 4.2";

const Р = 512;                 // сторона картинки
const центр = Р / 2;

/* Масштаб листа. Аватарку обрезают в круг, и знак должен жить внутри
   него с запасом: у самого края Telegram кладёт своё кольцо выделения,
   и упёртый в край лист выглядит обрезанным. */
function лист({ высота, повернуть = 0, цвет, жилкаЦвет, толщинаЖилки }) {
  const s = высота / 31;
  // Лист рисуется от черешка вверх, поэтому его середина — примерно на
  // -13.5 своих единиц; сдвигаем на неё, чтобы знак встал по центру.
  const сдвиг = 13.5 * s;
  return `  <g transform="translate(${центр} ${центр + сдвиг}) rotate(${повернуть}) scale(${s.toFixed(3)})">
    <path d="${ЧЕРЕШОК}" fill="none" stroke="${цвет}" stroke-width="${(4.2 / s).toFixed(2)}" stroke-linecap="round"/>
    <path d="${ЛИСТ}" fill="${цвет}"/>
    <path d="${ЖИЛКА}" fill="none" stroke="${жилкаЦвет}" stroke-width="${(толщинаЖилки / s).toFixed(2)}" stroke-linecap="round"/>
  </g>`;
}

const общиеОпределения = `  <defs>
    <linearGradient id="лист" x1="0" y1="1" x2="0.4" y2="0">
      <stop offset="0%" stop-color="${Ц.акцент}"/>
      <stop offset="100%" stop-color="${Ц.светлый}"/>
    </linearGradient>
    <radialGradient id="аура" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0%" stop-color="${Ц.акцент}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${Ц.акцент}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="подложка" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="${Ц.акцент}"/>
      <stop offset="100%" stop-color="#4B57D8"/>
    </linearGradient>
  </defs>`;

const рамка = (тело) => `<svg xmlns="http://www.w3.org/2000/svg" width="${Р}" height="${Р}" viewBox="0 0 ${Р} ${Р}">
${общиеОпределения}
${тело}
</svg>
`;

/* --- Вариант «тёмный»: светлый лист на почти чёрном --------------------
   В списке чатов кружки соседей чаще светлые, и тёмный среди них
   заметнее любого цветного. */
const тёмный = рамка(`  <rect width="${Р}" height="${Р}" fill="${Ц.фон}"/>
  <circle cx="${центр}" cy="${центр}" r="${центр}" fill="url(#аура)"/>
${лист({ высота: 300, цвет: "url(#лист)", жилкаЦвет: Ц.фон, толщинаЖилки: 6.5 })}`);

/* --- Вариант «светлый»: тёмный лист на фирменном ----------------------
   Обратный ход: цветной кружок в ленте серых. Виден дальше, но и
   кричит громче. */
const светлый = рамка(`  <rect width="${Р}" height="${Р}" fill="url(#подложка)"/>
${лист({ высота: 300, цвет: Ц.фон, жилкаЦвет: "#8791F2", толщинаЖилки: 6.5 })}`);

/* --- Вариант «шкала»: лист внутри кольца до листинга -------------------
   Кольцо — то самое, что человек видит на карточке токена: путь до
   биржи. Знак получается про эту площадку, а не про «что-то про
   природу», и при этом остаётся простым: дуга по краю читается даже
   тогда, когда сам лист уже превратился в пятно.

   Дуга обрывается, а не замыкается: замкнутое кольцо означало бы, что
   всё уже случилось. */
function дуга(доля) {
  const r = 226;
  const угол = -90 + доля * 360;
  const рад = (угол * Math.PI) / 180;
  const x = центр + r * Math.cos(рад);
  const y = центр + r * Math.sin(рад);
  const больше = доля > 0.5 ? 1 : 0;
  return `M ${центр} ${центр - r} A ${r} ${r} 0 ${больше} 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
}

const шкала = рамка(`  <rect width="${Р}" height="${Р}" fill="${Ц.фон}"/>
  <circle cx="${центр}" cy="${центр}" r="${центр}" fill="url(#аура)"/>
  <circle cx="${центр}" cy="${центр}" r="226" fill="none" stroke="#1B1F28" stroke-width="18"/>
  <path d="${дуга(0.84)}" fill="none" stroke="${Ц.акцент}" stroke-width="18" stroke-linecap="round"/>
${лист({ высота: 246, цвет: "url(#лист)", жилкаЦвет: Ц.фон, толщинаЖилки: 6 })}`);

const варианты = [
  { имя: "avatar-dark", svg: тёмный },
  { имя: "avatar-light", svg: светлый },
  { имя: "avatar-ring", svg: шкала },
];

const сделанные = [];
for (const в of варианты) {
  const файл = path.join(корень, "public", `${в.имя}.svg`);
  fs.writeFileSync(файл, в.svg);
  сделанные.push({ ...в, файл });
  console.log(`public/${в.имя}.svg — ${Р}×${Р}`);
}

/* PNG: Telegram принимает только растр. */
try {
  const { chromium } = await import("playwright-core");
  const браузер = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
  for (const с of сделанные) {
    const стр = await браузер.newPage({ viewport: { width: Р, height: Р } });
    await стр.goto(`file://${с.файл}`);
    await стр.waitForTimeout(300);
    await стр.screenshot({ path: path.join(корень, "public", `${с.имя}.png`) });
    await стр.close();
    console.log(`public/${с.имя}.png`);
  }

  /* Проверка на честность: то же самое, уменьшенное до сорока точек и
     обрезанное в круг, — ровно так знак и увидят в списке чатов. Если
     здесь получилось пятно, значит вариант не годится, сколько бы
     красиво он ни выглядел в полный размер. */
  const пробы = сделанные.map((с) => {
    const данные = fs.readFileSync(path.join(корень, "public", `${с.имя}.png`)).toString("base64");
    const src = `data:image/png;base64,${данные}`;
    return `<div style="display:flex;align-items:center;gap:16px;margin:12px 0">
    <img src="${src}" style="width:40px;height:40px;border-radius:50%">
    <img src="${src}" style="width:64px;height:64px;border-radius:50%">
    <img src="${src}" style="width:120px;height:120px;border-radius:50%">
    <span style="font:15px system-ui;color:#8B929D">${с.имя}</span>
  </div>`;
  }).join("\n");
  const стр = await браузер.newPage({ viewport: { width: 520, height: 460 } });
  await стр.setContent(`<body style="margin:0;padding:16px;background:#17181C">${пробы}</body>`);
  await стр.waitForTimeout(300);
  await стр.screenshot({ path: path.join(корень, "public", "avatar-preview.png") });
  await стр.close();
  console.log("public/avatar-preview.png — как это выглядит в списке чатов");

  await браузер.close();
} catch (e) {
  console.log(`PNG пропущены (${(e && e.message) || e}) — SVG на месте`);
}
