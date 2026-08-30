-- Отметка «пул только что появился».
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Зачем. В ленте лежат популярные пары: у них десятки тысяч сделок и
-- возраст в месяцы. Раздел «Новые» из них собрать нельзя — там нужны
-- монеты, заведённые час назад. Источник отдаёт такой список отдельным
-- запросом, и обход (api/refresh-feed.js) помечает эти строки временем,
-- когда встретил их среди новых.
--
-- Отдельная колонка, а не отдельная таблица: пул тот же самый, меняется
-- только то, как он попал в ленту. Обход популярных её не трогает —
-- PostgREST обновляет лишь те колонки, что пришли в запросе.

alter table public.feed_cache
  add column if not exists new_at timestamptz;

create index if not exists feed_cache_new_idx
  on public.feed_cache (chain, new_at desc nulls last);

-- Проверить, что новые пулы доезжают:
--   select chain, count(*) from public.feed_cache where new_at > now() - interval '1 day' group by chain;
