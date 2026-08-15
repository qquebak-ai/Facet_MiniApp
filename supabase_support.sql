-- Поддержка: переписка человека с командой.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Раньше «Поддержка» открывала ссылку на чат, которого нет: человек
-- упирался в тупик, а написать было некуда. Теперь переписка живёт
-- здесь, а бот носит её в обе стороны — вопрос уходит в служебный чат
-- команды, ответ возвращается и в приложение, и в личку Telegram.

-- 1. Сама переписка. Строка — одно сообщение, чьё именно, говорит
-- from_admin.
create table if not exists public.support_messages (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  from_admin boolean not null default false,
  body text not null check (length(btrim(body)) between 1 and 2000),
  -- Имя ответившего: человеку важно видеть, что отвечает живой
  -- сотрудник, а не «система».
  admin_name text,
  seen_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_user_idx
  on public.support_messages (user_id, created_at);
-- Для счётчика непрочитанного: выбираются только чужие ответы.
create index if not exists support_messages_unseen_idx
  on public.support_messages (user_id) where from_admin and not seen_by_user;

alter table public.support_messages enable row level security;

drop policy if exists "своя переписка видна" on public.support_messages;
create policy "своя переписка видна" on public.support_messages
  for select to authenticated using (auth.uid() = user_id);

-- Политики на запись нет намеренно. Сообщения принимает обработчик
-- /api/support: он же пересылает их в чат команды и запоминает, кому
-- отвечать. Разреши мы вставку из браузера — письмо оседало бы в базе,
-- а до людей не доходило, и человек ждал бы ответа на непрочитанное.

-- 2. Отметка «прочитано» — единственное, что человек меняет сам.
create or replace function public.support_mark_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.support_messages
     set seen_by_user = true
   where user_id = auth.uid() and from_admin and not seen_by_user;
$$;

revoke all on function public.support_mark_seen() from public;
grant execute on function public.support_mark_seen() to authenticated;

-- 3. Кому адресован ответ.
--
-- В служебном чате команда отвечает реплаем на пересланный вопрос, и по
-- одному только тексту непонятно, кому этот ответ. Поэтому храним
-- соответствие «сообщение в чате поддержки → чья это переписка».
--
-- Таблица служебная: ни одной политики, читает и пишет только обработчик
-- своим service_role ключом.
create table if not exists public.support_relay (
  admin_message_id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.support_relay enable row level security;
