/* Обход биржевых лент для витрины: собирает разом и складывает в базу.
 *
 * До этого ленту читал каждый телефон сам: пять страниц GeckoTerminal на
 * TON и столько же на Solana, и так у каждого открывшего приложение. У
 * источника лимит около тридцати запросов в минуту на адрес — десяток
 * человек одновременно выбирали его целиком, и дальше всем прилетал
 * отказ: список висел пустым, а графики не грузились.
 *
 * Теперь ленты обходит сервер (крон раз в минуту), а приложение забирает
 * готовые строки одним запросом к базе. Источник видит один адрес вместо
 * тысячи, а человек — список сразу, без ожидания сети.
 *
 * Переменные окружения: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * CRON_SECRET.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const GT = "https://api.geckoterminal.com/api/v2";
// Столько же страниц, сколько раньше читало приложение: на «Горячие» и
// «DEX» одной страницы мало.
const PAGES = 4;
const LIMIT = 100;
// Пауза между запросами к источнику. Он пускает около тридцати в минуту,
// и обход не должен выбирать этот запас целиком — тем же ключом ходят
// графики отдельных токенов.
const GAP_MS = 400;

const пауза = (ms) => new Promise((r) => setTimeout(r, ms));

/* Узел Solana для метаданных. Лента всегда мейннетовская, а рабочая сеть
   приложения может быть тестовой — поэтому адрес узла приводится к
   мейннету. Картинки свежих токенов лежат только здесь: у источника
   лент их нет вовсе, а без них лента показывает эмодзи-заглушки. */
const META_RPC = (process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com")
  .replace("devnet.", "mainnet.")
  .replace("api.devnet.solana.com", "api.mainnet-beta.solana.com");

async function сохранитьЛоготипы(admin, строки) {
  const сКартинкой = строки.filter((t) => t.logo_url);
  if (!сКартинкой.length) return;
  const { error } = await admin.from("feed_cache").upsert(
    сКартинкой.map((t) => ({ id: t.id, chain: t.chain, pool_address: t.pool_address, logo_url: t.logo_url })),
    { onConflict: "id" },
  );
  if (error) console.warn("[refresh-feed] логотипы ->", error.message);
}

async function логотипыSolana(строки) {
  const без = строки.filter((t) => !t.logo_url && t.token_address).slice(0, 100);
  if (!без.length) return;
  try {
    const res = await fetch(META_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "mintly",
        // Метод расширенного узла (Helius). На простом узле его нет —
        // тогда просто останемся без картинок, а не уроним обход.
        method: "getAssetBatch",
        params: { ids: без.map((t) => t.token_address) },
      }),
    });
    if (!res.ok) return;
    const json = await res.json();
    const активы = (json && json.result) || [];
    const карта = new Map();
    for (const a of активы) {
      if (!a || !a.id) continue;
      const c = a.content || {};
      const url = (c.links && c.links.image)
        || (Array.isArray(c.files) && c.files[0] && (c.files[0].cdn_uri || c.files[0].uri))
        || null;
      if (url) карта.set(a.id, String(url));
    }
    for (const t of без) {
      const url = карта.get(t.token_address);
      if (url) t.logo_url = url;
    }

    /* У части токенов узел отдаёт только ссылку на описание, без готовой
       картинки. Дочитываем её оттуда, но понемногу и с коротким сроком
       ожидания: хранилища описаний бывают медленными, а обход не должен
       из-за них не успеть. */
    const описания = активы
      .filter((a) => a && a.id && !карта.has(a.id) && a.content && a.content.json_uri)
      .slice(0, 3);
    for (const a of описания) {
      try {
        const управление = new AbortController();
        const срок = setTimeout(() => управление.abort(), 1500);
        const res = await fetch(a.content.json_uri, { signal: управление.signal });
        clearTimeout(срок);
        if (!res.ok) continue;
        const json = await res.json();
        const url = json && (json.image || (json.properties && json.properties.image));
        if (!url) continue;
        const строка = без.find((t) => t.token_address === a.id);
        if (строка) строка.logo_url = String(url);
      } catch { /* описание не открылось — останемся без картинки */ }
    }
  } catch (err) {
    console.warn("[refresh-feed] логотипы ->", err && err.message);
  }
}

