/* Общее для экранов большого монитора: палитра, шрифт, форматирование
   чисел и мелкие элементы. Вынесено отдельно, чтобы витрина, экран
   токена и кошелёк не держали по своей копии — разъехавшиеся цвета и
   разный формат цены на соседних экранах видно сразу. */

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { апи } from "./апи";

export const Ц = {
  фон: "#000000",
  панель: "#0B0C0F",
  панельВыше: "#121419",
  линия: "#1C1F26",
  линияЯрче: "#2A2E38",
  текст: "#EDEFF5",
  тусклый: "#8A90A2",
  слабый: "#5C6274",
  акцент: "#6C7CFF",
  рост: "#2ED47A",
  падение: "#FF5C6C",
};

/* Inter: у него узкие цифры одинаковой ширины и спокойные буквы — в
   таблице, где двадцать строк цифр подряд, это важнее характера. Файлы
   лежат в public/fonts: правила безопасности страницы запрещают тянуть
   шрифты с чужих доменов. */
export const шрифт = "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
export const цифры = "Inter, 'SF Mono', Consolas, monospace";

/* Ширина, за которую содержимое не выходит. Таблица во весь монитор
   заставляет водить глазами от края до края: тикер слева, цена в метре
   справа — строка перестаёт читаться как одно целое. */
export const ПОЛОСА = 1280;

export const СТИЛИ = `
  @font-face {
    font-family: Inter; font-style: normal; font-weight: 100 900; font-display: swap;
    src: url(/fonts/inter-latin.woff2) format('woff2');
    unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215;
  }
  @font-face {
    font-family: Inter; font-style: normal; font-weight: 100 900; font-display: swap;
    src: url(/fonts/inter-cyrillic.woff2) format('woff2');
    unicode-range: U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;
  }
  body { background: ${Ц.фон}; }
  * { -webkit-font-smoothing: antialiased; }

  /* Появление: экран собирается за один вдох, а не вспыхивает целиком. */
  @keyframes всплыть { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes проявить { from { opacity: 0; } to { opacity: 1; } }
  .вплыл { animation: всплыть 260ms cubic-bezier(0.16,1,0.3,1) backwards; }
  .проявился { animation: проявить 200ms ease-out backwards; }

  /* Строка списка. Подсветка при наведении и лёгкий сдвиг: видно, на чём
     стоит курсор, без рамок и подчёркиваний. */
  .строка { transition: background 140ms ease, transform 140ms ease; }
  .строка:hover { background: ${Ц.панель}; }
  .строка:active { transform: scale(0.997); }

  /* Логотип подрастает только в карточке открытого токена. В таблице
     это мешало: картинка выпрыгивала под курсором на каждой строке, по
     которой глаз просто проходил мимо. */
  .лого { transition: transform 180ms cubic-bezier(0.16,1,0.3,1), box-shadow 180ms ease; }
  .лого-крупно:hover { transform: scale(2.4); box-shadow: 0 10px 28px rgba(0,0,0,0.7); position: relative; z-index: 5; }

  .кнопка { transition: background 140ms ease, border-color 140ms ease, transform 120ms ease, opacity 140ms ease; }
  .кнопка:hover { border-color: ${Ц.линияЯрче}; }
  .кнопка:active { transform: scale(0.97); }

  input { transition: border-color 140ms ease, background 140ms ease; }
  input:focus { border-color: ${Ц.линияЯрче}; }

  @media (prefers-reduced-motion: reduce) {
    .вплыл, .проявился { animation: none; }
    .строка, .лого, .кнопка { transition: none; }
  }
`;

/* Знаки сетей. Подпись «TON» и «Solana» в переключателе читалась как
   слово, а сеть узнают по цвету и форме — за то же место знак говорит
   быстрее. Рисуем сами: чужие картинки запрещены правилами безопасности
   страницы. */
export function ЗнакTON({ размер = 18 }) {
  return (
    <svg width={размер} height={размер} viewBox="0 0 56 56" aria-hidden focusable="false">
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path
        fill="#fff"
        d="M37.56 15.63H18.44c-3.52 0-5.74 3.79-3.98 6.86l11.8 20.45c.77 1.34 2.7 1.34 3.47 0l11.8-20.45c1.77-3.06-.45-6.86-3.97-6.86zM26.25 36.81l-2.57-4.98-6.2-11.09c-.41-.71.1-1.62.95-1.62h7.82v17.69zm12.26-16.07l-6.2 11.1-2.57 4.97V19.12h7.82c.85 0 1.36.91.95 1.62z"
      />
    </svg>
  );
}

export function ЗнакSolana({ размер = 18 }) {
  // Свой номер градиента на каждый знак: два одинаковых id на странице —
  // и браузер закрашивает оба первым найденным.
  const id = useId().replace(/:/g, "");
  return (
    <svg width={размер} height={размер} viewBox="0 0 398 312" aria-hidden focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#9945FF" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`}>
        <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
        <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
        <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
      </g>
    </svg>
  );
}


