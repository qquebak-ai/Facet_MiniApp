-- Права на таблицу запущенных токенов.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Читать может кто угодно: лента «Новые» показывается и тем, кто не
-- вошёл. Заводить, править и удалять строку может только её владелец —
-- иначе один пользователь мог бы стереть чужой токен из ленты или
-- переписать в нём адрес контракта, то есть увести чужих покупателей на
-- свой жетон.

alter table public.tokens enable row level security;

drop policy if exists "tokens are public" on public.tokens;
create policy "tokens are public"
  on public.tokens for select
  using (true);

drop policy if exists "insert own token" on public.tokens;
create policy "insert own token"
  on public.tokens for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "update own token" on public.tokens;
create policy "update own token"
  on public.tokens for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "delete own token" on public.tokens;
create policy "delete own token"
  on public.tokens for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Кошелёк создателя. По нему приложение показывает, сколько выпуска у
-- него осталось и продавал ли он: без адреса такую проверку не сделать.
-- У токенов, запущенных раньше, поле остаётся пустым — там честнее
-- показать «нет данных», чем додумывать.
alter table public.tokens
  add column if not exists creator_wallet text;
