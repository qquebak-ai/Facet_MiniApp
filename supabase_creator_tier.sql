-- Знак создателя: лавровый венок за капитализацию своего токена.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Ступени: 1 — $1K, 2 — $10K, 3 — $100K. Значение хранится в профиле,
-- потому что знак видят другие: на карточке токена и на публичном
-- профиле. Считает его приложение по данным самой кривой, и только
-- вверх — просадка цены уже полученный знак не отбирает.

alter table public.profiles
  add column if not exists creator_tier smallint not null default 0;

-- Ставить себе уровень руками нельзя: значение обязано остаться в
-- пределах 0..3. Выше этого проверка не идёт — свой профиль человек и
-- так может править, а завышенный знак ничего не даёт, кроме картинки.
alter table public.profiles
  drop constraint if exists profiles_creator_tier_range;
alter table public.profiles
  add constraint profiles_creator_tier_range check (creator_tier between 0 and 3);
