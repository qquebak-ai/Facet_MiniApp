/* Внутренний кошелёк приложения (Solana).
 *
 * Обычная сделка идёт через Phantom: приложение собирает транзакцию,
 * человек уходит в кошелёк, подтверждает, возвращается. Пока он ходит,
 * цена на кривой успевает уехать. Внутренний кошелёк убирает этот шаг —
 * подпись ставит сервер ключом, который лежит у него, и покупка уходит в
 * сеть сразу.
 *
 * Взамен человек доверяет нам хранение: ключ от внутреннего адреса
 * действительно у площадки. Поэтому кошелёк подаётся как быстрый карман
 * — пополнил на сделку, вывел остаток, — а не как замена своему, и об
 * этом сказано в самом разделе.
 *
 * Баланс мы не считаем: сервер читает его из сети по адресу.
 */

import { supabase } from "./supabaseClient";

async function токен() {
  const { data } = await supabase.auth.getSession();
  return (data && data.session && data.session.access_token) || null;
}

async function запрос(путь, тело) {
  const t = await токен();
  if (!t) throw new Error("нужен вход в аккаунт");
  const res = await fetch(путь, {
    method: тело ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${t}`,
      ...(тело ? { "Content-Type": "application/json" } : {}),
    },
    body: тело ? JSON.stringify(тело) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error((json && (json.detail || json.error)) || `ошибка ${res.status}`);
  return json;
}

/* Включён ли внутренний кошелёк на этой площадке. Ответ не меняется без
   перезапуска сервера, поэтому спрашиваем один раз за сеанс. */
let включён = null;
export async function внутреннийДоступен() {
  if (включён !== null) return включён;
  try {
    const j = await fetch("/api/wallet-solana?action=enabled").then((r) => r.json());
    включён = !!(j && j.enabled);
  } catch {
    включён = false;
  }
  return включён;
}

/* Адрес и остаток. Возвращает null, если человек не вошёл или кошелёк
   выключен — вызывающий код тогда просто идёт прежним путём. */
export async function состояниеВнутреннего() {
  if (!(await внутреннийДоступен())) return null;
  try {
    return await запрос("/api/wallet-solana?action=state");
  } catch {
    return null;
  }
}

/* Подпись и отправка готовой транзакции внутренним кошельком. */
export async function подписатьВнутренним(transactionBase64) {
  const j = await запрос("/api/wallet-solana?action=sign", { transaction: transactionBase64 });
  if (!j || !j.signature) throw new Error("сеть не приняла транзакцию");
  return j.signature;
}

/* Вывод на свой адрес. all — «всё, что есть»: сервер оставит запас на
   комиссию, иначе перевод не пройдёт вовсе. */
export async function вывестиСВнутреннего({ to, amount, all = false }) {
  return await запрос("/api/wallet-solana?action=withdraw", { to, amount, all });
}
