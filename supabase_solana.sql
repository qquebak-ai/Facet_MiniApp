-- Токены, запущенные в Solana.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Зачем. До сих пор все токены жили в одной сети, и колонка network
-- различала только мейннет и тестнет TON. Теперь у токена есть ещё и
-- цепочка: у неё свои адреса, свой кошелёк и своя кривая, и по этой
-- колонке приложение решает, у кого спрашивать цену.
--
-- Старые строки — токены TON, поэтому значение по умолчанию 'ton':
-- переносить ничего не нужно.

alter table public.tokens
  add column if not exists chain text not null default 'ton';

create index if not exists tokens_chain_idx on public.tokens (chain);

-- Проверить:
--   select chain, count(*) from public.tokens group by chain;
