/* Рекламный баннер Mintly.
 *
 * Раскладка: слева знак, плашка, крупное название, строка о сути и сетка
 * коротких обещаний; справа — светящийся лист на кольцах света. Всё
 * держится на одном предмете: номер версии или скриншот интерфейса
 * ничего не говорят тому, кто видит площадку впервые, а знак говорит.
 *
 * Свечения набраны и градиентами, и размытием. Там, где размытие, у
 * фильтра явно задана область в координатах холста (filterUnits):
 * область по умолчанию считается от рамки самой фигуры, и на чёрном
 * фоне обрезанное размытие видно прямоугольником.
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
  // Жилки — часть знака, а не украшение: без них лист читается каплей.
  const жилкиБлок = блок.split("veins: [")[3].split("]")[0];
  return {
    outline: контуры[3].split('"')[0],
    stem: черешки[3].split('"')[0],
    veins: жилкиБлок.split('"').filter((с) => с.trim().startsWith("M")),
  };
}

const Ц = {
  фон: "#06050D",
  фонНиз: "#0B0818",
  светлый: "#D6D2FF",
  лиловый: "#A78BFA",
  основной: "#6C7CFF",
  тёмный: "#3A2CB8",
  белый: "#FFFFFF",
  тусклый: "#9AA0B4",
};

const шрифт = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/* Плитки — короткие обещания, каждое проверяемо в самом приложении.
   Иконка рисуется в квадрате 24×24, путь свой у каждой. */
const ПЛИТКИ = [
  { строки: ["Быстрые", "транзакции"], икона: "M 13.5 2 L 5 13.5 h 5.5 L 10 22 l 8.5 -11.5 H 13 z" },
  {
    строки: ["Запуск", "за пару секунд"],
    икона: "M 4.5 16.5 c -1.5 1.26 -2 5 -2 5 s 3.74 -0.5 5 -2 c 0.71 -0.84 0.7 -2.13 -0.09 -2.91 a 2.18 2.18 0 0 0 -2.91 -0.09 z M 12 15 l -3 -3 a 22 22 0 0 1 2 -3.95 A 12.88 12.88 0 0 1 22 2 c 0 2.72 -0.78 7.5 -6 11 a 22.35 22.35 0 0 1 -4 2 z M 9 12 H 4 s 0.55 -3.03 2 -4 c 1.62 -1.08 5 0 5 0 M 12 15 v 5 s 3.03 -0.55 4 -2 c 1.08 -1.62 0 -5 0 -5",
  },
  { строки: ["Нулевые", "комиссии"], икона: "M 19 5 L 5 19 M 6.5 6.5 a 2 2 0 1 0 0.01 0 M 17.5 17.5 a 2 2 0 1 0 0.01 0" },
  { строки: ["Безопасно", "и надёжно"], икона: "M 12 3 l 7 3 v 6 c 0 4.4 -3 7.6 -7 9 c -4 -1.4 -7 -4.6 -7 -9 V 6 z" },
  { строки: ["Поддержка", "TON и Solana"], икона: "M 4 8 h 13 M 13 4 l 4 4 l -4 4 M 20 16 H 7 M 11 12 l -4 4 l 4 4" },
  { строки: ["Высокая", "пропускная", "способность"], икона: "M 5 20 V 12 M 12 20 V 5 M 19 20 v -5 M 3 20 h 18" },
];

/* Звёзды раскладываются по одному и тому же псевдослучаю: баннер должен
   пересобираться в тот же файл, а не в похожий. */
function звёзды(Ш, В, сколько) {
  let s = 20240517;
  const сл = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
  const точки = [];
  for (let i = 0; i < сколько; i++) {
    const x = сл() * Ш;
    const y = сл() * В;
    const r = 0.5 + сл() * сл() * 2.2;
    // Слева лежит текст — там звёзды приглушены, иначе рябит под буквами.
    const слева = x < Ш * 0.44 ? 0.35 : 1;
    const a = (0.12 + сл() * 0.75) * слева;
    точки.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(2)}" fill="#FFFFFF" opacity="${a.toFixed(2)}"/>`);
  }
  return точки.join("");
}

