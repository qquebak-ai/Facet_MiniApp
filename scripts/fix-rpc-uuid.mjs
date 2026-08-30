/* Починка uuid внутри rpc-websockets.
 *
 * Зачем. Библиотека web3.js подключает rpc-websockets, а тот — uuid. У
 * свежих версий uuid осталась только ESM-сборка, тогда как сборщик
 * серверных функций превращает web3.js в CommonJS: получается require
 * ESM-модуля, который Node отвергает, и функция падает целиком на первом
 * же вызове — вместе с запуском токенов в Solana.
 *
 * Правильного способа договориться тут нет: rpc-websockets жёстко просит
 * четырнадцатую версию, а npm overrides её не перебивает. Поэтому после
 * установки кладём рядом с ним ту же библиотеку девятой версии — она
 * умеет и CommonJS, и даёт тот же v1, которым он пользуется.
 *
 * Запускается сам из postinstall; если чинить нечего, молча выходит.
 */

import fs from "node:fs";
import path from "node:path";

const корень = process.cwd();
const свой = path.join(корень, "node_modules", "uuid");
const чужой = path.join(корень, "node_modules", "rpc-websockets", "node_modules", "uuid");

function версия(где) {
  try {
    return JSON.parse(fs.readFileSync(path.join(где, "package.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

const наш = версия(свой);
if (!наш.startsWith("9.")) {
  // Корневой uuid не тот, что нужен: подменять нечем, и молчать об этом
  // нельзя — иначе поломка всплывёт уже в проде.
  console.warn("[fix-rpc-uuid] в корне uuid", наш || "не найден", "— нужна девятая версия");
  process.exit(0);
}

const их = версия(чужой);
if (!их || их.startsWith("9.")) process.exit(0);

fs.rmSync(чужой, { recursive: true, force: true });
fs.cpSync(свой, чужой, { recursive: true });
console.log("[fix-rpc-uuid] uuid внутри rpc-websockets заменён с", их, "на", наш);
