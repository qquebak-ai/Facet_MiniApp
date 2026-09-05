/* Экран токена на большом мониторе.
 *
 * Раскладка биржевого терминала: шапка с ключевыми числами, во всю
 * оставшуюся ширину — график, справа торговая панель, снизу вкладки со
 * сделками и держателями. На телефоне так нельзя — там всё это идёт
 * одной колонкой и по очереди, — а на мониторе иначе и не смотрят: цену,
 * стакан сделок и кнопку покупки держат перед глазами одновременно.
 *
 * Свечи и сделки идут через свой прокси (api/chart.js): он кеширует
 * ответы источника, поэтому десяток открытых вкладок не выбивает лимит.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Ц, шрифт, цифры, деньги, цена, возраст, число, Логотип, Движение } from "./desktopUI";
import { состояниеВнутреннего, сделкаВнутренним } from "./appWallet";

const БОТ = import.meta.env.VITE_TG_BOT || "MintlyAppBot";

const ТАЙМФРЕЙМЫ = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];
const БЫСТРЫЕ_TON = [0.5, 1, 5, 10];
const БЫСТРЫЕ_SOL = [0.05, 0.1, 0.5, 1];

/* ---------- график ---------- */

/* Свечи рисуются на канве вручную: библиотека графиков ради одного
   экрана тянет больше кода, чем весь этот файл, а нужны от неё две вещи
   — тела свечей и шкалы. */
