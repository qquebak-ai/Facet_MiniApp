-- Экономика магазина переезжает на сервер.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Как было: баланс считался в браузере, а покупки писались туда же —
-- обычным update своей строки. Значит любой, кто открыл консоль, мог
-- обнулить потраченное или выдать себе весь магазин: приложение ему
-- верило, потому что других источников правды не было.
--
-- Как стало: цены, баланс и списания живут здесь. Браузер только просит
-- «купи вот это», а решает база: знает цену, считает баланс, проверяет,
-- хватает ли монет, и записывает покупку. Денежные колонки при этом
-- закрыты для прямой правки — их меняют только функции ниже, которые
-- выполняются с правами владельца.

-- 1. Прайс. Держим в базе, потому что цену должен знать тот, кто
-- списывает деньги, а не тот, кто просит.
create table if not exists public.cosmetics (
  kind text not null check (kind in ('frame', 'card')),
  id   text not null,
  price integer not null check (price >= 0),
  primary key (kind, id)
);

insert into public.cosmetics (kind, id, price) values
  ('frame', 'none', 0),
  ('frame', 'ember', 120),
  ('frame', 'aurora', 180),
  ('frame', 'gold', 260),
  ('frame', 'ice', 200),
  ('frame', 'orbit', 240),
  ('frame', 'spark', 300),
  ('frame', 'toxic', 260),
  ('frame', 'comet', 320),
  ('frame', 'plasma', 320),
  ('frame', 'leafring', 280),
  ('frame', 'prism', 400),
  ('frame', 'pulse', 240),
  ('frame', 'eclipse', 360),
  ('card', 'none', 0),
  ('card', 'grid', 80),
  ('card', 'night', 140),
  ('card', 'emberCard', 160),
  ('card', 'auroraCard', 200),
  ('card', 'mint', 160),
  ('card', 'sunset', 240),
  ('card', 'meteor', 220),
  ('card', 'wave', 220),
  ('card', 'sparkCard', 200),
  ('card', 'leafCard', 240),
  ('card', 'beam', 220),
  ('card', 'holoCard', 300)
on conflict (kind, id) do update set price = excluded.price;

alter table public.cosmetics enable row level security;
drop policy if exists "прайс виден всем" on public.cosmetics;
create policy "прайс виден всем" on public.cosmetics for select to public using (true);


-- 2. Достижения, засчитанные сервером. Часть из них видна прямо здесь
-- (запуски, приглашения, заполненный профиль), часть — только с
-- цепочки: капитализация токена приходит от обработчика уведомлений,
-- который и так читает кривые (api/notify.js).
create table if not exists public.achievements_done (
  user_id uuid not null references auth.users (id) on delete cascade,
  ach_id  text not null,
  done_at timestamptz not null default now(),
  primary key (user_id, ach_id)
);
alter table public.achievements_done enable row level security;
drop policy if exists "свои достижения видны" on public.achievements_done;
create policy "свои достижения видны" on public.achievements_done
  for select to authenticated using (auth.uid() = user_id);


-- 3. Денежные колонки нельзя править из браузера.
--
-- Политика update на profiles разрешает менять свою строку целиком, и
-- отозвать её нельзя — там же лежат описание и аватарка. Поэтому запрет
-- точечный: триггер возвращает старые значения денежных полей, что бы
-- ни прислал браузер. Функции ниже выполняются с правами владельца и
-- этот триггер обходят, выставляя признак.
create or replace function public.guard_coin_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.shop_txn', true) = 'on' then
    return new;
  end if;
  new.coins_spent := old.coins_spent;
  new.coins_granted := old.coins_granted;
  new.owned_cosmetics := old.owned_cosmetics;
  return new;
end;
$$;

drop trigger if exists guard_coin_columns on public.profiles;
create trigger guard_coin_columns
  before update on public.profiles
  for each row
  execute function public.guard_coin_columns();


