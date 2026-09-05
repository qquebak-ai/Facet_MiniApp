/* Общее для экранов большого монитора: палитра, форматирование чисел и
   мелкие элементы. Вынесено отдельно, чтобы витрина и экран токена не
   держали по своей копии — разъехавшиеся цвета и разный формат цены на
   соседних экранах видно сразу. */

import React, { useEffect, useState } from "react";

export const Ц = {
  фон: "#08090B",
  панель: "#0E1014",
  панельВыше: "#14161C",
  линия: "#1E212A",
  линияЯрче: "#2A2E3A",
  текст: "#EDEFF5",
  тусклый: "#8A90A2",
  слабый: "#5C6274",
  акцент: "#6C7CFF",
  рост: "#2ED47A",
  падение: "#FF5C6C",
};

export const шрифт = "Montserrat, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
export const цифры = "'JetBrains Mono', 'SF Mono', Consolas, monospace";

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
      <div style={общее}>
        <span style={{ fontFamily: шрифт, fontSize: размер * 0.36, fontWeight: 700, color: Ц.слабый }}>
          {String(тикер || "?").slice(0, 2)}
        </span>
      </div>
    );
  }
  return <img src={src} alt="" onError={() => setСломан(true)} style={{ ...общее, objectFit: "cover" }} />;
}

export function Движение({ v }) {
  const n = Number(v) || 0;
  return (
    <span style={{ fontFamily: цифры, fontSize: 13, color: n >= 0 ? Ц.рост : Ц.падение }}>
      {n >= 0 ? "+" : ""}{n.toFixed(1)}%
    </span>
  );
}
