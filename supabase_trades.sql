-- Свои сделки. Выполнить один раз в Supabase → SQL Editor.
--
-- Цепочка знает о переводе, но не знает, кто его сделал из приложения и
-- по какому курсу шёл TON в тот момент. Без этого не посчитать ни
-- портфель, ни прибыль, поэтому приложение ведёт свою запись.
--
-- Строка появляется после того, как кошелёк подтвердил отправку. Это не
-- доказательство исполнения: сделка могла отвалиться уже в сети. Для
-- денег источник правды — цепочка, а эта таблица нужна ради статистики
-- и достижений.

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_id uuid references public.tokens (id) on delete set null,
  token_address text,
  ticker text,
  side text not null check (side in ('buy', 'sell')),
  ton_amount double precision not null default 0,
  token_amount double precision not null default 0,
  -- Курс на момент сделки. Пересчитывать прошлые сделки по сегодняшнему
  -- курсу нельзя: прибыль скакала бы вместе с курсом TON.
  ton_price_usd double precision not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists trades_user_idx on public.trades (user_id, created_at desc);
create index if not exists trades_token_idx on public.trades (token_address);

alter table public.trades enable row level security;

-- Свои сделки видит только их владелец: это его портфель, а не публичная
-- лента. Публичная лента строится по цепочке, там чужие записи не нужны.
drop policy if exists "read own trades" on public.trades;
create policy "read own trades"
  on public.trades for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own trades" on public.trades;
create policy "insert own trades"
  on public.trades for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Править и удалять свои сделки нельзя даже владельцу: иначе статистика
-- и достижения перестают что-либо значить.