/* Фирменные цвета чужих сервисов: кнопка «войти через …» узнаётся по
   цвету и знаку раньше, чем прочитан текст. Знаки нарисованы здесь, а не
   загружаются с чужих серверов: правила безопасности страницы запрещают
   тянуть картинки откуда попало, да и упавший чужой сервер не должен
   оставлять кнопку без опознавательных знаков. */
export const ЦВЕТА_СЕРВИСОВ = {
  telegram: "#229ED9",
  google: "#FFFFFF",
  phantom: "#AB9FF2",
};

export function ЗнакTelegram({ размер = 16 }) {
  return (
    <svg width={размер} height={размер} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="12" fill="#229ED9" />
      <path
        d="M5.5 11.9l11-4.3c.5-.2 1 .1.8.9l-1.9 8.9c-.1.6-.5.8-1 .5l-2.8-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-3 5.2-4.7c.2-.2 0-.3-.3-.1l-6.4 4-2.8-.9c-.6-.2-.6-.6.1-.9z"
        fill="#fff"
      />
    </svg>
  );
}

export function ЗнакGoogle({ размер = 16 }) {
  return (
    <svg width={размер} height={размер} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6c1.9-5.6 7.1-9.7 13.6-9.7z" />
      <path fill="#4285F4" d="M46.9 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.9c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.3-10.2 7.3-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.8c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.8-6C.9 17 0 20.4 0 24s.9 7 2.6 10.2l7.8-5.4z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.5 0-11.7-4.1-13.6-9.7l-7.8 5.4C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function ЗнакPhantom({ размер = 16 }) {
  return (
    <svg width={размер} height={размер} viewBox="0 0 112 112" aria-hidden focusable="false">
      <rect width="112" height="112" rx="26" fill="#9A87F0" />
      {/* Призрак: наклонённое тело с волнистым подолом и парой глаз —
          силуэт узнают раньше, чем прочитают подпись. */}
      <path
        fill="#FBFAF6"
        d="M74 22c14 0 24 11 24 27 0 24-17 45-33 45-6 0-9-4-8-10-6 8-14 12-21 12-6 0-10-4-10-11-8 9-17 12-23 8-7-5-6-19 4-33C21 43 47 22 74 22z"
      />
      <ellipse cx="69" cy="43" rx="6" ry="8" fill="#9A87F0" />
      <ellipse cx="86" cy="43" rx="6" ry="8" fill="#9A87F0" />
    </svg>
  );
}

/* Строка кеша к тому виду, в котором её рисует таблица. Имена полей
   намеренно другие, чем в базе: колонки не должны знать про схему. */
export function изКеша(r) {
  return {
    id: r.id,
    сеть: r.chain === "solana" ? "solana" : "ton",
    пул: r.pool_address,
    адрес: r.token_address,
    имя: r.name,
    тикер: r.ticker,
    лого: r.logo_url,
    цена: Number(r.price) || 0,
    движение: Number(r.change24) || 0,
    капитализация: Number(r.mcap) || 0,
    ликвидность: Number(r.liq) || 0,
    объём: Number(r.vol24) || 0,
    сделки: Number(r.tx24) || 0,
    биржа: r.dex_name || null,
    создан: r.pool_created_at || null,
    новый: r.new_at || null,
    обновлён: r.updated_at || null,
  };
}

export function деньги(v) {
  const n = Number(v) || 0;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(n < 10 ? 2 : 0)}`;
}

export function цена(v) {
  const n = Number(v) || 0;
  if (!n) return "$0";
  if (n >= 1) return `$${n.toFixed(3)}`;
  // У мемкоинов цена — это нули после запятой: обычная запись съедает все
  // значащие цифры, поэтому считаем, сколько нулей пропустить.
  const нулей = Math.max(0, -Math.floor(Math.log10(n)) - 1);
  return `$${n.toFixed(Math.min(12, нулей + 4))}`;
}

export function возраст(iso) {
  if (!iso) return "—";
  const мс = Date.now() - new Date(iso).getTime();
  if (!(мс > 0)) return "—";
  const мин = Math.floor(мс / 60000);
  if (мин < 60) return `${мин} мин`;
  const ч = Math.floor(мин / 60);
  if (ч < 24) return `${ч} ч`;
  return `${Math.floor(ч / 24)} д`;
}

export function число(v) {
  return (Number(v) || 0).toLocaleString("ru-RU");
}

export function Логотип({ src, тикер, размер = 30, крупно = false }) {
  const [сломан, setСломан] = useState(false);
  useEffect(() => { setСломан(false); }, [src]);
  const класс = крупно ? "лого лого-крупно" : "лого";
  const общее = {
    width: размер, height: размер, borderRadius: "50%", flexShrink: 0,
    background: Ц.панельВыше, border: `1px solid ${Ц.линия}`,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  if (!src || сломан) {
    return (
      <div className={класс} style={общее}>
        <span style={{ fontFamily: шрифт, fontSize: размер * 0.36, fontWeight: 700, color: Ц.слабый }}>
          {String(тикер || "?").slice(0, 2)}
        </span>
      </div>
    );
  }
  return <img className={класс} src={src} alt="" onError={() => setСломан(true)} style={{ ...общее, objectFit: "cover" }} />;
}

/* ---------- линия цены в строке списка ---------- */

/* Что было с ценой за сутки — одной линией.
 *
 * Проценты говорят, куда пришли, но не как: обвал с отскоком и ровный
 * подъём дают одинаковые «+40%». Линия отвечает на это раньше, чем глаз
 * доходит до цифр.
 *
 * Свечи грузятся только для строк, попавших на экран, и не больше трёх
 * запросов разом: в списке двести токенов, и тянуть историю на все —
 * это мегабайты ради двадцати видимых линий. Ответы держим в памяти
 * вкладки: прокрутка туда-обратно не должна спрашивать заново. */
const линииКеш = new Map();
const линииОчередь = [];
let линииИдёт = 0;

function следующая() {
  while (линииИдёт < 3 && линииОчередь.length) {
    const дело = линииОчередь.shift();
    линииИдёт += 1;
    дело().finally(() => { линииИдёт -= 1; следующая(); });
  }
}

function точкиЦены(пул, сеть) {
  const ключ = `${сеть}:${пул}`;
  const было = линииКеш.get(ключ);
  if (было && Date.now() - было.ts < 5 * 60 * 1000) return Promise.resolve(было.точки);
  return new Promise((готово) => {
    линииОчередь.push(() =>
      fetch(апи(`/api/chart?what=ohlcv&pool=${encodeURIComponent(пул)}&tf=M15&n=96&network=${сеть}`))
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const ряд = (j && j.data && j.data.attributes && j.data.attributes.ohlcv_list) || [];
          // Источник отдаёт от свежих к старым — разворачиваем, иначе
          // линия читается задом наперёд.
          const точки = ряд.map((с) => Number(с[4])).filter((v) => v > 0).reverse();
          линииКеш.set(ключ, { ts: Date.now(), точки });
          готово(точки);
        })
        .catch(() => { готово([]); }));
    следующая();
  });
}

export function Линия({ пул, сеть, рост, ширина = 84, высота = 30 }) {
  const блок = useRef(null);
  const [точки, setТочки] = useState(null);

  useEffect(() => {
    setТочки(null);
    const el = блок.current;
    if (!el || !пул) return;
    let жив = true;
    const наблюдатель = new IntersectionObserver((записи) => {
      if (!записи.some((з) => з.isIntersecting)) return;
      наблюдатель.disconnect();
      точкиЦены(пул, сеть).then((т) => { if (жив) setТочки(т); });
    }, { rootMargin: "160px" });
    наблюдатель.observe(el);
    return () => { жив = false; наблюдатель.disconnect(); };
  }, [пул, сеть]);

  const путь = useMemo(() => {
    if (!точки || точки.length < 2) return null;
    const макс = Math.max(...точки);
    const мин = Math.min(...точки);
    const размах = макс - мин || макс || 1;
    const шаг = ширина / (точки.length - 1);
    // Полтора пикселя сверху и снизу — под толщину самой линии, иначе
    // пики срезает краем.
    const y = (v) => 1.5 + (1 - (v - мин) / размах) * (высота - 3);
    return точки.map((v, i) => `${i ? "L" : "M"}${(i * шаг).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  }, [точки, ширина, высота]);

  const цвет = рост >= 0 ? Ц.рост : Ц.падение;
  const id = useId().replace(/:/g, "");

  return (
    <div ref={блок} style={{ width: ширина, height: высота, flexShrink: 0 }}>
      {путь && (
        <svg width={ширина} height={высота} viewBox={`0 0 ${ширина} ${высота}`} style={{ display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={цвет} stopOpacity="0.28" />
              <stop offset="100%" stopColor={цвет} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${путь} L${ширина} ${высота} L0 ${высота} Z`} fill={`url(#${id})`} />
          <path d={путь} fill="none" stroke={цвет} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

export function Движение({ v }) {
  const n = Number(v) || 0;
  return (
    <span style={{ fontFamily: цифры, fontSize: 13, fontVariantNumeric: "tabular-nums", color: n >= 0 ? Ц.рост : Ц.падение }}>
      {n >= 0 ? "+" : ""}{n.toFixed(1)}%
    </span>
  );
}