function нарисовать({ Ш, В, кегльНазвания, кегльПодписи, кегльПлашки, листВысота, плиткаКегль, вРяду }) {
  const лист = листИзПриложения();
  // Контур описан в своей системе координат (от -29 до 5 по высоте).
  // Масштаб считаем от неё, чтобы высота на баннере вышла заданной.
  const масштаб = листВысота / 34;
  const центрX = Ш * 0.7;
  const низЛиста = В * 0.715;
  // Пол проходит ровно по кончику черешка (в системе контура он на +5.2).
  // Раньше пол считался по низу пластинки, и волны расходились там, где
  // лист уже прошёл насквозь.
  const полY = низЛиста + 5.2 * масштаб;

  const текстX = Math.round(Ш * 0.042);
  const знакY = Math.round(В * 0.095);
  const плашкаY = Math.round(В * 0.215);
  const названиеY = Math.round(В * 0.375);
  const подписьY = Math.round(В * 0.565);
  const плиткиY = Math.round(В * 0.705);

  const кегльЗнака = Math.round(кегльПлашки * 1.75);
  const плашкаВ = Math.round(кегльПлашки * 2.5);
  const словоПлашки = "МЕМПАД";
  const плашкаШ = Math.round(плашкаВ * 1.05 + словоПлашки.length * кегльПлашки * 0.86 + кегльПлашки * 0.8);

  const плиткаШ = Math.round(плиткаКегль * 11.6);
  // Высота под три строки: плитки должны быть одинаковыми, а самая
  // длинная подпись в две не помещается.
  const плиткаВ = Math.round(плиткаКегль * 5.2);
  const интерлиньяж = Math.round(плиткаКегль * 1.28);
  const зазор = Math.round(плиткаКегль * 0.9);
  const иконка = Math.round(плиткаКегль * 1.35);

  const плитки = ПЛИТКИ.slice(0, вРяду === 3 ? 6 : вРяду * 2)
    .map((п, i) => {
      const x = текстX + (i % вРяду) * (плиткаШ + зазор);
      const y = плиткиY + Math.floor(i / вРяду) * (плиткаВ + зазор);
      const иx = Math.round(плиткаКегль * 1.1);
      const тx = Math.round(иx + иконка + плиткаКегль * 1.0);
      return `  <g transform="translate(${x}, ${y})">
    <rect width="${плиткаШ}" height="${плиткаВ}" rx="${Math.round(плиткаКегль * 0.8)}" fill="#FFFFFF" fill-opacity="0.045" stroke="#FFFFFF" stroke-opacity="0.1"/>
    <g transform="translate(${иx}, ${(плиткаВ - иконка) / 2}) scale(${(иконка / 24).toFixed(3)})" fill="none"
      stroke="${Ц.лиловый}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="${п.икона}"/>
    </g>
${п.строки
        .map((с, к) => {
          // Блок строк центрируется по плитке, сколько бы их ни было.
          const y = плиткаВ / 2 - ((п.строки.length - 1) * интерлиньяж) / 2 + плиткаКегль * 0.35 + к * интерлиньяж;
          return `    <text x="${тx}" y="${y.toFixed(0)}" fill="${к === 0 ? Ц.белый : Ц.тусклый}" font-family="${шрифт}"
      font-size="${плиткаКегль}" font-weight="${к === 0 ? 600 : 500}">${с}</text>`;
        })
        .join("\n")}
  </g>`;
    })
    .join("\n");

  // Кольца света на полу: чем дальше от предмета, тем тусклее и тоньше.
  const кольца = [0.14, 0.28, 0.44, 0.62, 0.82, 1]
    .map((к, i) => `<ellipse cx="${центрX.toFixed(0)}" cy="${полY.toFixed(0)}" rx="${(листВысота * 0.62 * к).toFixed(0)}" ry="${(листВысота * 0.15 * к).toFixed(0)}"
    fill="none" stroke="${i < 2 ? Ц.светлый : Ц.лиловый}" stroke-opacity="${(0.95 - к * 0.7).toFixed(2)}" stroke-width="${(3.4 - к * 2).toFixed(1)}"/>`)
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Ш}" height="${В}" viewBox="0 0 ${Ш} ${В}">
  <defs>
    <linearGradient id="небо" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="${Ц.фон}"/>
      <stop offset="100%" stop-color="${Ц.фонНиз}"/>
    </linearGradient>
    <radialGradient id="туманность" cx="${(центрX / Ш).toFixed(3)}" cy="0.55" r="0.55">
      <stop offset="0%" stop-color="${Ц.основной}" stop-opacity="0.34"/>
      <stop offset="45%" stop-color="${Ц.тёмный}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${Ц.фон}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="подсветПола" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${Ц.белый}" stop-opacity="0.85"/>
      <stop offset="22%" stop-color="${Ц.лиловый}" stop-opacity="0.5"/>
      <stop offset="60%" stop-color="${Ц.основной}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${Ц.основной}" stop-opacity="0"/>
    </radialGradient>
    <!-- Заливка листа: светлая макушка, насыщенное основание. Перепад
         мягкий — предмет матовый, а светится у него кромка. -->
    <linearGradient id="плоскость" x1="0.1" y1="0" x2="0.55" y2="1">
      <stop offset="0%" stop-color="#CFCBFF"/>
      <stop offset="38%" stop-color="#8E86FF"/>
      <stop offset="100%" stop-color="#5B4BE8"/>
    </linearGradient>
    <linearGradient id="название" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${Ц.светлый}"/>
      <stop offset="100%" stop-color="${Ц.основной}"/>
    </linearGradient>
    <linearGradient id="угасание" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.34"/>
      <stop offset="70%" stop-color="#FFFFFF" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <mask id="отражениеГаснет">
      <rect x="0" y="${полY.toFixed(0)}" width="${Ш}" height="${(В - полY).toFixed(0)}" fill="url(#угасание)"/>
    </mask>
    <!-- Область фильтра задана в координатах холста: по умолчанию она
         считается от рамки фигуры и режет размытие прямоугольником. -->
    <filter id="ореолДалеко" filterUnits="userSpaceOnUse" x="0" y="0" width="${Ш}" height="${В}">
      <feGaussianBlur stdDeviation="${(листВысота * 0.09).toFixed(1)}"/>
    </filter>
    <filter id="ореол" filterUnits="userSpaceOnUse" x="0" y="0" width="${Ш}" height="${В}">
      <feGaussianBlur stdDeviation="${(листВысота * 0.028).toFixed(1)}"/>
    </filter>
    <filter id="ореолБлизко" filterUnits="userSpaceOnUse" x="0" y="0" width="${Ш}" height="${В}">
      <feGaussianBlur stdDeviation="${(листВысота * 0.009).toFixed(1)}"/>
    </filter>
  </defs>

  <rect width="${Ш}" height="${В}" fill="url(#небо)"/>
  ${звёзды(Ш, В, Math.round((Ш * В) / 5200))}
  <rect width="${Ш}" height="${В}" fill="url(#туманность)"/>

  <!-- Пол: свет из-под предмета и кольца вокруг него. -->
  <ellipse cx="${центрX.toFixed(0)}" cy="${полY.toFixed(0)}" rx="${(листВысота * 0.85).toFixed(0)}" ry="${(листВысота * 0.26).toFixed(0)}" fill="url(#подсветПола)"/>
  ${кольца}

  <!-- Отражение: тот же лист вверх ногами, обрезанный градиентом. -->
  <g mask="url(#отражениеГаснет)" opacity="0.3">
    <g transform="translate(${центрX.toFixed(1)}, ${полY.toFixed(1)}) scale(${масштаб.toFixed(3)}, ${(-масштаб * 0.9).toFixed(3)})">
      <path d="${лист.stem}" fill="none" stroke="${Ц.основной}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="${лист.outline}" fill="${Ц.основной}"/>
    </g>
  </g>

  <!-- Сам лист: плоская заливка, прорезанные фоном жилки и светящаяся
       кромка. Блик и боковая грань делали из знака стеклянную каплю. -->
  <g transform="translate(${центрX.toFixed(1)}, ${низЛиста.toFixed(1)}) scale(${масштаб.toFixed(3)})">
    <path d="${лист.outline}" fill="${Ц.основной}" stroke="${Ц.основной}" stroke-width="4" opacity="0.8" filter="url(#ореолДалеко)"/>
    <path d="${лист.outline}" fill="none" stroke="${Ц.лиловый}" stroke-width="2.2" opacity="0.95" filter="url(#ореол)"/>
    <path d="${лист.stem}" fill="none" stroke="url(#плоскость)" stroke-width="1.6" stroke-linecap="round"/>
    <path d="${лист.outline}" fill="url(#плоскость)"/>
    <path d="${лист.outline}" fill="none" stroke="${Ц.белый}" stroke-opacity="0.9" stroke-width="0.5" filter="url(#ореолБлизко)"/>
    <path d="${лист.outline}" fill="none" stroke="${Ц.светлый}" stroke-opacity="0.75" stroke-width="0.22"/>
    <g fill="none" stroke="${Ц.фон}" stroke-width="0.5" stroke-linecap="round">
      ${лист.veins.map((ж) => `<path d="${ж}"/>`).join("\n      ")}
      <path d="${лист.stem}"/>
    </g>
  </g>
  <!-- Точка, из которой всё светится: основание черешка. -->
  <ellipse cx="${центрX.toFixed(0)}" cy="${полY.toFixed(0)}" rx="${(листВысота * 0.1).toFixed(0)}" ry="${(листВысота * 0.032).toFixed(0)}" fill="${Ц.белый}" opacity="0.9" filter="url(#ореолБлизко)"/>

  <!-- Знак площадки -->
  <g transform="translate(${текстX}, ${знакY})">
    <g transform="scale(${(кегльЗнака * 0.043).toFixed(3)})">
      <path d="${лист.stem}" fill="none" stroke="${Ц.основной}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="${лист.outline}" fill="${Ц.основной}"/>
      <g fill="none" stroke="${Ц.фон}" stroke-width="0.6" stroke-linecap="round">
        ${лист.veins.map((ж) => `<path d="${ж}"/>`).join("\n        ")}
        <path d="${лист.stem}"/>
      </g>
    </g>
    <text x="${Math.round(кегльЗнака * 1.35)}" y="${Math.round(кегльЗнака * 0.36)}" fill="${Ц.белый}"
      font-family="${шрифт}" font-size="${кегльЗнака}" font-weight="700" letter-spacing="0.01em">Mintly</text>
  </g>

  <!-- Плашка: одно слово о том, что перед тобой -->
  <g transform="translate(${текстX}, ${плашкаY})">
    <rect x="0" y="${-плашкаВ / 2}" width="${плашкаШ}" height="${плашкаВ}" rx="${плашкаВ / 2}" fill="${Ц.основной}"/>
    <circle cx="${плашкаВ * 0.58}" cy="0" r="${кегльПлашки * 0.32}" fill="#0B0820"/>
    <text x="${плашкаВ * 1.02}" y="${кегльПлашки * 0.36}" fill="${Ц.белый}" font-family="${шрифт}"
      font-size="${кегльПлашки}" font-weight="700" letter-spacing="0.12em">${словоПлашки}</text>
  </g>

  <!-- Название и суть -->
  <text x="${текстX}" y="${названиеY}" fill="${Ц.белый}" font-family="${шрифт}"
    font-size="${кегльНазвания}" font-weight="800" letter-spacing="-0.015em">MINTLY</text>
  <text x="${текстX}" y="${названиеY + Math.round(кегльНазвания * 0.98)}" fill="url(#название)" font-family="${шрифт}"
    font-size="${кегльНазвания}" font-weight="800" letter-spacing="-0.015em">MEMPAD</text>

  <text x="${текстX}" y="${подписьY}" fill="${Ц.белый}" font-family="${шрифт}" font-size="${кегльПодписи}" font-weight="700" letter-spacing="0.02em">ЗАПУСК МЕМКОИНОВ</text>
  <text x="${текстX}" y="${подписьY + Math.round(кегльПодписи * 1.25)}" fill="${Ц.белый}" font-family="${шрифт}" font-size="${кегльПодписи}" font-weight="700" letter-spacing="0.02em">НА TON И SOLANA</text>
  <text x="${текстX}" y="${подписьY + Math.round(кегльПодписи * 2.5)}" fill="${Ц.основной}" font-family="${шрифт}" font-size="${кегльПодписи}" font-weight="700" letter-spacing="0.02em">ЗА МИНУТУ</text>

${плитки}
</svg>
`;
}

const размеры = [
  {
    имя: "hero", Ш: 1920, В: 1080,
    кегльНазвания: 122, кегльПодписи: 34, кегльПлашки: 24,
    листВысота: 600, плиткаКегль: 21, вРяду: 3,
  },
  {
    имя: "hero-og", Ш: 1200, В: 630,
    кегльНазвания: 76, кегльПодписи: 21, кегльПлашки: 15,
    листВысота: 360, плиткаКегль: 13, вРяду: 3,
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