async function страница(сеть, page, список = "trending_pools") {
  try {
    const res = await fetch(`${GT}/networks/${сеть}/${список}?page=${page}&include=base_token,dex`);
    if (!res.ok) {
      console.warn("[refresh-feed]", сеть, "стр.", page, "->", res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("[refresh-feed]", сеть, "стр.", page, "->", err && err.message);
    return null;
  }
}

/* Подделки под известные монеты. В списке свежих пулов их всегда
   десятки: «USDT», «Wrapped SOL», «Tether» — имена, на которые ловят
   невнимательных. В мемпаде им не место, и держать их в кеше незачем. */
const ПОДДЕЛЬНЫЕ_ТИКЕРЫ = /^(usdt|usdc|usd1|usde|usds|fdusd|dai|busd|tusd|pyusd|sol|wsol|msol|jitosol|bsol|btc|wbtc|cbbtc|tbtc|eth|weth|steth|ton|wton|bnb|xrp|ada|doge|usd)$/i;
const ПОДДЕЛЬНЫЕ_ИМЕНА = /(tether|usd\s?coin|wrapped|staked\s|liquid\s?stak|circle|binance\s?coin|bitcoin|ethereum|solana\s?$|toncoin)/i;

const подделка = (t) => ПОДДЕЛЬНЫЕ_ТИКЕРЫ.test(String(t.ticker || "").trim())
  || ПОДДЕЛЬНЫЕ_ИМЕНА.test(String(t.name || "").trim());

/* Разбор ответа в те же поля, что раньше собирало приложение. Держать их
   одинаковыми обязательно: витрина рисует карточки по этим именам. */
function разобрать(json, сеть) {
  const rows = (json && json.data) || [];
  const included = (json && json.included) || [];
  const токены = new Map(included.filter((x) => x.type === "token").map((x) => [x.id, x.attributes || {}]));
  const биржи = new Map(included.filter((x) => x.type === "dex").map((x) => [x.id, x.attributes || {}]));

  return rows.map((row) => {
    const a = row.attributes || {};
    const bt = токены.get(row.relationships?.base_token?.data?.id) || {};
    const dexId = row.relationships?.dex?.data?.id;
    const dex = биржи.get(dexId) || {};
    const имя = bt.name || String(a.name || "TOKEN").split("/")[0].trim();
    const тикер = String(bt.symbol || имя || "TOKEN").toUpperCase().slice(0, 10);
    const сделок = (окно) => {
      const w = (a.transactions || {})[окно] || {};
      return (Number(w.buys) || 0) + (Number(w.sells) || 0);
    };
    return {
      id: row.id,
      chain: сеть === "solana" ? "solana" : "ton",
      pool_address: a.address,
      token_address: bt.address || null,
      name: имя,
      ticker: тикер,
      logo_url: bt.image_url && !String(bt.image_url).includes("missing_small") ? bt.image_url : null,
      price: parseFloat(a.base_token_price_usd) || 0,
      change24: parseFloat(a.price_change_percentage?.h24) || 0,
      mcap: parseFloat(a.market_cap_usd) || parseFloat(a.fdv_usd) || 0,
      liq: parseFloat(a.reserve_in_usd) || 0,
      vol24: parseFloat(a.volume_usd?.h24) || 0,
      tx1h: сделок("h1"),
      tx6h: сделок("h6"),
      tx24: сделок("h24"),
      dex_name: dex.name || (dexId ? String(dexId).replace(/[-_]/g, ".") : null),
      pool_created_at: a.pool_created_at || null,
      updated_at: new Date().toISOString(),
    };
  }).filter((t) => t.pool_address && t.price > 0 && !подделка(t));
}

/* Картинки жетонов TON. У источника лент их нет так же, как и у
   Solana, зато обозреватель сети отдаёт готовое превью даже там, где в
   метаданных пусто. Берём понемногу за проход: у него свои лимиты, а
   список всё равно доберётся за несколько минут. */
async function логотипыTon(строки) {
  const без = строки.filter((t) => !t.logo_url && t.token_address).slice(0, 8);
  for (const t of без) {
    try {
      const res = await fetch(`https://tonapi.io/v2/jettons/${t.token_address}`);
      if (!res.ok) continue;
      const json = await res.json();
      const url = (json && json.metadata && json.metadata.image) || (json && json.preview) || null;
      if (url) t.logo_url = String(url);
    } catch { /* обозреватель молчит — останемся без картинки */ }
    await пауза(120);
  }
}

async function лента(сеть, список = "trending_pools", страниц = PAGES) {
  const собрано = [];
  const видели = new Set();
  for (let page = 1; page <= страниц; page++) {
    if (page > 1) await пауза(GAP_MS);
    const json = await страница(сеть, page, список);
    if (!json) break;
    for (const t of разобрать(json, сеть)) {
      if (видели.has(t.id)) continue;
      видели.add(t.id);
      собрано.push(t);
    }
    if (собрано.length >= LIMIT) break;
  }
  return собрано.slice(0, LIMIT);
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "not_configured" });
  }

  const auth = req.headers.authorization || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Сеть можно спросить по одной: обход обеих подряд — это десять
  // страниц с паузами, и в отведённое функции время он не укладывался.
  // Solana просто не доходила до записи, и её лента оставалась пустой.
  const выбор = String((req.query && req.query.chain) || "").toLowerCase();
  const сети = выбор === "ton" || выбор === "solana" ? [выбор] : ["ton", "solana"];

  const итог = {};
  for (const сеть of сети) {
    /* Сначала свежие пулы, потом популярные. Порядок важен: у источника
       лимит запросов на адрес, и когда он кончается, обрывается то, что
       идёт последним. Раздел «Новые» без свежих пулов пустеет целиком, а
       популярные переживут пропуск одной минуты — они и меняются
       медленнее.

       Две страницы: дальше идут пулы старше суток, а они уже не новые. */
    const свежие = await лента(сеть, "new_pools", 2);
    итог[`${сеть}_new`] = свежие.length;
    if (сеть === "solana") await логотипыSolana(свежие);
    else await логотипыTon(свежие);
    await сохранитьЛоготипы(admin, свежие);
    if (свежие.length) {
      const сейчас = new Date().toISOString();
      const { error: ошибка } = await admin.from("feed_cache").upsert(
        свежие.map((t) => {
          const строка = { ...t, new_at: сейчас };
          if (!строка.logo_url) delete строка.logo_url;
          return строка;
        }),
        { onConflict: "id" },
      );
      if (ошибка) {
        console.warn("[refresh-feed] новые", сеть, "->", ошибка.message);
        итог[`${сеть}_new`] = 0;
      }
    }

    await пауза(GAP_MS);
    const строки = await лента(сеть);
    итог[сеть] = строки.length;
    if (сеть === "solana") await логотипыSolana(строки);
    else await логотипыTon(строки);
    await сохранитьЛоготипы(admin, строки);
    if (!строки.length) continue;

    const { error } = await admin
      .from("feed_cache")
      .upsert(строки.map((t) => (t.logo_url ? t : (({ logo_url, ...без }) => без)(t))), { onConflict: "id" });
    if (error) {
      console.warn("[refresh-feed] запись", сеть, "->", error.message);
      итог[сеть] = 0;
      continue;
    }
    // Пулы, выпавшие из ленты, убираем: иначе витрина копила бы мёртвые
    // строки и показывала цены недельной давности.
    await admin
      .from("feed_cache")
      .delete()
      .eq("chain", сеть === "solana" ? "solana" : "ton")
      .lt("updated_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());
  }

  return res.status(200).json({ ok: true, ...итог });
}
