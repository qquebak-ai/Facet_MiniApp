-- Косметика из магазина в профиле: рамка аватарки и карточка-подложка.
-- Раньше выбор хранился только в localStorage и был виден лишь владельцу
-- устройства — ради того, чтобы предметы видели другие, они переезжают в
-- профиль. Выполнить один раз в Supabase → SQL Editor.

alter table public.profiles
  add column if not exists frame_id text not null default 'none';

alter table public.profiles
  add column if not exists card_id text not null default 'none';

-- Отдельные политики не нужны: колонки читаются и обновляются вместе с
-- остальным профилем по уже существующим политикам таблицы profiles.