function График({ свечи, наведение = true }) {
  const обёртка = useRef(null);
  const холст = useRef(null);
  const [размер, setРазмер] = useState({ ш: 0, в: 0 });
  const [курсор, setКурсор] = useState(null);

  useEffect(() => {
    const el = обёртка.current;
    if (!el) return;
    const следить = new ResizeObserver(() => {
      setРазмер({ ш: el.clientWidth, в: el.clientHeight });
    });
    следить.observe(el);
    setРазмер({ ш: el.clientWidth, в: el.clientHeight });
    return () => следить.disconnect();
  }, []);

  const поле = { слева: 0, справа: 78, сверху: 14, снизу: 26 };

  const геометрия = useMemo(() => {
    if (!свечи || свечи.length < 2 || !размер.ш) return null;
    const ширина = размер.ш - поле.слева - поле.справа;
    const высота = размер.в - поле.сверху - поле.снизу;
    const макс = Math.max(...свечи.map((с) => с.h));
    const мин = Math.min(...свечи.map((с) => с.l));
    const размах = макс - мин || макс || 1;
    return {
      ширина, высота, макс, мин, размах,
      шагX: ширина / свечи.length,
      y: (v) => поле.сверху + (1 - (v - мин) / размах) * высота,
    };
  }, [свечи, размер]);

  useEffect(() => {
    const c = холст.current;
    if (!c || !размер.ш) return;
    const плотность = window.devicePixelRatio || 1;
    c.width = размер.ш * плотность;
    c.height = размер.в * плотность;
    const ctx = c.getContext("2d");
    ctx.setTransform(плотность, 0, 0, плотность, 0, 0);
    ctx.clearRect(0, 0, размер.ш, размер.в);

    if (!геометрия) {
      ctx.fillStyle = Ц.слабый;
      ctx.font = `13px ${шрифт}`;
      ctx.fillText(свечи ? "За этот период сделок не было" : "Загружаем свечи…", 16, размер.в / 2);
      return;
    }

    const { ширина, высота, мин, размах, шагX, y } = геометрия;

    // Сетка: по цене — пять уровней, по времени — примерно каждые 90 px.
    ctx.strokeStyle = Ц.линия;
    ctx.lineWidth = 1;
    ctx.font = `11px ${цифры}`;
    ctx.fillStyle = Ц.слабый;
    for (let i = 0; i <= 5; i++) {
      const v = мин + (размах * i) / 5;
      const yy = Math.round(y(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(ширина, yy);
      ctx.stroke();
      ctx.fillText(цена(v), ширина + 10, yy + 4);
    }
    const шагПодписи = Math.max(1, Math.round(90 / шагX));
    свечи.forEach((с, i) => {
      if (i % шагПодписи) return;
      const x = поле.слева + i * шагX + шагX / 2;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, поле.сверху);
      ctx.lineTo(Math.round(x) + 0.5, поле.сверху + высота);
      ctx.strokeStyle = Ц.линия;
      ctx.stroke();
      const время = new Date(с.t * 1000);
      const метка = `${String(время.getHours()).padStart(2, "0")}:${String(время.getMinutes()).padStart(2, "0")}`;
      ctx.fillStyle = Ц.слабый;
      ctx.fillText(метка, x - 14, размер.в - 8);
    });

    // Сами свечи.
    const тело = Math.max(1, Math.min(12, шагX * 0.66));
    свечи.forEach((с, i) => {
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

    // Последняя цена — пунктиром на всю ширину, как в терминалах.
    const последняя = свечи[свечи.length - 1];
    const yy = Math.round(y(последняя.c)) + 0.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = последняя.c >= последняя.o ? Ц.рост : Ц.падение;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(ширина, yy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = последняя.c >= последняя.o ? Ц.рост : Ц.падение;
    ctx.fillRect(ширина + 4, yy - 9, поле.справа - 6, 18);
    ctx.fillStyle = "#06070A";
    ctx.font = `600 11px ${цифры}`;
    ctx.fillText(цена(последняя.c), ширина + 8, yy + 4);

    // Перекрестие под курсором.
    if (курсор && наведение) {
      ctx.strokeStyle = Ц.линияЯрче;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(курсор.x, поле.сверху);
      ctx.lineTo(курсор.x, поле.сверху + высота);
      ctx.moveTo(0, курсор.y);
      ctx.lineTo(ширина, курсор.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [свечи, размер, геометрия, курсор, наведение]);

  // Свеча под курсором — её значения показываются в углу графика.
  const подКурсором = useMemo(() => {
    if (!курсор || !геометрия || !свечи) return null;
    const i = Math.floor((курсор.x - поле.слева) / геометрия.шагX);
    return свечи[Math.max(0, Math.min(свечи.length - 1, i))] || null;
  }, [курсор, геометрия, свечи]);

  return (
    <div
      ref={обёртка}
      style={{ position: "relative", width: "100%", height: "100%" }}
      onMouseMove={(e) => {
        const r = обёртка.current.getBoundingClientRect();
        setКурсор({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseLeave={() => setКурсор(null)}
    >
      <canvas ref={холст} style={{ width: "100%", height: "100%", display: "block" }} />
      {подКурсором && (
        <div
          style={{
            position: "absolute", left: 12, top: 10, display: "flex", gap: 12,
            fontFamily: цифры, fontSize: 11.5, color: Ц.тусклый, pointerEvents: "none",
          }}
        >
          {[["О", подКурсором.o], ["Н", подКурсором.h], ["Н", подКурсором.l], ["З", подКурсором.c]].map(([п, v], i) => (
            <span key={i}>{п} <span style={{ color: Ц.текст }}>{цена(v)}</span></span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- нижние вкладки ---------- */

function Сделки({ токен }) {
  const [строки, setСтроки] = useState(null);

  useEffect(() => {
    let жив = true;
    const грузить = () => {
      fetch(`/api/chart?what=trades&pool=${encodeURIComponent(токен.пул)}&network=${токен.сеть}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!жив) return;
          const ряд = (j && j.data) || [];
          setСтроки(ряд.map((t) => {
            const a = t.attributes || {};
            return {
              id: t.id,
              покупка: String(a.kind || "").includes("buy"),
              время: a.block_timestamp,
              сумма: Number(a.volume_in_usd) || 0,
              цена: Number(a.price_to_in_usd || a.price_from_in_usd) || 0,
              кто: a.tx_from_address || "",
            };
          }).slice(0, 60));
        })
        .catch(() => { if (жив) setСтроки([]); });
    };
    грузить();
    const iv = setInterval(() => { if (document.visibilityState === "visible") грузить(); }, 15000);
    return () => { жив = false; clearInterval(iv); };
  }, [токен.пул, токен.сеть]);

  if (!строки) return <Пусто>Загружаем сделки…</Пусто>;
  if (!строки.length) return <Пусто>Сделок пока нет.</Пусто>;

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr 1fr 1fr", gap: 12, padding: "6px 16px", position: "sticky", top: 0, background: Ц.фон }}>
        {["Время", "Тип", "Объём", "Цена", "Адрес"].map((з) => (
          <span key={з} style={{ fontFamily: шрифт, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: Ц.слабый }}>{з}</span>
        ))}
      </div>
      {строки.map((с) => (
        <div key={с.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr 1fr 1fr", gap: 12, padding: "5px 16px", fontFamily: цифры, fontSize: 12.5 }}>
          <span style={{ color: Ц.слабый }}>
            {с.время ? new Date(с.время).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
          </span>
          <span style={{ color: с.покупка ? Ц.рост : Ц.падение }}>{с.покупка ? "покупка" : "продажа"}</span>
          <span style={{ color: Ц.текст }}>{деньги(с.сумма)}</span>
          <span style={{ color: Ц.тусклый }}>{цена(с.цена)}</span>
          <span style={{ color: Ц.слабый }}>{с.кто ? `${с.кто.slice(0, 6)}…${с.кто.slice(-4)}` : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function Пусто({ children }) {
  return (
    <div style={{ padding: 18, fontFamily: шрифт, fontSize: 13, color: Ц.слабый }}>{children}</div>
  );
}

function ОТокене({ токен }) {
  const строки = [
    ["Сеть", токен.сеть === "solana" ? "Solana" : "TON"],
    ["Биржа", токен.биржа || "—"],
    ["Возраст пула", возраст(токен.создан)],
    ["Капитализация", деньги(токен.капитализация)],
    ["Ликвидность", деньги(токен.ликвидность)],
    ["Объём 24ч", деньги(токен.объём)],
    ["Сделок 24ч", число(токен.сделки)],
    ["Адрес токена", токен.адрес || "—"],
    ["Адрес пула", токен.пул || "—"],
  ];
  return (
    <div style={{ padding: "10px 16px", overflowY: "auto", height: "100%" }}>
      {строки.map(([п, з]) => (
        <div key={п} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "6px 0", borderBottom: `1px solid ${Ц.линия}` }}>
          <span style={{ fontFamily: шрифт, fontSize: 12.5, color: Ц.тусклый }}>{п}</span>
          <span style={{ fontFamily: цифры, fontSize: 12.5, color: Ц.текст, wordBreak: "break-all", textAlign: "right" }}>{з}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- экран ---------- */

export default function DesktopToken({ токен, наНазад }) {
  const [тф, setТф] = useState("M15");
  const [свечи, setСвечи] = useState(null);
  const [вкладка, setВкладка] = useState("trades");
  const [сторона, setСторона] = useState("buy");
  const [сумма, setСумма] = useState("");
  // Кошелёк приложения есть только у токенов Solana и только у вошедших:
  // тогда сделка проходит прямо здесь, без ухода в Telegram.
  const [кош, setКош] = useState(null);
  const [идёт, setИдёт] = useState(false);
  const [итог, setИтог] = useState("");

  useEffect(() => {
    if (токен.сеть !== "solana") { setКош(null); return; }
    let жив = true;
    состояниеВнутреннего()
      .then((с) => { if (жив) setКош(с && !с.нуженВход && !с.ошибка ? с : null); })
      .catch(() => { if (жив) setКош(null); });
    return () => { жив = false; };
  }, [токен.сеть, токен.адрес]);

  async function сделать() {
    if (идёт || !(Number(сумма) > 0) || !токен.адрес) return;
    setИдёт(true);
    setИтог("");
    try {
      await сделкаВнутренним({ mint: токен.адрес, продажа: сторона === "sell", amount: Number(сумма) });
      setИтог(сторона === "buy" ? "Куплено" : "Продано");
      setСумма("");
      состояниеВнутреннего().then((с) => setКош(с && !с.нуженВход && !с.ошибка ? с : null)).catch(() => {});
    } catch (e) {
      setИтог(String((e && e.message) || e).slice(0, 120));
    } finally {
      setИдёт(false);
    }
  }

  useEffect(() => {
    let жив = true;
    setСвечи(null);
    const грузить = () => {
      fetch(`/api/chart?what=ohlcv&pool=${encodeURIComponent(токен.пул)}&tf=${тф}&network=${токен.сеть}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!жив) return;
          const список = (j && j.data && j.data.attributes && j.data.attributes.ohlcv_list) || [];
          setСвечи(список
            .map((s) => ({ t: s[0], o: Number(s[1]), h: Number(s[2]), l: Number(s[3]), c: Number(s[4]), v: Number(s[5]) }))
            .filter((s) => s.o > 0 && s.h > 0)
            .reverse()
            .slice(-220));
        })
        .catch(() => { if (жив) setСвечи([]); });
    };
    грузить();
    // Свежая свеча дорисовывается сама: смотреть на застывший график,
    // пока рядом идут сделки, — худшее, что может делать терминал.
    const iv = setInterval(() => { if (document.visibilityState === "visible") грузить(); }, 20000);
    return () => { жив = false; clearInterval(iv); };
  }, [токен.пул, токен.сеть, тф]);

  const монета = токен.сеть === "solana" ? "SOL" : "TON";
  const быстрые = токен.сеть === "solana" ? БЫСТРЫЕ_SOL : БЫСТРЫЕ_TON;
  const ссылка = `https://t.me/${БОТ}?start=tok_${encodeURIComponent(токен.адрес || токен.пул)}`;

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Шапка: всё, ради чего открывают токен, — в одну строку. */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 18px", borderBottom: `1px solid ${Ц.линия}`, background: Ц.панель }}>
        <button
          onClick={наНазад}
          style={{ background: "transparent", border: `1px solid ${Ц.линия}`, color: Ц.тусклый, borderRadius: 9, padding: "6px 12px", cursor: "pointer", fontFamily: шрифт, fontSize: 12.5 }}
        >
          ← Рынок
        </button>
        <Логотип src={токен.лого} тикер={токен.тикер} размер={34} />
        <div>
          <div style={{ fontFamily: шрифт, fontWeight: 700, fontSize: 15 }}>${токен.тикер}</div>
          <div style={{ fontFamily: шрифт, fontSize: 11.5, color: Ц.тусклый }}>{токен.имя}{токен.биржа ? ` · ${токен.биржа}` : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 22, marginLeft: 12 }}>
          {[
            ["Цена", цена(токен.цена)],
            ["Капитализация", деньги(токен.капитализация)],
            ["Ликвидность", деньги(токен.ликвидность)],
            ["Объём 24ч", деньги(токен.объём)],
            ["Сделок", число(токен.сделки)],
            ["Возраст", возраст(токен.создан)],
          ].map(([п, з]) => (
            <div key={п}>
              <div style={{ fontFamily: шрифт, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: Ц.слабый }}>{п}</div>
              <div style={{ fontFamily: цифры, fontSize: 13.5, color: Ц.текст, marginTop: 2 }}>{з}</div>
            </div>
          ))}
          <div>
            <div style={{ fontFamily: шрифт, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: Ц.слабый }}>24ч</div>
            <div style={{ marginTop: 2 }}><Движение v={токен.движение} /></div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Левая половина: график и вкладки под ним. */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderBottom: `1px solid ${Ц.линия}` }}>
            {ТАЙМФРЕЙМЫ.map((f) => (
              <button
                key={f}
                onClick={() => setТф(f)}
                style={{
                  fontFamily: цифры, fontSize: 12, padding: "4px 10px", borderRadius: 7, cursor: "pointer",
                  background: тф === f ? Ц.панельВыше : "transparent",
                  border: `1px solid ${тф === f ? Ц.линияЯрче : "transparent"}`,
                  color: тф === f ? Ц.текст : Ц.слабый,
                }}
              >
                {f}
              </button>
            ))}
            <span style={{ marginLeft: 10, fontFamily: шрифт, fontSize: 11.5, color: Ц.слабый }}>
              {токен.тикер}/{монета} · свечи по данным биржи
            </span>
          </div>

          <div style={{ flex: 1, minHeight: 220, padding: "4px 10px 0" }}>
            <График свечи={свечи} />
          </div>

          <div style={{ height: 240, borderTop: `1px solid ${Ц.линия}`, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", gap: 4, padding: "6px 14px", borderBottom: `1px solid ${Ц.линия}` }}>
              {[["trades", "Сделки"], ["about", "О токене"]].map(([id, п]) => (
                <button
                  key={id}
                  onClick={() => setВкладка(id)}
                  style={{
                    fontFamily: шрифт, fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                    background: вкладка === id ? Ц.панельВыше : "transparent", border: "none",
                    color: вкладка === id ? Ц.текст : Ц.тусклый,
                  }}
                >
                  {п}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {вкладка === "trades" ? <Сделки токен={токен} /> : <ОТокене токен={токен} />}
            </div>
          </div>
        </div>

        {/* Правая колонка: торговая панель. */}
        <aside style={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${Ц.линия}`, background: Ц.панель, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={{ display: "flex", padding: 12, gap: 6 }}>
            {[["buy", "Купить"], ["sell", "Продать"]].map(([id, п]) => (
              <button
                key={id}
                onClick={() => setСторона(id)}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", border: "none",
                  fontFamily: шрифт, fontWeight: 700, fontSize: 13.5,
                  background: сторона === id ? (id === "buy" ? Ц.рост : Ц.падение) : Ц.панельВыше,
                  color: сторона === id ? "#06070A" : Ц.тусклый,
                }}
              >
                {п}
              </button>
            ))}
          </div>

          <div style={{ padding: "0 12px" }}>
            <div style={{ fontFamily: шрифт, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: Ц.слабый, marginBottom: 6 }}>
              Сумма, {сторона === "buy" ? монета : токен.тикер}
            </div>
            <input
              value={сумма}
              onChange={(e) => setСумма(e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))}
              placeholder="0.0"
              inputMode="decimal"
              style={{
                width: "100%", height: 38, padding: "0 12px", borderRadius: 10, boxSizing: "border-box",
                background: Ц.панельВыше, border: `1px solid ${Ц.линия}`, color: Ц.текст,
                fontFamily: цифры, fontSize: 15, outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {быстрые.map((v) => (
                <button
                  key={v}
                  onClick={() => setСумма(String(v))}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 8, cursor: "pointer",
                    background: Ц.панельВыше, border: `1px solid ${Ц.линия}`, color: Ц.тусклый,
                    fontFamily: цифры, fontSize: 12,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* В Solana подпись ставит кошелёк приложения на сервере —
                сделка проходит прямо здесь. В TON её подписывает кошелёк
                человека, а он живёт в мини-приложении: туда и уводим, а
                не делаем вид, что сделка пройдёт на сайте. */}
            {кош ? (
              <>
                <button
                  onClick={сделать}
                  disabled={идёт || !(Number(сумма) > 0)}
                  style={{
                    width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 11, border: "none",
                    cursor: идёт || !(Number(сумма) > 0) ? "default" : "pointer",
                    background: сторона === "buy" ? Ц.рост : Ц.падение, color: "#06070A",
                    fontFamily: шрифт, fontWeight: 700, fontSize: 14,
                    opacity: идёт || !(Number(сумма) > 0) ? 0.55 : 1,
                  }}
                >
                  {идёт ? "Отправляем…" : сторона === "buy" ? `Купить ${токен.тикер}` : `Продать ${токен.тикер}`}
                </button>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: шрифт, fontSize: 11.5, color: Ц.слабый, marginTop: 8 }}>
                  <span>Баланс в приложении</span>
                  <span style={{ fontFamily: цифры, color: Ц.тусклый }}>{(Number(кош.sol) || 0).toFixed(4)} SOL</span>
                </div>
                {итог && (
                  <div style={{ fontFamily: шрифт, fontSize: 12, marginTop: 6, color: /Куплено|Продано/.test(итог) ? Ц.рост : Ц.падение }}>
                    {итог}
                  </div>
                )}
              </>
            ) : (
              <>
                <a
                  href={`${ссылка}${сумма ? `_${сумма}` : ""}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block", textAlign: "center", marginTop: 12, padding: "12px 0", borderRadius: 11,
                    background: сторона === "buy" ? Ц.рост : Ц.падение, color: "#06070A",
                    fontFamily: шрифт, fontWeight: 700, fontSize: 14, textDecoration: "none",
                  }}
                >
                  {сторона === "buy" ? "Купить" : "Продать"} в Telegram
                </a>
                <div style={{ fontFamily: шрифт, fontSize: 11.5, color: Ц.слабый, marginTop: 8, lineHeight: 1.45 }}>
                  {токен.сеть === "solana"
                    ? "Сделка пройдёт прямо здесь, как только вы войдёте в аккаунт — он заводится из Telegram."
                    : "Сделку в TON подписывает ваш кошелёк, а он живёт в мини-приложении."}
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: 16, padding: "12px 12px 20px", borderTop: `1px solid ${Ц.линия}` }}>
            <div style={{ fontFamily: шрифт, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: Ц.слабый, marginBottom: 8 }}>
              О токене
            </div>
            {[
              ["Капитализация", деньги(токен.капитализация)],
              ["Ликвидность", деньги(токен.ликвидность)],
              ["Объём 24ч", деньги(токен.объём)],
              ["Сделок 24ч", число(токен.сделки)],
            ].map(([п, з]) => (
              <div key={п} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                <span style={{ fontFamily: шрифт, fontSize: 12.5, color: Ц.тусклый }}>{п}</span>
                <span style={{ fontFamily: цифры, fontSize: 12.5, color: Ц.текст }}>{з}</span>
              </div>
            ))}
            {токен.адрес && (
              <button
                onClick={() => navigator.clipboard && navigator.clipboard.writeText(токен.адрес)}
                style={{
                  width: "100%", marginTop: 10, padding: "8px 0", borderRadius: 9, cursor: "pointer",
                  background: "transparent", border: `1px solid ${Ц.линия}`, color: Ц.тусклый,
                  fontFamily: цифры, fontSize: 11.5,
                }}
              >
                {`${токен.адрес.slice(0, 10)}…${токен.адрес.slice(-8)}`} · копировать
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
