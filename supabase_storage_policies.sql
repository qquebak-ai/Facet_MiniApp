-- Политики хранилища для картинок токенов и аватарок.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Смысл один: писать можно только в свою папку. Первый сегмент пути
-- обязан совпадать с идентификатором вошедшего пользователя, поэтому
-- чужой metadata.json подменить нельзя — а именно им определяются имя,
-- символ и картинка уже выпущенного жетона. Раньше первым сегментом
-- стояло время создания, и любой вошедший мог перезаписать чужой файл.
--
-- Читать разрешено всем: ссылки на метаданные жетона зашиты в контракт
-- и должны открываться у кого угодно, включая кошельки и обозреватели.

-- token-assets: логотипы и metadata.json запускаемых токенов ----------

drop policy if exists "token assets are public" on storage.objects;
create policy "token assets are public"
  on storage.objects for select
  using (bucket_id = 'token-assets');

drop policy if exists "token assets write own folder" on storage.objects;
create policy "token assets write own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'token-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "token assets update own folder" on storage.objects;
create policy "token assets update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'token-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "token assets delete own folder" on storage.objects;
create policy "token assets delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'token-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- avatars: аватарки профилей ------------------------------------------

drop policy if exists "avatars are public" on storage.objects;
create policy "avatars are public"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars write own folder" on storage.objects;
create policy "avatars write own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars update own folder" on storage.objects;
create policy "avatars update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars delete own folder" on storage.objects;
create policy "avatars delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
