-- Комментарии под токеном.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Единственное место в приложении, где люди говорят друг с другом.
-- Подписки на создателей уже были, а обсуждать токен было негде.

create table if not exists public.token_comments (
  id bigserial primary key,
  token_id uuid not null references public.tokens (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 400),
  created_at timestamptz not null default now()
);

create index if not exists token_comments_token_idx
  on public.token_comments (token_id, created_at desc);

alter table public.token_comments enable row level security;

-- Читают все, включая тех, кто ещё не завёл аккаунт: обсуждение — часть
-- витрины, и прятать его от гостя значит прятать половину причины
-- остаться.
drop policy if exists "комментарии видны всем" on public.token_comments;
create policy "комментарии видны всем" on public.token_comments
  for select to anon, authenticated using (true);

-- Писать — только от своего имени.
drop policy if exists "пишу от своего имени" on public.token_comments;
create policy "пишу от своего имени" on public.token_comments
  for insert to authenticated with check (auth.uid() = user_id);

-- Удалять — только своё. Чужое удаляет владелец токена: у себя под
-- токеном он вправе подмести, но править чужие слова не может.
drop policy if exists "удаляю своё" on public.token_comments;
create policy "удаляю своё" on public.token_comments
  for delete to authenticated using (
    auth.uid() = user_id
    or auth.uid() = (select owner_id from public.tokens where id = token_id)
  );

-- Частота. Без неё один человек за минуту забьёт ленту под токеном так,
-- что остальных не будет видно.
create or replace function public.guard_comment_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  последний timestamptz;
  за_сутки integer;
begin
  select max(created_at) into последний
    from public.token_comments where user_id = new.user_id;
  if последний is not null and now() - последний < interval '8 seconds' then
    raise exception 'too_fast';
  end if;

  select count(*) into за_сутки
    from public.token_comments
   where user_id = new.user_id and created_at > now() - interval '24 hours';
  if за_сутки >= 120 then
    raise exception 'too_many';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_comment_rate on public.token_comments;
create trigger guard_comment_rate
  before insert on public.token_comments
  for each row execute function public.guard_comment_rate();

-- Комментарии вместе с автором одним запросом. Профили закрыты
-- политиками на чтение целиком, а для подписи под комментарием нужны
-- только имя, аватарка и надетая рамка — их и отдаём.
create or replace function public.token_comments_with_authors(p_token uuid, p_limit integer default 50)
returns table (
  id bigint,
  user_id uuid,
  body text,
  created_at timestamptz,
  nickname text,
  avatar_url text,
  emoji text,
  frame_id text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.user_id, c.body, c.created_at,
         p.nickname, p.avatar_url, p.emoji, p.frame_id
    from public.token_comments c
    left join public.profiles p on p.id = c.user_id
   where c.token_id = p_token
   order by c.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.token_comments_with_authors(uuid, integer) from public;
grant execute on function public.token_comments_with_authors(uuid, integer) to anon, authenticated;
