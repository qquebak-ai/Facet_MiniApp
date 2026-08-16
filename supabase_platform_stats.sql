-- Цифры площадки для главной.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Считать их в браузере нельзя. Запуски он ещё сосчитает, а вот
-- собранное в кривых и число вышедших на биржу лежат в token_notify —
-- служебной таблице, у которой политик доступа нет вовсе, и правильно:
-- иначе владелец токена мог бы подправить себе отметки. Читать её
-- разрешено одной этой функции, и та отдаёт наружу только три числа,
-- ничего построчно.
--
-- Свежесть: обработчик уведомлений обходит кривые раз в десять минут,
-- значит и «собрано» отстаёт не больше чем на этот срок. Для витрины
-- этого достаточно, а тянуть состояние двух десятков кривых из браузера
-- ради строки на главной — верный способ упереться в лимиты tonapi.

create or replace function public.platform_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    -- Запуски за сутки: то, что показывает, живо ли место сегодня.
    'launched24', (
      select count(*) from public.tokens
       where network = 'mainnet' and created_at > now() - interval '24 hours'
    ),
    'launched', (
      select count(*) from public.tokens where network = 'mainnet'
    ),
    -- Собрано во всех живых кривых. Это не оборот, а именно то, что
    -- сейчас лежит в контрактах и выплачивается продающим.
    'raisedTon', coalesce((
      select sum(n.last_real_ton)
        from public.token_notify n
        join public.tokens t on t.id = n.token_id
       where t.network = 'mainnet' and not n.sent_closed
    ), 0),
    -- Дошли до биржи. Отметку ставит тот же обработчик, когда видит
    -- закрытую кривую.
    'graduated', (
      select count(*)
        from public.token_notify n
        join public.tokens t on t.id = n.token_id
       where t.network = 'mainnet' and n.sent_closed
    )
  );
$$;

revoke all on function public.platform_stats() from public;
-- Главную видят и те, кто ещё не завёл аккаунт, — иначе витрина пуста
-- ровно для тех, кого она должна привлекать.
grant execute on function public.platform_stats() to anon, authenticated;
