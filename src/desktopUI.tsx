/* Общее для экранов большого монитора: палитра, шрифт, форматирование
   чисел и мелкие элементы. Вынесено отдельно, чтобы витрина, экран
   токена и кошелёк не держали по своей копии — разъехавшиеся цвета и
   разный формат цены на соседних экранах видно сразу. */

import React, { useEffect, useState } from "react";

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
export const ПОЛОСА = 1180;

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

  /* Логотип токена при наведении подрастает: в таблице он размером с
     ноготь, и разглядеть картинку иначе нельзя. */
  .лого { transition: transform 180ms cubic-bezier(0.16,1,0.3,1), box-shadow 180ms ease; }
  .строка:hover .лого { transform: scale(1.75); box-shadow: 0 6px 18px rgba(0,0,0,0.6); z-index: 3; }

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

export function Логотип({ src, тикер, размер = 30 }) {
  const [сломан, setСломан] = useState(false);
  useEffect(() => { setСломан(false); }, [src]);
  const общее = {
    width: размер, height: размер, borderRadius: "50%", flexShrink: 0,
    background: Ц.панельВыше, border: `1px solid ${Ц.линия}`,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  if (!src || сломан) {
    return (
      <div className="лого" style={общее}>
        <span style={{ fontFamily: шрифт, fontSize: размер * 0.36, fontWeight: 700, color: Ц.слабый }}>
          {String(тикер || "?").slice(0, 2)}
        </span>
      </div>
    );
  }
  return <img className="лого" src={src} alt="" onError={() => setСломан(true)} style={{ ...общее, objectFit: "cover" }} />;
}

export function Движение({ v }) {
  const n = Number(v) || 0;
  return (
    <span style={{ fontFamily: цифры, fontSize: 13, fontVariantNumeric: "tabular-nums", color: n >= 0 ? Ц.рост : Ц.падение }}>
      {n >= 0 ? "+" : ""}{n.toFixed(1)}%
    </span>
  );
}
