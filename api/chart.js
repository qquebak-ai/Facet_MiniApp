/* Картинка с графиком токена.
 *
 * Её показывает Telegram прямо в сообщении: подсказка бота отдаёт
 * ссылку сюда, Telegram сам скачивает картинку и кладёт в чат. Смысл в
 * том, чтобы график был виден без единого касания — открывать
 * приложение нужно только тому, кто собрался торговать.
 *
 * Два источника, как и везде в боте:
 *   ?pool=<адрес пула>  — токен с биржи, свечи берём у GeckoTerminal;
 *   ?token=<id>         — токен Mintly, цену считаем по своим сделкам.
 *
 * Ответ кэшируется на минуту: Telegram скачивает картинку один раз на
 * сообщение, но одну и ту же подсказку в чате пересылают и повторяют.
 */

import { createCanvas, encodePNG, fillRect, line, px, text, textWidth } from "./_png.js";
import { adminClient } from "./_support.js";
import { curveState, priceFromState, looksLikeAddress, poolByAddress } from "./_market.js";

const W = 800;
const H = 420;

const ФОН = [7, 8, 10];
const БЕЛЫЙ = [255, 255, 255];
const СЕРЫЙ = [124, 130, 139];
const ОГОНЬ = [255, 107, 53];
const ЗЕЛЁНЫЙ = [56, 211, 159];
const КРАСНЫЙ = [255, 77, 90];

const GT = "https://api.geckoterminal.com/api/v2";

async function свечиБиржи(pool) {
  try {
    const res = await fetch(`${GT}/networks/ton/pools/${pool}/ohlcv/hour?aggregate=1&limit=24&currency=usd&token=base`);
    if (!res.ok) return [];
    const json = await res.json();
    const list = json && json.data && json.data.attributes && json.data.attributes.ohlcv_list;
    if (!Array.isArray(list)) return [];
    // Приходят от свежих к старым — разворачиваем, иначе график читался
    // бы задом наперёд.
    return list.slice().reverse().map((c) => Number(c[4]) || 0).filter((v) => v > 0);
  } catch (err) {
    return [];
  }
}

async function ценыСделок(tokenId) {
  const admin = adminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("trades")
    .select("ton_amount, token_amount, created_at")
    .eq("token_id", tokenId)
    .order("created_at", { ascending: true })
    .limit(300);
  return (data || [])
    .map((с) => {
      const ton = Number(с.ton_amount) || 0;
      const шт = Number(с.token_amount) || 0;
      return ton > 0 && шт > 0 ? ton / шт : 0;
    })
    .filter((v) => v > 0);
}

function fmtЦена(v, вTon) {
  if (!(v > 0)) return "-";
  const хвост = вTon ? " TON" : "";
  if (v >= 1) return `${вTon ? "" : "$"}${v.toFixed(4)}${хвост}`;
  if (v >= 0.0001) return `${вTon ? "" : "$"}${v.toFixed(6)}${хвост}`;
  return `${вTon ? "" : "$"}${v.toFixed(9).replace(/(\.\d*?)0+$/, "$1")}${хвост}`;
}

function fmtБольшое(v, вTon) {
  const n = Number(v) || 0;
  const знак = вTon ? "" : "$";
  const хвост = вTon ? " TON" : "";
  if (n >= 1e9) return `${знак}${(n / 1e9).toFixed(2)}B${хвост}`;
  if (n >= 1e6) return `${знак}${(n / 1e6).toFixed(2)}M${хвост}`;
  if (n >= 1e3) return `${знак}${(n / 1e3).toFixed(1)}K${хвост}`;
  return `${знак}${n.toFixed(0)}${хвост}`;
}

/* Собственно рисование. Всё, что видно на картинке: тикер, цена,
   движение, сама линия и подпись площадки. */
