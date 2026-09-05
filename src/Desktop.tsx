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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import DesktopToken from "./DesktopToken";
import { DesktopWallet, DesktopProfile } from "./DesktopWallet";
import { Ц, шрифт, цифры, деньги, цена, возраст, число, Логотип, Движение } from "./desktopUI";

const БОТ = import.meta.env.VITE_TG_BOT || "MintlyAppBot";

const СЕТИ = [
  { id: "ton", подпись: "TON", сеть: "ton" },
  { id: "sol", подпись: "Solana", сеть: "solana" },
];

const РАЗДЕЛЫ = [
  { id: "market", подпись: "Рынок" },
  { id: "wallet", подпись: "Кошелёк" },
  { id: "profile", подпись: "Профиль" },
];

const ВКЛАДКИ = [
  { id: "trending", подпись: "Популярные" },
  { id: "new", подпись: "Новые" },
  { id: "gainers", подпись: "В росте" },
];

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
  const [раздел, setРаздел] = useState("market");

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
          {РАЗДЕЛЫ.map((р) => (
            <button
              key={р.id}
              onClick={() => { setРаздел(р.id); setВыбран(null); }}
              style={{
                fontFamily: шрифт, fontSize: 13.5, fontWeight: 600, padding: "7px 12px", borderRadius: 9, cursor: "pointer",
                background: раздел === р.id ? Ц.панельВыше : "transparent",
                border: "none", color: раздел === р.id ? Ц.текст : Ц.тусклый,
              }}
            >
              {р.подпись}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 22, background: Ц.линия }} />

        <div style={{ display: раздел === "market" && !выбран ? "flex" : "none", gap: 4 }}>
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

        <div style={{ display: раздел === "market" ? "flex" : "none", gap: 2, background: Ц.панельВыше, borderRadius: 10, padding: 3 }}>
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
            display: раздел === "market" && !выбран ? "block" : "none",
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
        {раздел === "wallet" && <DesktopWallet />}
        {раздел === "profile" && <DesktopProfile />}
        {раздел === "market" && выбран && (
          <DesktopToken токен={выбран} наНазад={() => setВыбран(null)} />
        )}
        {раздел === "market" && !выбран && (
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
        )}
      </div>
    </div>
  );
}
