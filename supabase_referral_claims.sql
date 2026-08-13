-- Приглашение закрепляется за телеграм-аккаунтом навсегда.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Без этой таблицы приглашения накручиваются в одно действие: удалить
-- аккаунт, перейти по ссылке заново, завести профиль — и счётчик
-- пригласившего растёт ещё раз. Профиль-то удалён, а значит связь
-- «кто кого привёл» исчезала вместе с ним, и всё начиналось с чистого
-- листа. Повторять можно было сколько угодно.
--
-- Здесь связь живёт отдельно от профиля и переживает его удаление:
-- один телеграм-аккаунт — одно приглашение, раз и навсегда. Пришёл
-- второй раз по чужой ссылке — засчитается тот, кто привёл первым;
-- вернулся после удаления — прежний пригласивший вернётся к нему сам,
-- и счётчик восстановится.

create table if not exists public.referral_claims (
  telegram_id bigint primary key,
  inviter uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- По этому полю считается «сколько человек я привёл».
create index if not exists referral_claims_inviter_idx
  on public.referral_claims (inviter);

-- Таблица служебная: пишет и читает её только сервер своим ключом,
-- обходящим политики. Защита включена, политик нет намеренно — значит
-- из браузера сюда не попасть.
alter table public.referral_claims enable row level security;

-- Посмотреть, кто кого привёл:
--
--   select c.telegram_id, p.nickname as пригласивший, c.created_at
--     from public.referral_claims c
--     left join public.profiles p on p.id = c.inviter
--    order by c.created_at desc;
