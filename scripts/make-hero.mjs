/* Рекламный баннер Mintly.
 *
 * Раскладка та же, что у баннеров обновлений в крипте: слева знак,
 * плашка, крупное название и строка о сути; справа — один большой
 * предмет, вокруг которого весь свет. Отличие в предмете: там ставят
 * номер версии, здесь — сам лист Mintly. Номер версии ничего не говорит
 * тому, кто видит площадку впервые, а знак говорит.
 *
 * Объём набирается слоями, а не фильтрами: тень под листом, боковая
 * грань со сдвигом, основная плоскость с наклонным градиентом, блик
 * сверху и обвод по краю. Свет лежит на «полу» эллипсом и возвращается
 * отражением — оно обрезано маской, поэтому гаснет само.
 *
 * Запуск:  node scripts/make-hero.mjs
 * Выход:   public/hero.svg + .png        — 1920×1080, широкий
 *          public/hero-og.svg + .png     — 1200×630, превью ссылки
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const корень = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Контур листа берётся из приложения: рисовать второй такой же руками —
   значит однажды получить два разных знака. */
function листИзПриложения() {
  const исходник = fs.readFileSync(path.join(корень, "src", "App.tsx"), "utf8");
  const начало = исходник.indexOf("const LEAF_KINDS");
  const блок = исходник.slice(начало, исходник.indexOf("\n];", начало));
  const контуры = блок.split('outline: "');
  const черешки = блок.split('stem: "');
  return {
    outline: контуры[3].split('"')[0],
    stem: черешки[3].split('"')[0],
  };
}

const Ц = {
  фон: "#05060A",
  светлый: "#C7CCFF",
  основной: "#6C7CFF",
  тёмный: "#3A45C4",
  белый: "#FFFFFF",
  тусклый: "#8C93A6",
};

const шрифт = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

