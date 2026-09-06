/* Предпросмотр картинки «Мемкоины в тренде» — той, что бот шлёт над /top.
 *
 * Своей разметки здесь нет намеренно: рисует тот же api/_topcard.js, что
 * работает в боте. Иначе предпросмотр показывал бы одно, а люди в чате
 * получали другое — так уже было, когда картинка собиралась дважды.
 *
 * Запуск:  node scripts/make-top.mjs
 * Выход:   /tmp/top.png
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { топСтроки, картинкаТопа } from "../api/_topcard.js";

const корень = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const env = Object.fromEntries(
  fs.readFileSync(path.join(корень, ".env"), "utf8").split("\n").filter(Boolean).map((с) => {
    const i = с.indexOf("=");
    return [с.slice(0, i).trim(), с.slice(i + 1).trim()];
  })
);

const кл = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const строки = await топСтроки(кл);
if (!строки.length) {
  console.error("лента пуста — картинку строить не из чего");
  process.exit(1);
}

const байты = await картинкаТопа(строки);
if (!байты) {
  console.error("картинка не собралась");
  process.exit(1);
}
fs.writeFileSync("/tmp/top.png", байты);
console.log(`/tmp/top.png — ${байты.readUInt32BE(16)}×${байты.readUInt32BE(20)}, строк ${строки.length}`);
console.log(строки.map((т, i) => `${i + 1}. $${т.тикер} ${т.сеть} ${т.движение.toFixed(1)}%`).join("\n"));
