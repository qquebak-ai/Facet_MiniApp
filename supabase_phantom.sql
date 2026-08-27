-- Ответы кошелька Phantom на пути обратно в приложение.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Зачем. Phantom открывается своим приложением и, закончив, уходит на
-- адрес возврата в браузере. Вернуть параметры прямо в окно Telegram он
-- не может, поэтому они на секунду оседают здесь: приложение всё это
-- время открыто и опрашивает свою запись по ключу, который придумало до
-- перехода.
--
-- Прочитать содержимое нельзя ни из приложения, ни из базы: ключевая
-- пара для обмена рождается в браузере, а сюда попадает только
-- зашифрованный ею кусок. Политик доступа у таблицы нет вовсе — пишет и
-- читает её единственный обработчик своим service_role ключом.

create table if not exists public.phantom_sessions (
  id         text primary key,
  params     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.phantom_sessions enable row level security;

-- Записи живут секунды и после прочтения удаляются. Этот индекс нужен
-- уборке: незабранные ответы (человек закрыл кошелёк на полпути) иначе
-- копились бы вечно.
create index if not exists phantom_sessions_created_idx
  on public.phantom_sessions (created_at);

-- Уборка старого. Вызывать раз в сутки чем угодно — хоть тем же кроном,
-- что обходит кривые:
--   select public.phantom_cleanup();
create or replace function public.phantom_cleanup()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  убрано integer;
begin
  delete from public.phantom_sessions
   where created_at < now() - interval '1 hour';
  get diagnostics убрано = row_count;
  return убрано;
end;
$$;