function нарисовать({ Ш, В, кегльНазвания, кегльПодписи, кегльПлашки, листВысота, сдвигЛиста }) {
  const лист = листИзПриложения();
  // Лист описан в своей системе координат (примерно от -31 до 3 по
  // высоте). Масштаб считаем от неё, чтобы высота на баннере получилась
  // ровно заданной.
  const масштаб = листВысота / 34;
  const центрX = Ш * 0.68 + сдвигЛиста;
  const низЛиста = В * 0.62;
  const полY = В * 0.665;

  const текстX = Math.round(Ш * 0.075);
  const знакY = Math.round(В * 0.13);
  const плашкаY = Math.round(В * 0.33);
  const названиеY = Math.round(В * 0.5);
  const подписьY = Math.round(В * 0.74);

  const плашкаВ = Math.round(кегльПлашки * 2.6);
  // Ширину капсулы считаем от самого слова: жёсткое число обрезает текст.
  const словоПлашки = "МЕМПАД";
  const плашкаШ = Math.round(плашкаВ * 1.15 + словоПлашки.length * кегльПлашки * 0.86 + кегльПлашки * 0.9);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Ш}" height="${В}" viewBox="0 0 ${Ш} ${В}">
  <defs>
    <!-- Свет идёт из-за листа: у фона есть источник, а не просто чёрная
         заливка с пятном посередине. -->
    <radialGradient id="зарево" cx="${(центрX / Ш).toFixed(3)}" cy="0.52" r="0.62">
      <stop offset="0%" stop-color="${Ц.основной}" stop-opacity="0.30"/>
      <stop offset="42%" stop-color="${Ц.основной}" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="${Ц.фон}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="плоскость" x1="0.15" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="${Ц.светлый}"/>
      <stop offset="38%" stop-color="${Ц.основной}"/>
      <stop offset="100%" stop-color="${Ц.тёмный}"/>
    </linearGradient>
    <linearGradient id="грань" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2A3196"/>
      <stop offset="100%" stop-color="#0E1240"/>
    </linearGradient>
    <radialGradient id="блик" cx="0.34" cy="0.16" r="0.55">
      <stop offset="0%" stop-color="${Ц.белый}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${Ц.белый}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="полоса" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${Ц.основной}" stop-opacity="0"/>
      <stop offset="30%" stop-color="${Ц.светлый}" stop-opacity="0.75"/>
      <stop offset="52%" stop-color="${Ц.белый}" stop-opacity="0.95"/>
      <stop offset="76%" stop-color="${Ц.светлый}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${Ц.основной}" stop-opacity="0"/>
    </linearGradient>
    <!-- Свечения набираются градиентами, а не размытием: у фильтра есть
         своя прямоугольная область, и на чёрном фоне её видно рамкой. -->
    <radialGradient id="ореолПола" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${Ц.основной}" stop-opacity="0.5"/>
      <stop offset="45%" stop-color="${Ц.основной}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${Ц.основной}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ореолИскры" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${Ц.белый}" stop-opacity="0.75"/>
      <stop offset="28%" stop-color="${Ц.светлый}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${Ц.светлый}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="угасание" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.5"/>
      <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <mask id="отражениеГаснет">
      <rect x="0" y="${полY.toFixed(0)}" width="${Ш}" height="${(В - полY).toFixed(0)}" fill="url(#угасание)"/>
    </mask>
  </defs>

  <rect width="${Ш}" height="${В}" fill="${Ц.фон}"/>
  <rect width="${Ш}" height="${В}" fill="url(#зарево)"/>

  <!-- Свет на полу: широкая полоса под предметом и её мягкий ореол. -->
  <ellipse cx="${центрX.toFixed(0)}" cy="${полY.toFixed(0)}" rx="${(Ш * 0.34).toFixed(0)}" ry="${(В * 0.16).toFixed(0)}"
    fill="url(#ореолПола)"/>
  <rect x="${(центрX - Ш * 0.26).toFixed(0)}" y="${(полY - 1.5).toFixed(0)}" width="${(Ш * 0.52).toFixed(0)}" height="3"
    fill="url(#полоса)"/>

  <!-- Отражение: тот же лист вверх ногами, обрезанный градиентом. -->
  <g mask="url(#отражениеГаснет)" opacity="0.42">
    <g transform="translate(${центрX.toFixed(1)}, ${(полY + (полY - низЛиста) * 0.02).toFixed(1)}) scale(${масштаб.toFixed(3)}, ${(-масштаб * 0.92).toFixed(3)})">
      <path d="${лист.outline}" fill="url(#плоскость)"/>
    </g>
  </g>

  <!-- Сам лист. Грань смещена вправо-вниз: свет падает слева сверху.
       Сдвиг задан в единицах контура — группа уже отмасштабирована. -->
  <g transform="translate(${центрX.toFixed(1)}, ${низЛиста.toFixed(1)}) scale(${масштаб.toFixed(3)})">
    <g transform="translate(0.85, 0.55)">
      <path d="${лист.outline}" fill="url(#грань)"/>
    </g>
    <path d="${лист.outline}" fill="url(#плоскость)"/>
    <path d="${лист.outline}" fill="url(#блик)"/>
    <path d="${лист.outline}" fill="none" stroke="${Ц.светлый}" stroke-opacity="0.55" stroke-width="0.28"/>
    <path d="${лист.stem}" fill="none" stroke="${Ц.светлый}" stroke-opacity="0.8" stroke-width="0.5" stroke-linecap="round"/>
  </g>

  <!-- Искра на верхней кромке: одна точка света, как от прожектора. -->
  <g transform="translate(${(центрX - листВысота * 0.035).toFixed(0)}, ${(низЛиста - листВысота * 0.895).toFixed(0)})">
    <circle r="${(В * 0.055).toFixed(1)}" fill="url(#ореолИскры)"/>
    <circle r="${(В * 0.005).toFixed(1)}" fill="${Ц.белый}"/>
  </g>

  <!-- Знак площадки -->
  <g transform="translate(${текстX}, ${знакY})">
    <g transform="scale(${(кегльПлашки * 0.075).toFixed(3)})">
      <path d="${лист.outline}" fill="${Ц.основной}"/>
      <path d="${лист.stem}" fill="none" stroke="${Ц.основной}" stroke-width="0.8" stroke-linecap="round"/>
    </g>
    <text x="${Math.round(кегльПлашки * 1.7)}" y="${Math.round(кегльПлашки * 0.36)}" fill="${Ц.белый}"
      font-family="${шрифт}" font-size="${Math.round(кегльПлашки * 1.75)}" font-weight="700" letter-spacing="0.02em">Mintly</text>
  </g>

  <!-- Плашка: одно слово о том, что перед тобой -->
  <g transform="translate(${текстX}, ${плашкаY})">
    <rect x="0" y="${-плашкаВ / 2}" width="${плашкаШ}" height="${плашкаВ}" rx="${плашкаВ / 2}" fill="${Ц.основной}"/>
    <circle cx="${плашкаВ * 0.62}" cy="0" r="${кегльПлашки * 0.3}" fill="#0B0D1A"/>
    <text x="${плашкаВ * 1.15}" y="${кегльПлашки * 0.36}" fill="#0B0D1A" font-family="${шрифт}"
      font-size="${кегльПлашки}" font-weight="800" letter-spacing="0.14em">${словоПлашки}</text>
  </g>

  <!-- Название и суть -->
  <text x="${текстX}" y="${названиеY}" fill="${Ц.белый}" font-family="${шрифт}"
    font-size="${кегльНазвания}" font-weight="800" letter-spacing="-0.01em">MINTLY</text>
  <text x="${текстX}" y="${названиеY + кегльНазвания * 0.95}" fill="${Ц.белый}" font-family="${шрифт}"
    font-size="${кегльНазвания}" font-weight="800" letter-spacing="-0.01em">MEMPAD</text>

  <text x="${текстX}" y="${подписьY}" font-family="${шрифт}" font-size="${кегльПодписи}" font-weight="800" letter-spacing="0.02em">
    <tspan fill="${Ц.белый}">ЗАПУСК МЕМКОИНОВ</tspan>
  </text>
  <text x="${текстX}" y="${подписьY + кегльПодписи * 1.32}" font-family="${шрифт}" font-size="${кегльПодписи}" font-weight="800" letter-spacing="0.02em">
    <tspan fill="${Ц.белый}">НА TON И SOLANA </tspan><tspan fill="${Ц.основной}">ЗА МИНУТУ</tspan>
  </text>
