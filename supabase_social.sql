-- Лента событий, топ, уведомления держателям и доля с комиссий друзей.
-- Выполнить один раз в Supabase → SQL Editor.

-- 1. Кому из держателей что уже отправляли.
--
-- Владельцу токена уведомления шли давно, а тому, кто просто купил
-- чужой токен, — ничего: ни «вышел на биржу», ни «прошёл половину
-- пути». Отметки лежат здесь, чтобы одно и то же не приходило дважды.
--
-- Политик нет вовсе: пишет только серверный обработчик своим
-- service_role ключом. Иначе получатель мог бы сбросить отметки и слать
-- себе уведомления сколько угодно.
create table if not exists public.holder_notify (
  user_id  uuid not null references auth.users (id) on delete cascade,
  token_id uuid not null references public.tokens (id) on delete cascade,
  event    text not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, token_id, event)
);
alter table public.holder_notify enable row level security;

-- Держатели токена по своим сделкам: купил больше, чем продал.
-- Читает только обработчик уведомлений — отсюда security definer и
-- отсутствие прав у обычного пользователя.
create or replace function public.token_holders(p_token uuid)
returns table (user_id uuid, telegram_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  select t.user_id, p.telegram_id
    from public.trades t
    join public.profiles p on p.id = t.user_id
   where t.token_id = p_token and p.telegram_id is not null
   group by t.user_id, p.telegram_id
  having sum(case when t.side = 'buy' then t.token_amount else -t.token_amount end) > 0;
$$;
revoke all on function public.token_holders(uuid) from public;


-- 2. Лента событий для главной.
--
-- Своя таблица сделок закрыта политикой «вижу только своё» — и это
-- правильно, портфель чужим не показывают. Но обезличенная строка
-- «кто-то купил $PRSM на 12 TON» безопасна и нужна: без неё главная не
-- показывает, что площадка живая. Поэтому наружу отдаёт функция,
-- которая сама выбирает, что можно показать: ник, тикер, сторона,
-- сумма и время. Ни адресов, ни размеров чужих портфелей.
create or replace function public.recent_activity(p_limit integer default 12, p_network text default null)
returns table (
  kind text,
  nickname text,
  ticker text,
  ton double precision,
  at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    -- Суммы приводим к одному типу руками: ton_amount в сделках —
    -- число, а buy_amount у токена лежит строкой (форму заполняет
    -- человек), и union их не сводит.
    select 'trade'::text as kind, p.nickname, coalesce(tk.ticker, t.ticker) as ticker,
           t.ton_amount::double precision as ton, t.created_at as at
      from public.trades t
      join public.profiles p on p.id = t.user_id
      left join public.tokens tk on tk.id = t.token_id
     where t.created_at > now() - interval '48 hours'
       -- Сеть приходит из приложения: оно знает, в какой сейчас
       -- работает. Пусто — показываем всё, так функция остаётся
       -- пригодной и для проверок руками.
       and (p_network is null or coalesce(tk.network, 'mainnet') = p_network)
    union all
    select 'launch'::text, p.nickname, tk.ticker,
           -- Через проверку, а не просто приведением: в строке может
           -- оказаться что угодно, и один кривой токен ронял бы всю ленту.
           case when btrim(tk.buy_amount::text) ~ '^[0-9]+([.,][0-9]+)?$'
                then replace(btrim(tk.buy_amount::text), ',', '.')::double precision
                else null end,
           tk.created_at
      from public.tokens tk
      join public.profiles p on p.id = tk.owner_id
     where (p_network is null or tk.network = p_network)
       and tk.created_at > now() - interval '48 hours'
  ) s
  order by at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;
revoke all on function public.recent_activity(integer, text) from public;
grant execute on function public.recent_activity(integer, text) to anon, authenticated;


-- 3. Топ.
--
-- Токены — по собранному в кривой, создатели — по сумме собранного их
-- токенами. Собранное берётся из token_notify: обработчик уведомлений
-- и так обходит кривые раз в несколько минут, и держать ради витрины
-- отдельный обход цепочки незачем.
create or replace function public.leaderboard(p_limit integer default 5, p_network text default null)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'tokens', coalesce((
      select json_agg(x) from (
        -- Своего эмодзи у токена нет: в приложении ему рисуется ракета,
        -- а тут хватает логотипа.
        select tk.id, tk.ticker, tk.name, tk.logo_url,
               coalesce(n.last_real_ton, 0) as raised,
               coalesce(n.sent_closed, false) as graduated
          from public.tokens tk
          left join public.token_notify n on n.token_id = tk.id
         where (p_network is null or tk.network = p_network)
         order by coalesce(n.last_real_ton, 0) desc, tk.created_at desc
         limit least(greatest(coalesce(p_limit, 5), 1), 20)
      ) x), '[]'::json),
    'creators', coalesce((
      select json_agg(y) from (
        select p.id, p.nickname, p.avatar_url, p.emoji, p.frame_id,
               count(tk.id) as launched,
               coalesce(sum(n.last_real_ton), 0) as raised
          from public.tokens tk
          join public.profiles p on p.id = tk.owner_id
          left join public.token_notify n on n.token_id = tk.id
         where (p_network is null or tk.network = p_network)
         group by p.id, p.nickname, p.avatar_url, p.emoji, p.frame_id
         order by coalesce(sum(n.last_real_ton), 0) desc, count(tk.id) desc
         limit least(greatest(coalesce(p_limit, 5), 1), 20)
      ) y), '[]'::json)
  );