-- 4. Баланс. Одна формула на всё приложение, и живёт она здесь.
create or replace function public.coins_balance(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0,
    coalesce((select coins_granted from public.profiles where id = uid), 0)
    + coalesce((select sum(c) from (
        select case ach_id
          when 'firstLaunch' then 120
          when 'mcap1k' then 150
          when 'mcap10k' then 300
          when 'mcap100k' then 600
          when 'wallet' then 60
          when 'face' then 60
          when 'style' then 60
          when 'invite1' then 60
          when 'invite5' then 150
          when 'invite10' then 300
          when 'invite25' then 600
          else 0 end as c
        from public.achievements_done where user_id = uid) s), 0)
    -- Сто монет за каждого приглашённого, сверх ступенчатых достижений.
    + 100 * coalesce((select count(*) from public.profiles where invited_by = uid), 0)
    - coalesce((select coins_spent from public.profiles where id = uid), 0)
  )::integer;
$$;

revoke all on function public.coins_balance(uuid) from public;
grant execute on function public.coins_balance(uuid) to authenticated;


-- 5. Покупка вещи.
create or replace function public.shop_buy(p_kind text, p_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cost integer;
  have integer;
  owned_key text := p_kind || ':' || p_id;
begin
  if uid is null then return json_build_object('ok', false, 'error', 'no_auth'); end if;

  select price into cost from public.cosmetics where kind = p_kind and id = p_id;
  if cost is null then return json_build_object('ok', false, 'error', 'no_item'); end if;

  if exists (select 1 from public.profiles where id = uid and owned_key = any(owned_cosmetics)) then
    return json_build_object('ok', false, 'error', 'already_owned');
  end if;

  have := public.coins_balance(uid);
  if have < cost then
    return json_build_object('ok', false, 'error', 'not_enough', 'need', cost - have);
  end if;

  perform set_config('app.shop_txn', 'on', true);
  update public.profiles
     set coins_spent = coins_spent + cost,
         owned_cosmetics = array_append(coalesce(owned_cosmetics, '{}'), owned_key)
   where id = uid;
  perform set_config('app.shop_txn', 'off', true);

  return json_build_object('ok', true, 'kind', p_kind, 'id', p_id, 'balance', public.coins_balance(uid));
end;
$$;

revoke all on function public.shop_buy(text, text) from public;
grant execute on function public.shop_buy(text, text) to authenticated;


-- 6. Сундук: случайная вещь из некупленных, цена одна на всех.
create or replace function public.shop_open_chest(p_price integer default 140)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  have integer;
  pick record;
  owned_key text;
begin
  if uid is null then return json_build_object('ok', false, 'error', 'no_auth'); end if;
  -- Цену присылает приложение, но верим ей только в разумных пределах:
  -- иначе можно было бы «открыть сундук за ноль».
  if p_price is null or p_price < 100 or p_price > 1000 then p_price := 140; end if;

  have := public.coins_balance(uid);
  if have < p_price then
    return json_build_object('ok', false, 'error', 'not_enough', 'need', p_price - have);
  end if;

  select c.kind, c.id into pick
    from public.cosmetics c
   where c.price > 0
     and not ((c.kind || ':' || c.id) = any (
       coalesce((select owned_cosmetics from public.profiles where id = uid), '{}')))
   order by random()
   limit 1;

  if pick is null then return json_build_object('ok', false, 'error', 'empty'); end if;
  owned_key := pick.kind || ':' || pick.id;

  perform set_config('app.shop_txn', 'on', true);
  update public.profiles
     set coins_spent = coins_spent + p_price,
         owned_cosmetics = array_append(coalesce(owned_cosmetics, '{}'), owned_key)
   where id = uid;
  perform set_config('app.shop_txn', 'off', true);

  return json_build_object('ok', true, 'kind', pick.kind, 'id', pick.id, 'balance', public.coins_balance(uid));
end;
$$;

revoke all on function public.shop_open_chest(integer) from public;
grant execute on function public.shop_open_chest(integer) to authenticated;


-- 7. Смена ника за монеты.
create or replace function public.change_nickname(p_name text, p_price integer default 500)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  have integer;
  clean text := trim(p_name);
begin
  if uid is null then return json_build_object('ok', false, 'error', 'no_auth'); end if;
  if clean !~ '^[A-Za-z][A-Za-z0-9_.]{1,19}$' then
    return json_build_object('ok', false, 'error', 'bad_name');
  end if;
  if p_price is null or p_price < 100 or p_price > 5000 then p_price := 500; end if;

  if exists (select 1 from public.profiles where id = uid and lower(nickname) = lower(clean)) then
    return json_build_object('ok', true, 'nickname', clean, 'balance', public.coins_balance(uid));
  end if;
  if exists (select 1 from public.profiles where lower(nickname) = lower(clean)) then
    return json_build_object('ok', false, 'error', 'taken');
  end if;

  have := public.coins_balance(uid);
  if have < p_price then
    return json_build_object('ok', false, 'error', 'not_enough', 'need', p_price - have);
  end if;

  perform set_config('app.shop_txn', 'on', true);
  update public.profiles set nickname = clean, coins_spent = coins_spent + p_price where id = uid;
  perform set_config('app.shop_txn', 'off', true);

  return json_build_object('ok', true, 'nickname', clean, 'balance', public.coins_balance(uid));
end;
$$;

revoke all on function public.change_nickname(text, integer) from public;
grant execute on function public.change_nickname(text, integer) to authenticated;


-- 8. Отметить достижение. Условие проверяется здесь же, по базе: на
-- слово приложения ничего не начисляется.
create or replace function public.claim_achievement(p_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ok boolean := false;
  invites integer;
  launches integer;
  prof record;
begin
  if uid is null then return json_build_object('ok', false, 'error', 'no_auth'); end if;
  if exists (select 1 from public.achievements_done where user_id = uid and ach_id = p_id) then
    return json_build_object('ok', true, 'balance', public.coins_balance(uid));
  end if;

  select * into prof from public.profiles where id = uid;
  select count(*) into invites from public.profiles where invited_by = uid;
  select count(*) into launches from public.tokens where owner_id = uid;

  ok := case p_id
    when 'firstLaunch' then launches >= 1
    when 'invite1' then invites >= 1
    when 'invite5' then invites >= 5
    when 'invite10' then invites >= 10
    when 'invite25' then invites >= 25
    -- Лицо профиля: аватарка или значок и заполненное описание.
    when 'face' then (prof.avatar_url is not null or prof.emoji is not null) and coalesce(length(trim(prof.bio)), 0) > 0
    -- Наряд: надеты и рамка, и карточка.
    when 'style' then coalesce(prof.frame_id, 'none') <> 'none' and coalesce(prof.card_id, 'none') <> 'none'
    else false
  end;

  -- Кошелёк и вехи капитализации база сама проверить не может: первое
  -- живёт только в браузере, второе — на цепочке. Их отмечает
  -- обработчик уведомлений своим ключом.
  if not ok then return json_build_object('ok', false, 'error', 'not_yet'); end if;

  insert into public.achievements_done (user_id, ach_id) values (uid, p_id)
  on conflict do nothing;

  return json_build_object('ok', true, 'balance', public.coins_balance(uid));
end;
$$;

revoke all on function public.claim_achievement(text) from public;
grant execute on function public.claim_achievement(text) to authenticated;


-- 9. Перенос того, что уже накоплено. Считаем по прежним правилам один
-- раз, чтобы ни у кого не пропали монеты и купленные вещи.
insert into public.achievements_done (user_id, ach_id)
select p.id, 'invite1' from public.profiles p
 where (select count(*) from public.profiles x where x.invited_by = p.id) >= 1
on conflict do nothing;

insert into public.achievements_done (user_id, ach_id)
select p.id, 'firstLaunch' from public.profiles p
 where exists (select 1 from public.tokens t where t.owner_id = p.id)
on conflict do nothing;
