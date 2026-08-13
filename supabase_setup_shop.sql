-- Магазин: покупки, выдача монет и запрет менять ник.
-- Выполнить один раз целиком в Supabase → SQL Editor → Run.
-- Собрано из supabase_shop_coins.sql, supabase_shop_grant.sql и
-- supabase_nickname_lock.sql, повторный запуск ничего не сломает.


-- 1. Список покупок --------------------------------------------------
--
-- Отдельного поля с балансом нет и не нужно: баланс считается как
-- «выдано + заработано достижениями − потрачено на купленное».
-- Рассинхронизировать нечего, хранить нужно только сами покупки.
-- Ключ покупки — «вид:предмет» (frame:gold, card:meteor): у рамки и
-- карточки бывают одинаковые названия, по одному имени их не различить.
--
-- Своих политик колонке не нужно: она читается и пишется вместе с
-- остальным профилем по тем, что уже стоят на таблице profiles.

alter table public.profiles
  add column if not exists owned_cosmetics text[] not null default '{}';


-- 2. Монеты, выданные вручную ----------------------------------------
--
-- Приложение эту колонку только читает и никогда не пишет, поэтому
-- накрутить её из браузера нельзя — правится она отсюда.

alter table public.profiles
  add column if not exists coins_granted integer not null default 0;

-- Начисление на аккаунт qquebak. Регистр не важен: ник ищется по
-- приведённому к строчным буквам, иначе «QQuebak» в базе не нашёлся бы.
update public.profiles
   set coins_granted = 10000
 where lower(nickname) = 'qquebak';


-- 3. Ник неизменяем --------------------------------------------------
--
-- Имя выбирается один раз, при создании аккаунта. Под ним человека
-- знают в ленте покупок, в чужих профилях и в ссылках приглашений —
-- подмена задним числом ломает всё это разом. Приложение поле ника уже
-- не показывает, но этого мало: запрос уходит из браузера, и составить
-- его руками может кто угодно со своей сессией. Запрет стоит здесь, где
-- обойти его нельзя.
--
-- Триггер срабатывает только на изменение строки. Создание он не
-- трогает: там ник как раз и появляется, из формы через серверный
-- обработчик.

create or replace function public.lock_nickname()
returns trigger
language plpgsql
as $$
begin
  if new.nickname is distinct from old.nickname then
    raise exception 'nickname is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists lock_nickname on public.profiles;
create trigger lock_nickname
  before update on public.profiles
  for each row
  execute function public.lock_nickname();


-- 4. Проверка --------------------------------------------------------
--
-- Должна вернуться одна строка с 10000. Если строк ноль — аккаунт в базе
-- записан под другим именем; посмотреть, под каким, можно так:
--   select nickname, telegram_id from public.profiles order by created_at desc limit 20;

select nickname, coins_granted, owned_cosmetics
  from public.profiles
 where lower(nickname) = 'qquebak';


-- Если ник когда-нибудь всё же нужно поправить руками (скажем,
-- оскорбительное имя), это делается с временно снятым триггером:
--
--   alter table public.profiles disable trigger lock_nickname;
--   update public.profiles set nickname = 'new_name' where id = '<uuid>';
--   alter table public.profiles enable trigger lock_nickname;
