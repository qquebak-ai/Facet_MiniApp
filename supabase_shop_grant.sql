-- Выдача монет вручную. Выполнить в Supabase → SQL Editor.
--
-- Обычный путь пополнения — достижения, и отдельного поля с балансом в
-- базе нет: он считается как «выдано + заработано − потрачено».
-- Выданное лежит здесь, и правится только отсюда: приложение эту колонку
-- читает, но никогда не пишет, поэтому накрутить её из браузера нельзя.

alter table public.profiles
  add column if not exists coins_granted integer not null default 0;

-- Начислить себе. Подставь свой ник (или telegram_id) и число:
--
--   update public.profiles set coins_granted = 10000 where nickname = 'твой_ник';
--   update public.profiles set coins_granted = 10000 where telegram_id = 123456789;
--
-- Посмотреть, кому сколько выдано:
--
--   select nickname, telegram_id, coins_granted from public.profiles
--   where coins_granted <> 0;