</svg>
`;
}

const размеры = [
  {
    имя: "hero", Ш: 1920, В: 1080,
    кегльНазвания: 118, кегльПодписи: 38, кегльПлашки: 26,
    листВысота: 620, сдвигЛиста: 0,
  },
  {
    имя: "hero-og", Ш: 1200, В: 630,
    кегльНазвания: 74, кегльПодписи: 24, кегльПлашки: 17,
    листВысота: 370, сдвигЛиста: 10,
  },
];

const сделанные = [];
for (const р of размеры) {
  const файл = path.join(корень, "public", `${р.имя}.svg`);
  fs.writeFileSync(файл, нарисовать(р));
  сделанные.push({ ...р, файл });
  console.log(`public/${р.имя}.svg — ${р.Ш}×${р.В}`);
}

/* Растр рисует тот же браузер, что показывает страницы: значит и
   выглядеть будет так же, а не «примерно так». */
try {
  const { chromium } = await import("playwright-core");
  const браузер = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
  for (const с of сделанные) {
    const стр = await браузер.newPage({ viewport: { width: с.Ш, height: с.В } });
    await стр.goto(`file://${с.файл}`);
    await стр.waitForTimeout(400);
    await стр.screenshot({ path: path.join(корень, "public", `${с.имя}.png`) });
    await стр.close();
    console.log(`public/${с.имя}.png`);
  }
  await браузер.close();
} catch (e) {
  console.log(`PNG пропущены (${(e && e.message) || e}) — SVG на месте`);
}
