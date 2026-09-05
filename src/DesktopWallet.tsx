/* Кошелёк и профиль на большом экране.
 *
 * TonConnect в браузере работает так же, как в мини-приложении, поэтому
 * кошелёк здесь настоящий: подключение, адрес, баланс и токены, которые
 * с него запускали. А вот вход в аккаунт идёт через Telegram и вне его
 * невозможен — вместо пустой формы честно говорим об этом и даём ссылку.
 */

import React, { useEffect, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { supabase } from "./supabaseClient";
import { Ц, шрифт, цифры, деньги, возраст, число, Логотип } from "./desktopUI";

const БОТ = import.meta.env.VITE_TG_BOT || "MintlyAppBot";

function Карточка({ children, style }) {
  return (
    <div style={{ background: Ц.панель, border: `1px solid ${Ц.линия}`, borderRadius: 16, padding: 18, ...style }}>
      {children}
    </div>
  );
}

function Заголовок({ children }) {
  return (
    <div style={{ fontFamily: шрифт, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em", color: Ц.слабый, marginBottom: 10 }}>
      {children}
    </div>
  );
}

export function DesktopWallet({ наТокен }) {
  const адрес = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [баланс, setБаланс] = useState(null);
  const [токены, setТокены] = useState(null);

  useEffect(() => {
    if (!адрес) { setБаланс(null); setТокены(null); return; }
    let жив = true;
    // Баланс спрашиваем у публичного узла: своего эндпоинта для этого
    // нет, а держать целую библиотеку TON ради одного числа не стоит.
    fetch(`https://tonapi.io/v2/accounts/${адрес}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (жив && j) setБаланс(Number(j.balance || 0) / 1e9); })
      .catch(() => { if (жив) setБаланс(null); });

    supabase
      .from("tokens")
      .select("id, name, ticker, logo_url, address, created_at, chain, curve_cache(price_ton, real_ton, graduation_ton, graduated, holders)")
      .eq("creator_wallet", адрес)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => { if (жив) setТокены(data || []); });

    return () => { жив = false; };
  }, [адрес]);

  if (!адрес) {
    return (
      <div style={{ padding: 28, maxWidth: 560 }}>
        <Карточка>
          <div style={{ fontFamily: шрифт, fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Кошелёк не подключён</div>
          <p style={{ fontFamily: шрифт, fontSize: 13.5, color: Ц.тусклый, lineHeight: 1.55, margin: "0 0 16px" }}>
            Подключите TON-кошелёк, чтобы видеть баланс и токены, запущенные с этого адреса.
            Подпись сделок и запуск живут в мини-приложении — здесь кошелёк нужен для просмотра.
          </p>
          <button
            onClick={() => tonConnectUI.openModal()}
            style={{
              padding: "11px 20px", borderRadius: 11, border: "none", cursor: "pointer",
              background: Ц.акцент, color: "#0B0D1A", fontFamily: шрифт, fontWeight: 700, fontSize: 14,
            }}
          >
            Подключить кошелёк
          </button>
        </Карточка>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      <Карточка>
        <Заголовок>Кошелёк</Заголовок>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={{ fontFamily: цифры, fontSize: 30, fontWeight: 700 }}>
              {баланс == null ? "—" : `${баланс.toFixed(3)} TON`}
            </div>
            <button
              onClick={() => navigator.clipboard && navigator.clipboard.writeText(адрес)}
              style={{
                marginTop: 8, padding: "6px 10px", borderRadius: 9, cursor: "pointer",
                background: Ц.панельВыше, border: `1px solid ${Ц.линия}`, color: Ц.тусклый,
                fontFamily: цифры, fontSize: 12,
              }}
            >
              {`${адрес.slice(0, 8)}…${адрес.slice(-6)}`} · копировать
            </button>
          </div>
          <button
            onClick={() => tonConnectUI.disconnect()}
            style={{
              padding: "9px 16px", borderRadius: 10, cursor: "pointer",
              background: "transparent", border: `1px solid ${Ц.линия}`, color: Ц.тусклый,
              fontFamily: шрифт, fontSize: 13,
            }}
          >
            Отключить
          </button>
        </div>
      </Карточка>

      <Карточка>
        <Заголовок>Токены, запущенные с этого адреса</Заголовок>
        {!токены && <div style={{ fontFamily: шрифт, fontSize: 13, color: Ц.слабый }}>Загружаем…</div>}
        {токены && !токены.length && (
          <div style={{ fontFamily: шрифт, fontSize: 13, color: Ц.слабый }}>
            С этого кошелька ещё ничего не запускали. Запуск — в мини-приложении.
          </div>
        )}
        {(токены || []).map((t) => {
          const кеш = Array.isArray(t.curve_cache) ? t.curve_cache[0] : t.curve_cache;
          const собрано = кеш ? Number(кеш.real_ton) || 0 : 0;
          const цель = кеш ? Number(кеш.graduation_ton) || 0 : 0;
          const доля = цель > 0 ? Math.min(1, собрано / цель) : 0;
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: `1px solid ${Ц.линия}` }}>
              <Логотип src={t.logo_url} тикер={t.ticker} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: шрифт, fontSize: 13.5, fontWeight: 700 }}>${t.ticker}</div>
                <div style={{ fontFamily: шрифт, fontSize: 11.5, color: Ц.тусклый }}>
                  {t.name} · {возраст(t.created_at)}
                </div>
              </div>
              <div style={{ width: 160 }}>
                <div style={{ height: 4, borderRadius: 2, background: Ц.панельВыше, overflow: "hidden" }}>
                  <div style={{ width: `${доля * 100}%`, height: "100%", background: кеш && кеш.graduated ? Ц.рост : Ц.акцент }} />
                </div>
                <div style={{ fontFamily: цифры, fontSize: 11, color: Ц.слабый, marginTop: 4 }}>
                  {кеш && кеш.graduated ? "на бирже" : `${собрано.toFixed(1)} / ${цель || "—"} ${t.chain === "solana" ? "SOL" : "TON"}`}
                </div>
              </div>
              <div style={{ fontFamily: цифры, fontSize: 12.5, color: Ц.тусклый, width: 90, textAlign: "right" }}>
                {кеш && кеш.holders != null ? `${число(кеш.holders)} держ.` : "—"}
              </div>
            </div>
          );
        })}
      </Карточка>
    </div>
  );
}

export function DesktopProfile() {
  const [профиль, setПрофиль] = useState(undefined);

  useEffect(() => {
    let жив = true;
    supabase.auth.getUser().then(({ data }) => {
      const id = data && data.user && data.user.id;
      if (!id) { if (жив) setПрофиль(null); return; }
      supabase
        .from("profiles")
        .select("nickname, bio, avatar_url, emoji, coins, created_at")
        .eq("id", id)
        .maybeSingle()
        .then(({ data: p }) => { if (жив) setПрофиль(p || null); });
    });
    return () => { жив = false; };
  }, []);

  if (профиль === undefined) {
    return <div style={{ padding: 28, fontFamily: шрифт, fontSize: 13, color: Ц.слабый }}>Проверяем аккаунт…</div>;
  }

  if (!профиль) {
    return (
      <div style={{ padding: 28, maxWidth: 560 }}>
        <Карточка>
          <div style={{ fontFamily: шрифт, fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Вход только через Telegram</div>
          <p style={{ fontFamily: шрифт, fontSize: 13.5, color: Ц.тусклый, lineHeight: 1.55, margin: "0 0 16px" }}>
            Аккаунт Mintly заводится из профиля Telegram — ни почты, ни пароля нет, и подтвердить личность
            в обычном браузере нечем. Откройте мини-приложение, войдите там, и профиль появится здесь же.
          </p>
          <a
            href={`https://t.me/${БОТ}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block", padding: "11px 20px", borderRadius: 11, textDecoration: "none",
              background: Ц.акцент, color: "#0B0D1A", fontFamily: шрифт, fontWeight: 700, fontSize: 14,
            }}
          >
            Открыть в Telegram
          </a>
        </Карточка>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 700, display: "flex", flexDirection: "column", gap: 16 }}>
      <Карточка>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: "50%", background: Ц.панельВыше,
              border: `1px solid ${Ц.линия}`, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, overflow: "hidden",
            }}
          >
            {профиль.avatar_url
              ? <img src={профиль.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (профиль.emoji || "🙂")}
          </div>
          <div>
            <div style={{ fontFamily: шрифт, fontSize: 19, fontWeight: 700 }}>{профиль.nickname}</div>
            <div style={{ fontFamily: шрифт, fontSize: 13, color: Ц.тусклый, marginTop: 4 }}>
              {профиль.bio || "С нами с " + new Date(профиль.created_at).toLocaleDateString("ru-RU")}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontFamily: шрифт, fontSize: 11.5, color: Ц.слабый, textTransform: "uppercase", letterSpacing: "0.04em" }}>Монеты</div>
            <div style={{ fontFamily: цифры, fontSize: 22, fontWeight: 700 }}>{число(профиль.coins || 0)}</div>
          </div>
        </div>
      </Карточка>

      <Карточка>
        <Заголовок>Что можно только в мини-приложении</Заголовок>
        <ul style={{ margin: 0, paddingLeft: 18, fontFamily: шрифт, fontSize: 13.5, color: Ц.тусклый, lineHeight: 1.7 }}>
          <li>Запуск токена и подпись сделок — там кошелёк и подтверждение.</li>
          <li>Магазин, достижения и приглашения.</li>
          <li>Настройки безопасности: PIN-код и адрес вывода.</li>
        </ul>
      </Карточка>
    </div>
  );
}
