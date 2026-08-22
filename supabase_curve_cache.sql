-- Готовые числа по кривым, чтобы приложение не опрашивало цепочку само.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Зачем это нужно. Цена, капитализация, объём и число держателей живут
-- в цепочке, и до сих пор каждый телефон выяснял их сам: по три запроса
-- к tonapi на каждый токен, строго по очереди — ключ пускает примерно
-- один запрос в секунду. Лента из десятка токенов набиралась секунд
-- десять, и это при том, что у всех она одинаковая.
--
-- Теперь цепочку обходит сервер (см. api/refresh-curves.js, его дёргает
-- расписание раз в минуту) и складывает результат сюда, а приложение
-- забирает всю ленту одним запросом к базе.
--
-- Читать может кто угодно: это те же числа, что и так видны на экране
-- токена. Писать — только обработчик своим service_role ключом, иначе
-- владелец токена мог бы нарисовать себе любую капитализацию.

create table if not exists public.curve_cache (
  token_id       uuid primary key references public.tokens (id) on delete cascade,
  curve_address  text,
  -- Цена одного токена в TON. В долларах не храним намеренно: курс
  -- меняется чаще обхода, и приложение считает его само.
  price_ton      double precision,
  real_ton       double precision,
  graduation_ton double precision,
  tokens_sold    double precision,
  supply         double precision,
  fee_bps        integer,
  graduated      boolean not null default false,
  -- Держатели без служебного кошелька самой кривой: на ней лежит
  -- непроданный запас, человеком она не является.
  holders        integer,
  vol24_ton      double precision not null default 0,
  change24       double precision not null default 0,
  tx24           integer not null default 0,
  -- Логотип из метаданных жетона — для токенов, у которых в базе он не
  -- сохранился. Обход всё равно читает метаданные ради держателей.
  logo_url       text,
  updated_at     timestamptz not null default now()
);

alter table public.curve_cache enable row level security;

drop policy if exists "curve cache is public" on public.curve_cache;
create policy "curve cache is public"
  on public.curve_cache for select
  using (true);

-- История сделок кривой для графика: время, сумма и резерв после
-- сделки. Свечи из неё приложение складывает само за миллисекунды, а
-- вот прочитать двести транзакций с цепочки — это отдельный запрос на
-- каждое открытие токена, и график появлялся с задержкой.
alter table public.curve_cache add column if not exists trades jsonb;

-- Индекс по времени обновления: приложение проверяет свежесть, а
-- обработчик выбирает, что давно не обновлялось.
create index if not exists curve_cache_updated_idx on public.curve_cache (updated_at desc);