$$;
revoke all on function public.leaderboard(integer, text) from public;
grant execute on function public.leaderboard(integer, text) to anon, authenticated;


-- 4. Доля с комиссий приглашённых.
--
-- За друга и раньше давали монеты — разово, за сам факт регистрации.
-- Приводить того, кто торгует, это не мотивировало никак. Теперь
-- пригласившему идёт доля с комиссии площадки от сделок его друзей.
--
-- Важно понимать, чем это не является: TON никуда не переводится.
-- Комиссию удерживает контракт кривой и отправляет на кошелёк площадки
-- ещё в цепочке, поделить её там между людьми нельзя. Поэтому доля
-- начисляется монетами по курсу ниже, и в приложении так и написано.
create table if not exists public.referral_payout (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  counted_ton double precision not null default 0,
  paid_coins  integer not null default 0,
  updated_at  timestamptz not null default now()
);
alter table public.referral_payout enable row level security;
drop policy if exists "свои начисления видны" on public.referral_payout;
create policy "свои начисления видны" on public.referral_payout
  for select to authenticated using (auth.uid() = user_id);

-- Сколько монет за один TON оборота друзей. Комиссия площадки — 1%,
-- десятая часть от неё уходит пригласившему: с сотни TON оборота это
-- 0.1 TON, здесь — 10 монет.
create or replace function public.referral_claim()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  оборот double precision;
  учтено double precision;
  новые double precision;
  монет integer;
begin
  if uid is null then return json_build_object('ok', false, 'error', 'no_auth'); end if;

  -- Оборот друзей: покупки и продажи, обе стороны платят комиссию.
  select coalesce(sum(t.ton_amount), 0) into оборот
    from public.trades t
    join public.profiles p on p.id = t.user_id
   where p.invited_by = uid;

  select coalesce(counted_ton, 0) into учтено
    from public.referral_payout where user_id = uid;
  учтено := coalesce(учтено, 0);

  новые := greatest(0, оборот - учтено);
  монет := floor(новые * 10);

  -- Меньше монеты не начисляем, но и оборот тогда не отмечаем —
  -- иначе мелочь терялась бы при каждом заходе.
  if монет <= 0 then
    return json_build_object('ok', true, 'coins', 0, 'volume', оборот, 'pending', новые);
  end if;

  insert into public.referral_payout (user_id, counted_ton, paid_coins, updated_at)
  values (uid, учтено + монет / 10.0, монет, now())
  on conflict (user_id) do update
    set counted_ton = public.referral_payout.counted_ton + монет / 10.0,
        paid_coins = public.referral_payout.paid_coins + монет,
        updated_at = now();

  perform set_config('app.shop_txn', 'on', true);
  update public.profiles set coins_granted = coalesce(coins_granted, 0) + монет where id = uid;
  perform set_config('app.shop_txn', 'off', true);

  return json_build_object('ok', true, 'coins', монет, 'volume', оборот, 'balance', public.coins_balance(uid));
end;
$$;

revoke all on function public.referral_claim() from public;
grant execute on function public.referral_claim() to authenticated;