function нарисовать({ ticker, name, priceText, capText, change, точки, вTon }) {
  const c = createCanvas(W, H, ФОН);

  // Тёплое зарево сверху справа — тем же цветом, что и весь интерфейс.
  for (let y = 0; y < 220; y++) {
    for (let x = W - 380; x < W; x++) {
      const dx = (x - (W - 60)) / 380;
      const dy = (y - 10) / 220;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) px(c, x, y, ОГОНЬ, (1 - d) * 0.14);
    }
  }

  text(c, `$${ticker}`, 34, 30, БЕЛЫЙ, 5);
  if (name) text(c, String(name).slice(0, 22), 34, 82, СЕРЫЙ, 2);

  const цвет = change >= 0 ? ЗЕЛЁНЫЙ : КРАСНЫЙ;
  const движение = `${change >= 0 ? "+" : "-"}${Math.abs(change).toFixed(2)}%`;
  text(c, priceText, W - 34 - textWidth(priceText, 3), 30, БЕЛЫЙ, 3);
  text(c, движение, W - 34 - textWidth(движение, 2), 66, цвет, 2);
  if (capText) text(c, capText, W - 34 - textWidth(capText, 2), 92, СЕРЫЙ, 2);

  const x0 = 34;
  const x1 = W - 34;
  const y0 = 140;
  const y1 = H - 54;

  // Сетка: три линии, чтобы взгляд цеплялся за уровни, но не пестрило.
  for (let i = 0; i <= 3; i++) {
    const y = y0 + ((y1 - y0) * i) / 3;
    line(c, x0, y, x1, y, БЕЛЫЙ, 1, 0.06);
  }

  if (точки.length >= 2) {
    const мин = Math.min(...точки);
    const макс = Math.max(...точки);
    const размах = макс - мин || макс || 1;
    // Небольшой запас сверху и снизу: линия, упирающаяся в край, выглядит
    // обрезанной.
    const кY = (v) => y1 - ((v - мин) / размах) * (y1 - y0) * 0.88 - (y1 - y0) * 0.06;
    const кX = (i) => x0 + ((x1 - x0) * i) / (точки.length - 1);

    // Заливка под линией — вертикальным затуханием.
    for (let i = 0; i < точки.length - 1; i++) {
      const ax = кX(i);
      const bx = кX(i + 1);
      const ay = кY(точки[i]);
      const by = кY(точки[i + 1]);
      for (let x = ax; x <= bx; x++) {
        const t = (x - ax) / Math.max(1, bx - ax);
        const верх = ay + (by - ay) * t;
        for (let y = верх; y <= y1; y++) {
          const доля = 1 - (y - верх) / Math.max(1, y1 - верх);
          px(c, x, y, ОГОНЬ, 0.22 * доля * доля);
        }
      }
    }

    for (let i = 0; i < точки.length - 1; i++) {
      line(c, кX(i), кY(точки[i]), кX(i + 1), кY(точки[i + 1]), ОГОНЬ, 3);
    }

    // Точка последней цены — к ней и приковано внимание.
    const lx = кX(точки.length - 1);
    const ly = кY(точки[точки.length - 1]);
    for (let r = 9; r >= 0; r--) {
      for (let a = 0; a < 360; a += 4) {
        const rad = (a * Math.PI) / 180;
        px(c, lx + Math.cos(rad) * r, ly + Math.sin(rad) * r, ОГОНЬ, r > 4 ? 0.06 : 1);
      }
    }
    fillRect(c, x0, y1 + 1, x1 - x0, 1, БЕЛЫЙ, 0.08);
  } else {
    const нет = "NO TRADES YET";
    text(c, нет, (W - textWidth(нет, 2)) / 2, (y0 + y1) / 2 - 7, СЕРЫЙ, 2);
  }

  text(c, вTon ? "MINTLY CURVE" : "24H", 34, H - 34, СЕРЫЙ, 2);
  const марка = "MINTLY";
  text(c, марка, W - 34 - textWidth(марка, 2), H - 34, ОГОНЬ, 2, 0.75);

  return encodePNG(c);
}

export default async function handler(req, res) {
  const параметры = new URL(req.url, "https://x").searchParams;
  const пул = параметры.get("pool");
  const токен = параметры.get("token");

  try {
    if (пул && looksLikeAddress(пул)) {
      const [строка, точки] = await Promise.all([poolByAddress(пул), свечиБиржи(пул)]);
      if (!строка) return res.status(404).json({ error: "not_found" });
      const png = нарисовать({
        ticker: строка.ticker,
        name: строка.name,
        priceText: fmtЦена(строка.priceUsd, false),
        capText: строка.mcapUsd ? fmtБольшое(строка.mcapUsd, false) : "",
        change: строка.change24,
        точки,
        вTon: false,
      });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
      return res.status(200).send(png);
    }

    if (токен) {
      const admin = adminClient();
      const { data: строка } = await admin
        .from("tokens")
        .select("id, name, ticker, curve_address")
        .eq("id", токен)
        .maybeSingle();
      if (!строка) return res.status(404).json({ error: "not_found" });
      const [state, точки] = await Promise.all([curveState(строка.curve_address), ценыСделок(строка.id)]);
      const цена = priceFromState(state);
      // Последнюю точку берём из кривой: она свежее любой сделки,
      // записанной приложением.
      const ряд = цена > 0 ? [...точки, цена] : точки;
      const старт = ряд.length ? ряд[0] : 0;
      const png = нарисовать({
        ticker: String(строка.ticker || "").toUpperCase(),
        name: строка.name,
        priceText: fmtЦена(цена, true),
        capText: цена > 0 ? fmtБольшое(цена * 1e9, true) : "",
        change: старт > 0 && цена > 0 ? ((цена - старт) / старт) * 100 : 0,
        точки: ряд,
        вTon: true,
      });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
      return res.status(200).send(png);
    }

    return res.status(400).json({ error: "bad_request" });
  } catch (err) {
    return res.status(500).json({ error: "render_failed", detail: err && err.message });
  }
}
