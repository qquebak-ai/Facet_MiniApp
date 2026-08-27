-- Готовая биржевая лента для витрины.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Зачем. Ленты TON и Solana приложение читало у GeckoTerminal само: по
-- пять страниц на сеть с каждого телефона. У источника лимит около
-- тридцати запросов в минуту на адрес, поэтому десяток человек
-- одновременно выбирали его целиком, и дальше всем шли отказы — список
-- висел пустым, графики не грузились.
--
-- Теперь ленты обходит сервер (api/refresh-feed.js, крон раз в минуту), а
-- приложение забирает готовые строки одним запросом сюда.
--
-- Читать может кто угодно: это те же числа, что и так видны на экране.
-- Писать — только обработчик своим service_role ключом.

create table if not exists public.feed_cache (
  id               text primary key,   -- идентификатор пула у источника
  chain            text not null,      -- ton | solana
  pool_address     text not null,
  token_address    text,
  name             text,
  ticker           text,
  logo_url         text,
  price            double precision not null default 0,
  change24         double precision not null default 0,
  mcap             double precision not null default 0,
  liq              double precision not null default 0,
  vol24            double precision not null default 0,
  tx1h             integer not null default 0,
  tx6h             integer not null default 0,
  tx24             integer not null default 0,
  dex_name         text,
  pool_created_at  timestamptz,
  updated_at       timestamptz not null default now()
);

create index if not exists feed_cache_chain_idx on public.feed_cache (chain, mcap desc);
create index if not exists feed_cache_updated_idx on public.feed_cache (updated_at);

alter table public.feed_cache enable row level security;

drop policy if exists "лента видна всем" on public.feed_cache;
create policy "лента видна всем" on public.feed_cache
  for select using (true);

-- Проверить, что обход доехал:
--   select chain, count(*), max(updated_at) from public.feed_cache group by chain;
