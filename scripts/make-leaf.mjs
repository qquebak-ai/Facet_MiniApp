/* Форма листа для приложения.
 *
 * Лист рисуется формулой, а не рукой: контур считается как полуширина
 * вдоль оси, к ней добавляются фестоны края, гаснущие у кончика и у
 * черешка, — и уже по этим точкам собирается гладкая кривая. Так форму
 * можно править числами (шире, острее, крупнее зубцы), а не
 * переставлять сотню координат в пути.
 *
 * Прежний контур был ступенчатым: край собирался из отрезков, и в
 * мелком размере лист выглядел обгрызенным. Здесь край волнистый и
 * плавный, а жилки — четыре пары дуг, отходящих от средней жилки.
 *
 * Запуск:  node scripts/make-leaf.mjs
 * Выход:   печатает готовый кусок для LEAF_KINDS в src/App.tsx
 *          и public/leaf-preview.png — как он выглядит в разных размерах
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const корень = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* --- Настройки формы --------------------------------------------------
   Все размеры в тех же единицах, что и прежний лист: высота около 28,
   полуширина около 10. Менять их — значит менять лист во всём
   приложении разом, от иконки до венка вокруг аватарки. */
const ДЛИНА = 27;        // от основания пластинки до кончика
const ШИРИНА = 9.3;      // наибольшая полуширина
const ФЕСТОНОВ = 10;     // волн по каждой стороне края
const ГЛУБИНА = 0.045;   // насколько волна выступает, долей ширины
const ТОЧЕК = 120;       // подробность обвода

/* Полуширина в доле пути от основания (0) к кончику (1).
   Степени подобраны под лист с фотографии: широкий в нижней трети,
   плавно сходящий к острому кончику. */
function полуширина(t) {
  const A = 0.5, B = 0.78;
  const форма = Math.pow(t, A) * Math.pow(1 - t, B);
  // Нормируем так, чтобы максимум равнялся ШИРИНЕ: иначе она означала
  // бы не ширину, а множитель, и подбирать её пришлось бы наугад.
  const tМакс = A / (A + B);
  const макс = Math.pow(tМакс, A) * Math.pow(1 - tМакс, B);
  return (форма / макс) * ШИРИНА;
}

/* Волна края. У кончика и у основания гаснет: там фестоны выглядели бы
   обкусанным краем, а не зубчиками. */
function фестон(t) {
  const затухание = Math.pow(Math.sin(Math.PI * t), 0.9);
  return 1 + ГЛУБИНА * Math.sin(ФЕСТОНОВ * 2 * Math.PI * t - Math.PI / 2) * затухание;
}

const точкаКрая = (t, знак) => {
  const y = -(t * ДЛИНА) - 1;                  // основание пластинки на -1
  const x = знак * полуширина(t) * фестон(t);
  return [x, y];
};

/* Гладкая кривая через точки: Catmull-Rom, переведённый в кубические
   Безье. Ломаная из ста отрезков весит столько же, но в мелком размере
   даёт рваный край. */
function гладкий(точки, замкнуть = false) {
  const P = точки;
  let d = `M ${P[0][0].toFixed(2)} ${P[0][1].toFixed(2)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return замкнуть ? `${d} Z` : d;
}

/* Обвод: вверх по правой стороне, вниз по левой. */
const правая = Array.from({ length: ТОЧЕК + 1 }, (_, i) => точкаКрая(i / ТОЧЕК, 1));
const левая = Array.from({ length: ТОЧЕК + 1 }, (_, i) => точкаКрая(1 - i / ТОЧЕК, -1));
const outline = гладкий([...правая, ...левая], true);

/* Жилки. Средняя идёт от черешка до самого кончика, боковые отходят от
   неё дугой вверх и не доходят до края — так лист читается живым, а не
   расчерченным. Пар четыре: больше в мелком размере сливается. */
const veins = ["M 0 -1.6 Q 0.35 -14 0 -27.4"];
const пары = [0.15, 0.33, 0.52, 0.71];
for (const t of пары) {
  const [, y0] = точкаКрая(t, 1);
  const конец = Math.min(0.97, t + 0.2);
  const [xк, yк] = точкаКрая(конец, 1);
  const длина = xк * 0.72;
  // Управляющая точка ниже прямой — от этого жилка выгибается вверх, как
  // на настоящем листе.
  const cx = длина * 0.45;
  const cy = y0 + (yк - y0) * 0.15;
  for (const знак of [1, -1]) {
    veins.push(`M ${(знак * 0.2).toFixed(2)} ${y0.toFixed(2)} Q ${(знак * cx).toFixed(2)} ${cy.toFixed(2)} ${(знак * длина).toFixed(2)} ${(yк * 0.995).toFixed(2)}`);
  }
}

const stem = "M 0 -1 Q 0.1 1.8 -0.3 4.8";

/* --- Вывод ------------------------------------------------------------ */
const кусок = `  {
    outline: "${outline}",
    stem: "${stem}",
    veins: [
${veins.map((v) => `      "${v}",`).join("\n")}
    ],
  },`;

fs.writeFileSync(path.join(корень, "scripts/leaf.generated.txt"), кусок);
console.log(кусок.slice(0, 300) + "\n… целиком в scripts/leaf.generated.txt");

/* Проба: лист в тех размерах, в которых его видят. Крупно — в
   приветствии и загрузчике, мелко — иконкой рядом с ником. */
const проба = (размер, цвет) => `<svg width="${размер}" height="${размер * 1.2}" viewBox="-11.5 -29.5 23 35">
  <path d="${stem}" fill="none" stroke="${цвет}" stroke-width="1.5" stroke-linecap="round"/>
  <path d="${outline}" fill="${цвет}"/>
  <g stroke="#08090B" stroke-width="0.7" fill="none" stroke-linecap="round" opacity="0.85">
${veins.map((v) => `    <path d="${v}"/>`).join("\n")}
  </g>
</svg>`;

const страница = `<body style="margin:0;background:#0E1015;display:flex;align-items:flex-end;gap:28px;padding:24px">
  ${проба(220, "#6C7CFF")}
  ${проба(96, "#6C7CFF")}
  ${проба(48, "#6C7CFF")}
  ${проба(22, "#6C7CFF")}
  ${проба(14, "#6C7CFF")}
</body>`;

try {
  const { chromium } = await import("playwright-core");
  const браузер = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
  const стр = await браузер.newPage({ viewport: { width: 560, height: 320 }, deviceScaleFactor: 2 });
  await стр.setContent(страница);
  await стр.waitForTimeout(300);
  await стр.screenshot({ path: path.join(корень, "public/leaf-preview.png") });
  await браузер.close();
  console.log("public/leaf-preview.png");
} catch (e) {
  console.log(`превью пропущено (${(e && e.message) || e})`);
}
