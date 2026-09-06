/* Выкладка по запросу.
 *
 * Сервер свой, и выкладка — это git pull плюс сборка. Ходить за ней на
 * сервер руками каждый раз незачем: этот маршрут делает то же самое, что
 * server/deploy.sh, только по защищённому запросу.
 *
 *   curl -X POST https://mintly.company/api/deploy -H "authorization: Bearer <DEPLOY_SECRET>"
 *
 * Без секрета маршрут молчит: он выполняет команды на машине, и открытым
 * его оставлять нельзя. Секрет живёт в .env.server; пока он не задан,
 * маршрут выключен целиком — так безопаснее, чем случайно оставить его
 * без пароля.
 *
 * Ответ приходит сразу, а сборка идёт дальше сама: она занимает больше
 * минуты, и держать соединение всё это время незачем — итог видно в
 * журнале службы (journalctl -u mintly-api).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";

const СЕКРЕТ = process.env.DEPLOY_SECRET || "";
let идёт = false;
let последняя = null;

/* Сравнение секретов постоянным временем: обычное сравнение строк
   отвечает тем быстрее, чем раньше расходятся строки, и по этому времени
   секрет подбирается посимвольно. */
function совпало(а, б) {
  const п = Buffer.from(String(а));
  const в = Buffer.from(String(б));
  if (п.length !== в.length) return false;
  return crypto.timingSafeEqual(п, в);
}

export default async function handler(req, res) {
  if (!СЕКРЕТ) return res.status(503).json({ error: "deploy_disabled" });

  const заголовок = String((req.headers && req.headers.authorization) || "");
  const данный = заголовок.replace(/^Bearer\s+/i, "").trim();
  if (!данный || !совпало(данный, СЕКРЕТ)) return res.status(401).json({ error: "bad_secret" });

  if (req.method === "GET") {
    return res.status(200).json({ идёт, последняя });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  if (идёт) return res.status(409).json({ error: "already_running", последняя });

  const корень = path.resolve(process.cwd());
  идёт = true;
  последняя = { начало: new Date().toISOString(), код: null, хвост: [] };

  // Скрипт запускается отдельным процессом и переживает ответ: сборка
  // длится минуты, а служба во время неё продолжает отвечать.
  const процесс = spawn("sudo", ["-n", path.join(корень, "server", "deploy.sh")], {
    cwd: корень,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const запомнить = (кусок) => {
    for (const строка of String(кусок).split("\n")) {
      if (!строка.trim()) continue;
      console.log("[выкладка]", строка);
      // Держим последние строки: по ним видно, чем кончилось, без
      // копания в журнале.
      последняя.хвост.push(строка);
      if (последняя.хвост.length > 40) последняя.хвост.shift();
    }
  };
  процесс.stdout.on("data", запомнить);
  процесс.stderr.on("data", запомнить);
  процесс.on("error", (err) => {
    идёт = false;
    последняя.код = -1;
    запомнить(`не запустилось: ${err && err.message}`);
  });
  процесс.on("close", (код) => {
    идёт = false;
    последняя.код = код;
    последняя.конец = new Date().toISOString();
    console.log("[выкладка] код выхода", код);
  });

  return res.status(202).json({ ok: true, начато: последняя.начало });
}
