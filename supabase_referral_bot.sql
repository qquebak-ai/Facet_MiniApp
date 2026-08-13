-- Приглашения, пришедшие через чат с ботом.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Ссылку приглашения открывают двумя разными путями, и раньше работал
-- только первый:
--
--   1. Прямая ссылка на приложение (t.me/бот/приложение?startapp=ref_…).
--      Telegram отдаёт метку самому приложению, оно шлёт её на вход.
--   2. Чат с ботом (t.me/бот?start=ref_…, пересланная ссылка, открытие с
--      компьютера, кнопка «Start»). Тут метку получает бот, а приложение
--      о ней не узнаёт вовсе — человек заводил аккаунт как обычный, без
--      приглашения.
--
-- Для второго пути бот (api/telegram-bot.js) кладёт метку сюда, а вход
-- (api/telegram-auth.js) забирает её при создании профиля и удаляет.
-- Строка живёт до первого использования.

create table if not exists public.pending_referrals (
  telegram_id bigint primary key,
  inviter uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Таблица служебная: читает и пишет её только сервер своим ключом,
-- который обходит политики. Защита включена, а политик нет намеренно —
-- значит из браузера сюда не попасть ни на чтение, ни на запись. Иначе
-- любой мог бы приписать себе чужие приглашения.
alter table public.pending_referrals enable row level security;

-- Посмотреть, кто ждёт своего первого входа:
--
--   select * from public.pending_referrals order by created_at desc;
