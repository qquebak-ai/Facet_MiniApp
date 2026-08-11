-- Память уведомлений. Выполнить один раз в Supabase → SQL Editor.
--
-- Расписание раз в несколько минут читает состояние каждой кривой и
-- сравнивает с тем, что было в прошлый заход: отсюда и «купили на N
-- TON», и «половина пути», и «кривая закрылась». Без этой памяти каждое
-- срабатывание слало бы одно и то же.
--
-- Политик доступа у таблицы намеренно нет: RLS включён, а значит ни
-- один вошедший пользователь её не прочитает и не изменит. Пишет в неё
-- только серверный обработчик своим service_role ключом, который RLS
-- обходит. Иначе владелец токена мог бы сбросить отметки и слать себе
-- уведомления сколько угодно.

create table if not exists public.token_notify (
  token_id uuid primary key references public.tokens (id) on delete cascade,
  last_real_ton double precision,
  sent_half boolean not null default false,
  sent_almost boolean not null default false,
  sent_closed boolean not null default false,
  checked_at timestamptz not null default now()
);

alter table public.token_notify enable row level security;
