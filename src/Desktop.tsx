/* Витрина рынка для большого экрана.
 *
 * Мини-приложение рассчитано на телефон в Telegram: один столбец, крупные
 * кнопки, по токену на экран. За монитором так смотреть рынок нельзя —
 * там нужна таблица, где два десятка токенов видно разом и колонки можно
 * сравнивать глазом. Поэтому десктоп — отдельный экран, а не растянутый
 * мобильный: общие у них данные, а не разметка.
 *
 * Данные те же, что у телефона: обход (api/refresh-feed.js) раз в минуту
 * складывает рынок в feed_cache, отсюда он читается одним запросом. Свечи
 * идут через свой прокси (api/chart.js), чтобы не бить в биржевой
 * источник с каждой вкладки.
 *
 * Сделка на большом экране пока не подписывается: кошелёк и подтверждение
 * живут в мини-приложении, поэтому «Купить» ведёт в него с уже выбранным
 * токеном.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

const БОТ = import.meta.env.VITE_TG_BOT || "MintlyAppBot";

/* Цвета держим здесь же: тема мини-приложения завязана на его настройки
   и на Telegram, а у сайта своего переключателя нет. */
const Ц = {
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

const шрифт = "Montserrat, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const цифры = "'JetBrains Mono', 'SF Mono', Consolas, monospace";

const СЕТИ = [
  { id: "ton", подпись: "TON", сеть: "ton" },
  { id: "sol", подпись: "Solana", сеть: "solana" },
];

const ВКЛАДКИ = [
  { id: "trending", подпись: "Популярные" },
  { id: "new", подпись: "Новые" },
  { id: "gainers", подпись: "В росте" },
];

const ТАЙМФРЕЙМЫ = ["M5", "M15", "H1", "H4", "D1"];

/* ---------- числа ---------- */

function деньги(v) {
  const n = Number(v) || 0;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(n < 10 ? 2 : 0)}`;
}

function цена(v) {
  const n = Number(v) || 0;
  if (!n) return "$0";
  if (n >= 1) return `$${n.toFixed(3)}`;
  // У мемкоинов цена — это нули после запятой: обычная запись съедает
  // все значащие цифры, поэтому считаем, сколько нулей пропустить.
  const нулей = Math.max(0, -Math.floor(Math.log10(n)) - 1);
  return `$${n.toFixed(Math.min(12, нулей + 4))}`;
}

function возраст(iso) {
  if (!iso) return "—";
  const мс = Date.now() - new Date(iso).getTime();
  if (!(мс > 0)) return "—";
  const мин = Math.floor(мс / 60000);
  if (мин < 60) return `${мин} мин`;
  const ч = Math.floor(мин / 60);
  if (ч < 24) return `${ч} ч`;
  return `${Math.floor(ч / 24)} д`;
}

function число(v) {
  return (Number(v) || 0).toLocaleString("ru-RU");
}

/* ---------- данные ---------- */

/* Строка кеша к тому виду, в котором её рисует таблица. Имена полей
   намеренно другие, чем в базе: колонки не должны знать про схему. */
function изКеша(r) {
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
  };
}

async function загрузитьРынок(сеть) {
  const { data, error } = await supabase
    .from("feed_cache")
    .select("*")
    .eq("chain", сеть)
    .order("tx24", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).map(изКеша).filter((t) => t.пул && t.цена > 0);
}

/* ---------- разметка ---------- */

function Логотип({ src, тикер, размер = 30 }) {
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

function Движение({ v }) {
  const n = Number(v) || 0;
  const цвет = n >= 0 ? Ц.рост : Ц.падение;
  return (
    <span style={{ fontFamily: цифры, fontSize: 13, color: цвет }}>
      {n >= 0 ? "+" : ""}{n.toFixed(1)}%
    </span>
  );
}

/* Свечи рисуются на канве вручную: библиотека графиков ради одного
   экрана тянет больше кода, чем весь этот файл. */
function Свечи({ данные, высота = 320 }) {
  const холст = useRef(null);

  useEffect(() => {
    const c = холст.current;
    if (!c) return;
    const ш = c.clientWidth;
    const в = высота;
    const плотность = window.devicePixelRatio || 1;
    c.width = ш * плотность;
    c.height = в * плотность;
    const ctx = c.getContext("2d");
    ctx.setTransform(плотность, 0, 0, плотность, 0, 0);
    ctx.clearRect(0, 0, ш, в);
    if (!данные || данные.length < 2) {
      ctx.fillStyle = Ц.слабый;
      ctx.font = `13px ${шрифт}`;
      ctx.fillText("Нет свечей за этот период", 14, в / 2);
      return;
    }

    const поле = { слева: 8, справа: 66, сверху: 12, снизу: 22 };
    const ширинаПоля = ш - поле.слева - поле.справа;
    const высотаПоля = в - поле.сверху - поле.снизу;
    const макс = Math.max(...данные.map((с) => с.h));
    const мин = Math.min(...данные.map((с) => с.l));
    const размах = макс - мин || макс || 1;
    const y = (v) => поле.сверху + (1 - (v - мин) / размах) * высотаПоля;
    const шагX = ширинаПоля / данные.length;

    // Сетка и подписи цен по правому краю — как в биржевых терминалах.
    ctx.strokeStyle = Ц.линия;
    ctx.fillStyle = Ц.слабый;
    ctx.font = `11px ${цифры}`;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const v = мин + (размах * i) / 4;
      const yy = Math.round(y(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(поле.слева, yy);
      ctx.lineTo(поле.слева + ширинаПоля, yy);
      ctx.stroke();
      ctx.fillText(цена(v), поле.слева + ширинаПоля + 8, yy + 4);
    }

    const тело = Math.max(1, Math.min(9, шагX * 0.62));
    данные.forEach((с, i) => {
      const x = поле.слева + i * шагX + шагX / 2;
      const рост = с.c >= с.o;
      ctx.strokeStyle = рост ? Ц.рост : Ц.падение;
      ctx.fillStyle = рост ? Ц.рост : Ц.падение;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, y(с.h));
      ctx.lineTo(Math.round(x) + 0.5, y(с.l));
      ctx.stroke();
      const верх = y(Math.max(с.o, с.c));
      const низ = y(Math.min(с.o, с.c));
      ctx.fillRect(x - тело / 2, верх, тело, Math.max(1, низ - верх));
    });
  }, [данные, высота]);

  return <canvas ref={холст} style={{ width: "100%", height: высота, display: "block" }} />;
}

function Панель({ токен, наЗакрытие }) {
  const [тф, setТф] = useState("H1");
  const [свечи, setСвечи] = useState(null);
  const [грузится, setГрузится] = useState(true);

  useEffect(() => {
    let жив = true;
    setГрузится(true);
    setСвечи(null);
    const адрес = `/api/chart?what=ohlcv&pool=${encodeURIComponent(токен.пул)}&tf=${тф}&network=${токен.сеть}`;
    fetch(адрес)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!жив) return;
        const список = (j && j.data && j.data.attributes && j.data.attributes.ohlcv_list) || [];
        // Источник отдаёт от новых к старым; рисуем слева направо.
        const свечиСписком = список
          .map((s) => ({ t: s[0], o: Number(s[1]), h: Number(s[2]), l: Number(s[3]), c: Number(s[4]) }))
          .filter((s) => s.o > 0 && s.h > 0)
          .reverse()
          .slice(-160);
        setСвечи(свечиСписком);
        setГрузится(false);
      })
      .catch(() => { if (жив) { setСвечи([]); setГрузится(false); } });
    return () => { жив = false; };
  }, [токен.пул, токен.сеть, тф]);

  const ссылкаВПриложение = `https://t.me/${БОТ}?start=tok_${encodeURIComponent(токен.адрес || токен.пул)}`;

  return (
    <aside
      style={{
        width: 420, flexShrink: 0, background: Ц.панель, borderLeft: `1px solid ${Ц.линия}`,
        display: "flex", flexDirection: "column", overflowY: "auto",
      }}
    >
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${Ц.линия}`, display: "flex", alignItems: "center", gap: 12 }}>
        <Логотип src={токен.лого} тикер={токен.тикер} размер={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: шрифт, fontWeight: 700, fontSize: 16, color: Ц.текст }}>${токен.тикер}</div>
          <div style={{ fontFamily: шрифт, fontSize: 12.5, color: Ц.тусклый, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {токен.имя}{токен.биржа ? ` · ${токен.биржа}` : ""}
          </div>
        </div>
        <button
          onClick={наЗакрытие}
          style={{ background: "transparent", border: "none", color: Ц.тусклый, fontSize: 18, cursor: "pointer", padding: 6 }}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      <div style={{ padding: "14px 18px", display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: цифры, fontSize: 26, fontWeight: 700, color: Ц.текст }}>{цена(токен.цена)}</span>
        <Движение v={токен.движение} />
      </div>

      <div style={{ display: "flex", gap: 6, padding: "0 18px 10px" }}>
        {ТАЙМФРЕЙМЫ.map((f) => (
          <button
            key={f}
            onClick={() => setТф(f)}
            style={{
              fontFamily: цифры, fontSize: 12, padding: "5px 10px", borderRadius: 8, cursor: "pointer",
              background: тф === f ? Ц.панельВыше : "transparent",
              border: `1px solid ${тф === f ? Ц.линияЯрче : "transparent"}`,
              color: тф === f ? Ц.текст : Ц.слабый,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 12px" }}>
        {грузится ? (
          <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: шрифт, fontSize: 13, color: Ц.слабый }}>
            Загружаем свечи…
          </div>
        ) : (
          <Свечи данные={свечи} />
        )}
      </div>

      <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          ["Капитализация", деньги(токен.капитализация)],
          ["Ликвидность", деньги(токен.ликвидность)],
          ["Объём 24ч", деньги(токен.объём)],
          ["Сделок 24ч", число(токен.сделки)],
          ["Возраст", возраст(токен.создан)],
          ["Сеть", токен.сеть === "solana" ? "Solana" : "TON"],
        ].map(([п, з]) => (
          <div key={п} style={{ background: Ц.панельВыше, border: `1px solid ${Ц.линия}`, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontFamily: шрифт, fontSize: 11.5, color: Ц.слабый }}>{п}</div>
            <div style={{ fontFamily: цифры, fontSize: 15, color: Ц.текст, marginTop: 3 }}>{з}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "0 18px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Подпись сделки живёт в мини-приложении вместе с кошельком,
            поэтому покупка уводит туда с уже выбранным токеном. */}
        <a
          href={ссылкаВПриложение}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block", textAlign: "center", padding: "12px 0", borderRadius: 12,
            background: Ц.акцент, color: "#0B0D1A", fontFamily: шрифт, fontWeight: 700, fontSize: 14.5,
            textDecoration: "none",
          }}
        >
          Купить в Telegram
        </a>
        {токен.адрес && (
          <button
            onClick={() => navigator.clipboard && navigator.clipboard.writeText(токен.адрес)}
            style={{
              padding: "10px 0", borderRadius: 12, cursor: "pointer",
              background: "transparent", border: `1px solid ${Ц.линия}`, color: Ц.тусклый,
              fontFamily: цифры, fontSize: 12.5,
            }}
          >
            {`${токен.адрес.slice(0, 8)}…${токен.адрес.slice(-6)}`} · копировать
          </button>
        )}
      </div>
    </aside>
  );
}

const КОЛОНКИ = [
  { id: "токен", подпись: "Токен", ширина: "minmax(220px, 2fr)", поле: null },
  { id: "цена", подпись: "Цена", ширина: "1fr", поле: "цена" },
  { id: "движение", подпись: "24ч", ширина: "0.7fr", поле: "движение" },
  { id: "капитализация", подпись: "Капитализация", ширина: "1fr", поле: "капитализация" },
  { id: "ликвидность", подпись: "Ликвидность", ширина: "1fr", поле: "ликвидность" },
  { id: "объём", подпись: "Объём 24ч", ширина: "1fr", поле: "объём" },
  { id: "сделки", подпись: "Сделок", ширина: "0.8fr", поле: "сделки" },
  { id: "возраст", подпись: "Возраст", ширина: "0.7fr", поле: "создан" },
];

/* Одна раскладка на шапку и на строки: если ширины разъедутся, колонки
   перестанут совпадать с заголовками. */
const СЕТКА = КОЛОНКИ.map((к) => к.ширина).join(" ");

export default function Desktop() {
  const [сеть, setСеть] = useState(() => (localStorage.getItem("mintly.pro.chain") === "solana" ? "solana" : "ton"));
  const [вкладка, setВкладка] = useState("trending");
  const [строки, setСтроки] = useState(null);
  const [ошибка, setОшибка] = useState(null);
  const [поиск, setПоиск] = useState("");
  const [сорт, setСорт] = useState({ поле: "объём", по_убыв: true });
  const [выбран, setВыбран] = useState(null);

  const обновить = useCallback(() => {
    загрузитьРынок(сеть)
      .then((список) => { setСтроки(список); setОшибка(null); })
      .catch((e) => setОшибка(String((e && e.message) || e)));
  }, [сеть]);

  useEffect(() => {
    setСтроки(null);
    обновить();
    // Обход обновляет кеш раз в минуту — чаще спрашивать нечего.
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") обновить();
    }, 30000);
    return () => clearInterval(iv);
  }, [обновить]);

  useEffect(() => { localStorage.setItem("mintly.pro.chain", сеть); }, [сеть]);

  const список = useMemo(() => {
    if (!строки) return null;
    let ряд = строки;
    const q = поиск.trim().toLowerCase().replace(/^\$/, "");
    if (q) {
      ряд = ряд.filter((t) =>
        String(t.тикер || "").toLowerCase().includes(q)
        || String(t.имя || "").toLowerCase().includes(q)
        || String(t.адрес || "").toLowerCase() === q);
    }
    if (вкладка === "new") {
      const сутки = Date.now() - 24 * 60 * 60 * 1000;
      ряд = ряд.filter((t) => t.создан && new Date(t.создан).getTime() > сутки);
    }
    if (вкладка === "gainers") ряд = ряд.filter((t) => t.движение > 0);
    const поле = вкладка === "new" ? "создан" : сорт.поле;
    const убыв = вкладка === "new" ? true : сорт.по_убыв;
    const знач = (t) => (поле === "создан" ? new Date(t.создан || 0).getTime() : Number(t[поле]) || 0);
    return [...ряд].sort((a, b) => (убыв ? знач(b) - знач(a) : знач(a) - знач(b)));
  }, [строки, поиск, вкладка, сорт]);

  function переключитьСорт(поле) {
    if (!поле) return;
    setСорт((s) => (s.поле === поле ? { поле, по_убыв: !s.по_убыв } : { поле, по_убыв: true }));
  }

  return (
    <div style={{ minHeight: "100vh", background: Ц.фон, color: Ц.текст, fontFamily: шрифт, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          height: 56, flexShrink: 0, borderBottom: `1px solid ${Ц.линия}`, background: Ц.панель,
          display: "flex", alignItems: "center", gap: 18, padding: "0 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <img src="/hero-bot.png" alt="" style={{ display: "none" }} />
          <span style={{ fontFamily: шрифт, fontWeight: 800, fontSize: 17, letterSpacing: "-0.01em" }}>MINTLY</span>
          <span style={{ fontFamily: шрифт, fontSize: 11, color: Ц.акцент, border: `1px solid ${Ц.акцент}`, borderRadius: 6, padding: "1px 6px" }}>
            PRO
          </span>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {ВКЛАДКИ.map((в) => (
            <button
              key={в.id}
              onClick={() => setВкладка(в.id)}
              style={{
                fontFamily: шрифт, fontSize: 13.5, fontWeight: 600, padding: "7px 12px", borderRadius: 9, cursor: "pointer",
                background: вкладка === в.id ? Ц.панельВыше : "transparent",
                border: "none", color: вкладка === в.id ? Ц.текст : Ц.тусклый,
              }}
            >
              {в.подпись}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 2, background: Ц.панельВыше, borderRadius: 10, padding: 3 }}>
          {СЕТИ.map((с) => (
            <button
              key={с.id}
              onClick={() => { setСеть(с.сеть); setВыбран(null); }}
              style={{
                fontFamily: шрифт, fontSize: 12.5, fontWeight: 700, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                background: сеть === с.сеть ? Ц.акцент : "transparent",
                border: "none", color: сеть === с.сеть ? "#0B0D1A" : Ц.тусклый,
              }}
            >
              {с.подпись}
            </button>
          ))}
        </div>

        <input
          value={поиск}
          onChange={(e) => setПоиск(e.target.value)}
          placeholder="Тикер, название или адрес"
          style={{
            flex: 1, maxWidth: 360, height: 34, padding: "0 12px", borderRadius: 10,
            background: Ц.панельВыше, border: `1px solid ${Ц.линия}`, color: Ц.текст,
            fontFamily: шрифт, fontSize: 13, outline: "none",
          }}
        />

        <a
          href={`https://t.me/${БОТ}`}
          target="_blank"
          rel="noreferrer"
          style={{
            marginLeft: "auto", fontFamily: шрифт, fontSize: 13, fontWeight: 600, color: Ц.текст,
            textDecoration: "none", padding: "8px 14px", borderRadius: 10, border: `1px solid ${Ц.линияЯрче}`,
          }}
        >
          Открыть в Telegram
        </a>
      </header>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "grid", gridTemplateColumns: СЕТКА, gap: 14, padding: "10px 20px",
              borderBottom: `1px solid ${Ц.линия}`, position: "sticky", top: 0, background: Ц.фон, zIndex: 2,
            }}
          >
            {КОЛОНКИ.map((к) => (
              <button
                key={к.id}
                onClick={() => переключитьСорт(к.поле)}
                style={{
                  textAlign: к.id === "токен" ? "left" : "right",
                  background: "transparent", border: "none", padding: 0,
                  cursor: к.поле ? "pointer" : "default",
                  fontFamily: шрифт, fontSize: 11.5, letterSpacing: "0.04em", textTransform: "uppercase",
                  color: сорт.поле === к.поле ? Ц.текст : Ц.слабый,
                }}
              >
                {к.подпись}{сорт.поле === к.поле ? (сорт.по_убыв ? " ↓" : " ↑") : ""}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {ошибка && (
              <div style={{ padding: 20, fontFamily: шрифт, fontSize: 13.5, color: Ц.падение }}>
                Не удалось загрузить рынок: {ошибка}
              </div>
            )}
            {!список && !ошибка && (
              <div style={{ padding: 20, fontFamily: шрифт, fontSize: 13.5, color: Ц.слабый }}>Загружаем рынок…</div>
            )}
            {список && !список.length && (
              <div style={{ padding: 20, fontFamily: шрифт, fontSize: 13.5, color: Ц.слабый }}>
                По этому фильтру пусто.
              </div>
            )}
            {(список || []).map((t) => {
              const активна = выбран && выбран.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setВыбран(t)}
                  style={{
                    display: "grid", gridTemplateColumns: СЕТКА, gap: 14, alignItems: "center",
                    padding: "9px 20px", cursor: "pointer",
                    borderBottom: `1px solid ${Ц.линия}`,
                    background: активна ? Ц.панельВыше : "transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Логотип src={t.лого} тикер={t.тикер} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: шрифт, fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        ${t.тикер}
                      </div>
                      <div style={{ fontFamily: шрифт, fontSize: 11.5, color: Ц.тусклый, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.имя}{t.биржа ? ` · ${t.биржа}` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontFamily: цифры, fontSize: 13 }}>{цена(t.цена)}</div>
                  <div style={{ textAlign: "right" }}><Движение v={t.движение} /></div>
                  <div style={{ textAlign: "right", fontFamily: цифры, fontSize: 13 }}>{деньги(t.капитализация)}</div>
                  <div style={{ textAlign: "right", fontFamily: цифры, fontSize: 13, color: Ц.тусклый }}>{деньги(t.ликвидность)}</div>
                  <div style={{ textAlign: "right", fontFamily: цифры, fontSize: 13, color: Ц.тусклый }}>{деньги(t.объём)}</div>
                  <div style={{ textAlign: "right", fontFamily: цифры, fontSize: 13, color: Ц.тусклый }}>{число(t.сделки)}</div>
                  <div style={{ textAlign: "right", fontFamily: цифры, fontSize: 12.5, color: Ц.слабый }}>{возраст(t.создан)}</div>
                </div>
              );
            })}
          </div>
        </main>

        {выбран && <Панель токен={выбран} наЗакрытие={() => setВыбран(null)} />}
      </div>
    </div>
  );
}
