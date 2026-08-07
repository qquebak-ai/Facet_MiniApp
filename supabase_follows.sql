-- Подписки на создателей токенов.
-- Выполнить один раз в Supabase → SQL Editor.

create table if not exists public.follows (
  follower_id  uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  -- на себя подписаться нельзя
  constraint follows_not_self check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id);
create index if not exists follows_follower_idx  on public.follows (follower_id);

alter table public.follows enable row level security;

-- Счётчики подписчиков видны всем, иначе их негде показать на карточке.
drop policy if exists "follows are public" on public.follows;
create policy "follows are public"
  on public.follows for select
  using (true);

-- Подписываться и отписываться можно только за себя.
drop policy if exists "follow as self" on public.follows;
create policy "follow as self"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "unfollow as self" on public.follows;
create policy "unfollow as self"
  on public.follows for delete
  using (auth.uid() = follower_id);
