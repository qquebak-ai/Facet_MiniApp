/* Рыночные данные — через свой сервер, а не напрямую из браузера.
 *
 * Почему так. У GeckoTerminal общий лимит примерно в тридцать запросов в
 * минуту на источник, и он один на всё приложение: пока лента, сделки и
 * график каждого открытого телефона стоят в общей очереди, свечи
 * приезжают через секунду-другую после открытия токена. На чужих
 * площадках график появляется мгновенно ровно потому, что его отдаёт их
 * собственный сервер.
 *
 * Здесь то же самое: один запрос от нашего сервера обслуживает всех,
 * ответ кладётся в сеть доставки Vercel на полминуты, и следующий
 * телефон получает его вообще без похода к источнику — за десятки
 * миллисекунд.
 *
 * stale-while-revalidate важнее самого кеша: даже когда полминуты
 * истекли, человек получает прошлый ответ сразу, а обновление идёт
 * следом. Пустого графика не бывает никогда.
 *
 * Наружу открыты три вещи и только они: свечи, сделки и описание
 * токена. Список путей закрыт намеренно — открытый прокси к чужому
 * источнику под нашим именем очень быстро становится чужим прокси.
 */

const GT = "https://api.geckoterminal.com/api/v2";

// Те же интервалы, что и в приложении: имя таймфрейма → чем его брать у
// источника. Часть приложение потом пересобирает у себя (M30 из M15,
// W1 и MN1 из дней), но это уже его забота.
const ИНТЕРВАЛЫ = {
  M1: { timeframe: "minute", aggregate: 1 },
  M5: { timeframe: "minute", aggregate: 5 },
  M15: { timeframe: "minute", aggregate: 15 },
  M30: { timeframe: "minute", aggregate: 15 },
  H1: { timeframe: "hour", aggregate: 1 },
  H4: { timeframe: "hour", aggregate: 4 },
  D1: { timeframe: "day", aggregate: 1 },
  W1: { timeframe: "day", aggregate: 1 },
  MN1: { timeframe: "day", aggregate: 1 },
};

const адресОк = (s) => typeof s === "string" && /^[A-Za-z0-9_:-]{20,80}$/.test(s);
const сетьОк = (s) => /^[a-z-]{2,20}$/.test(s);

/* Короткая память самого обработчика. Она переживает лишь несколько
   вызовов подряд — Vercel держит процесс между запросами недолго, — но
   именно эти несколько и случаются, когда экран открывают, закрывают и
   открывают снова. */
const память = new Map();
const ПАМЯТЬ_МС = 20000;

function положить(ключ, тело) {
  память.set(ключ, { ts: Date.now(), тело });
  if (память.size > 300) {
    for (const [k, v] of память) if (Date.now() - v.ts > ПАМЯТЬ_МС * 5) память.delete(k);
  }
}

export default async function handler(req, res) {
  const что = String((req.query && req.query.what) || "ohlcv").trim();
  const сеть = String((req.query && req.query.network) || "ton").trim();
  if (!сетьОк(сеть)) return res.status(400).json({ error: "bad_request" });

  let url = null;
  let ключ = null;

  if (что === "ohlcv") {
    const пул = String((req.query && req.query.pool) || "").trim();
    const тф = String((req.query && req.query.tf) || "H1").toUpperCase();
    const cfg = ИНТЕРВАЛЫ[тф];
    if (!адресОк(пул) || !cfg) return res.status(400).json({ error: "bad_request" });
    ключ = `o:${сеть}:${пул}:${тф}`;
    url = `${GT}/networks/${сеть}/pools/${пул}/ohlcv/${cfg.timeframe}`
      + `?aggregate=${cfg.aggregate}&limit=1000&currency=usd&token=base`;
  } else if (что === "trades") {
    const пул = String((req.query && req.query.pool) || "").trim();
    if (!адресОк(пул)) return res.status(400).json({ error: "bad_request" });
    ключ = `t:${сеть}:${пул}`;
    url = `${GT}/networks/${сеть}/pools/${пул}/trades`;
  } else if (что === "info") {
    const токен = String((req.query && req.query.token) || "").trim();
    if (!адресОк(токен)) return res.status(400).json({ error: "bad_request" });
    ключ = `i:${сеть}:${токен}`;
    url = `${GT}/networks/${сеть}/tokens/${токен}/info`;
  } else {
    return res.status(400).json({ error: "bad_request" });
  }

  // Сделки живут секунды, свечи — полминуты, описание не меняется
  // неделями. Разные сроки в сети доставки: незачем держать описание
  // токена так же коротко, как ленту сделок.
  const сроки = что === "trades"
    ? "public, s-maxage=10, stale-while-revalidate=120"
    : что === "info"
      ? "public, s-maxage=600, stale-while-revalidate=86400"
      : "public, s-maxage=30, stale-while-revalidate=300";

  const было = память.get(ключ);
  const свежесть = что === "trades" ? 8000 : ПАМЯТЬ_МС;
  if (было && Date.now() - было.ts < свежесть) {
    res.setHeader("Cache-Control", сроки);
    return res.status(200).json(было.тело);
  }

  try {
    const ответ = await fetch(url, { headers: { accept: "application/json" } });
    if (!ответ.ok) throw new Error(`geckoterminal ${ответ.status}`);
    const json = await ответ.json();
    положить(ключ, json);
    res.setHeader("Cache-Control", сроки);
    return res.status(200).json(json);
  } catch (err) {
    // Отдаём последнее удачное, даже протухшее: цифры получасовой
    // давности честнее пустого экрана, а приложение всё равно дорисует
    // свежие, когда источник ответит.
    if (было) {
      res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=300");
      return res.status(200).json(было.тело);
    }
    return res.status(502).json({ error: "upstream", detail: String((err && err.message) || err).slice(0, 200) });
  }
}
