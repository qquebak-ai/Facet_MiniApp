-- Вход через Telegram: привязка профиля к telegram_id.
-- Выполнить один раз в Supabase → SQL Editor.

alter table public.profiles
  add column if not exists telegram_id bigint;

create unique index if not exists profiles_telegram_id_key
  on public.profiles (telegram_id)
  where telegram_id is not null;

-- Профили при входе через Telegram создаёт серверная функция
-- (api/telegram-auth.js) с service_role ключом, поэтому политики RLS для
-- вставки не нужны — service_role их обходит. Чтение и обновление своей
-- строки остаются на существующих политиках profiles.
