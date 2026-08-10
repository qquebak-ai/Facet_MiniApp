-- Приглашения по реферальной ссылке.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Ссылка выглядит как https://t.me/<бот>/<приложение>?startapp=ref_<id>.
-- Telegram передаёт хвост в start_param, приложение отправляет его на
-- сервер вместе с подписью, а сервер (api/telegram-auth.js) проверяет,
-- что такой пользователь существует и что это не сам приглашённый, и
-- записывает связь единожды — при создании профиля.

alter table public.profiles
  add column if not exists invited_by uuid references auth.users (id) on delete set null;

-- Считать «сколько я пригласил» — это выборка по этому полю, поэтому
-- индекс не роскошь.
create index if not exists profiles_invited_by_idx
  on public.profiles (invited_by)
  where invited_by is not null;

-- Менять поле из приложения нельзя: его ставит только сервер своим
-- ключом, обходящим политики. Иначе любой мог бы приписать себе чужие
-- приглашения. Явного разрешения на update здесь нет, а существующая
-- политика профиля должна ограничивать изменения своей строкой —
-- проверьте, что она не даёт менять invited_by:
--
--   create policy "update own profile" on public.profiles for update
--     to authenticated using (auth.uid() = id) with check (auth.uid() = id);
--
-- Этого достаточно: чужую строку тронуть нельзя, а своя связь уже
-- проставлена сервером при первом входе.
