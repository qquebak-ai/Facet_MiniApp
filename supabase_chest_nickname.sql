-- Сундук и платная смена ника.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- 1. Потраченные монеты теперь хранятся числом.
--
-- Раньше баланс считался как «заработано минус сумма цен купленного»:
-- траты выводились из списка вещей. С сундуком так нельзя — он стоит
-- меньше, чем вещь, которая из него выпала, и вычитание по прайсу
-- показывало бы человеку меньше монет, чем он потратил на самом деле.
-- Смена ника вообще ничего не добавляет в список вещей.
--
-- Поэтому траты складываются по факту: купил вещь — прибавилась её
-- цена, открыл сундук — цена сундука, сменил ник — цена смены.
--
-- Колонка заполняется один раз по уже купленному, чтобы у тех, кто
-- покупал раньше, баланс не подскочил.

alter table public.profiles
  add column if not exists coins_spent integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_coins_spent_nonneg;
alter table public.profiles
  add constraint profiles_coins_spent_nonneg check (coins_spent >= 0);


-- 2. Ник снова можно менять — за монеты.
--
-- Запрет стоял триггером и не знал ни о какой оплате: для базы всякая
-- смена выглядела одинаково. Снимаем его, а уникальность имени остаётся
-- на индексе ниже — двух одинаковых ников не будет по-прежнему.

drop trigger if exists lock_nickname on public.profiles;
drop function if exists public.lock_nickname();

-- Уникальность без учёта регистра: «Leo» и «leo» рядом путают людей
-- сильнее, чем отказ при выборе имени.
create unique index if not exists profiles_nickname_lower_idx
  on public.profiles (lower(nickname));
