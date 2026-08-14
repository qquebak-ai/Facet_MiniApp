-- Настройки уведомлений: что присылать и с какой суммы.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Раньше порог покупки был зашит в обработчик (0.05 TON) и одинаков для
-- всех: у кого токен раскупают мелкими сделками, тот получал десятки
-- сообщений в день, а кому важна каждая копейка — не мог опустить порог
-- ниже. Теперь и то, и другое выбирает сам человек.
--
-- Поля читает только серверный обработчик (api/notify.js). Менять их
-- человек может у себя, поэтому отдельных политик не нужно — они
-- меняются вместе с остальным профилем.

alter table public.profiles
  -- Сообщать о покупках чужими людьми.
  add column if not exists notify_buys boolean not null default true,
  -- Порог: покупки мельче этой суммы в TON не тревожат.
  add column if not exists notify_min_ton numeric(12, 3) not null default 0.05,
  -- Вехи пути до биржи: половина, девять десятых, закрытие кривой.
  add column if not exists notify_progress boolean not null default true;

-- Порог не должен быть отрицательным или запредельным: и то, и другое
-- означало бы «не слать никогда», а для этого есть отдельный
-- переключатель.
alter table public.profiles
  drop constraint if exists profiles_notify_min_ton_range;
alter table public.profiles
  add constraint profiles_notify_min_ton_range
  check (notify_min_ton >= 0 and notify_min_ton <= 100000);
