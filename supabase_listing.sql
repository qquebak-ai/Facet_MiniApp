-- Пул токена на бирже.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Зачем. Контракт кривой, набрав цель, ставит себе graduated и одним
-- переводом отправляет всю ликвидность на кошелёк площадки. Дальше пару
-- на бирже кто-то должен завести — само оно не происходит. До сих пор
-- приложение уже в этот момент писало «на бирже», хотя торговать было
-- негде: пула не существовало.
--
-- Теперь у токена есть адрес пула. Пока он пуст, токен показывается как
-- «кривая закрыта, пул готовится», и только с адресом — как торгующийся
-- на бирже.

alter table public.tokens
  add column if not exists dex_pool_address text;

alter table public.tokens
  add column if not exists listed_at timestamptz;

create index if not exists tokens_dex_pool_idx
  on public.tokens (dex_pool_address)
  where dex_pool_address is not null;

-- Проверить, что получилось:
--   select ticker, curve_address, dex_pool_address, listed_at
--     from public.tokens
--    where curve_address is not null
--    order by created_at desc;
