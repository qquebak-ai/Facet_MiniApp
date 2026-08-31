-- Внутренний кошелёк приложения.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Зачем. Каждая сделка сейчас требует подписи в кошельке: приложение
-- собирает транзакцию, человек уходит в Phantom, подтверждает, ждёт
-- возврата. На спокойном рынке это терпимо, на быстром — сделка успевает
-- устареть. Внутренний кошелёк убирает этот шаг: деньги лежат на адресе,
-- которым управляет приложение, и покупка уходит в сеть сразу.
--
-- Что здесь хранится. Адрес и его ключ — зашифрованный, расшифровать его
-- можно только ключом площадки из переменных окружения (APP_WALLET_KEY),
-- которого в базе нет. Сам баланс не хранится нигде: он читается из сети
-- по адресу, поэтому разойтись с действительностью не может.
--
-- Читать свою строку может только владелец, и только адрес: ключ закрыт
-- от всех, включая его самого — с ним он ушёл бы мимо приложения.

create table if not exists public.app_wallets (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  chain       text not null default 'solana',
  address     text not null unique,
  secret_enc  text not null,          -- ключ, зашифрованный ключом площадки
  created_at  timestamptz not null default now()
);

create index if not exists app_wallets_address_idx on public.app_wallets (address);

alter table public.app_wallets enable row level security;

-- Своя строка видна владельцу, но без ключа: колонки выбираются в
-- запросе, а приложение спрашивает только адрес. Записывает и читает
-- ключ единственный, кто может, — обработчик со своим service_role.
drop policy if exists "свой кошелёк виден владельцу" on public.app_wallets;
create policy "свой кошелёк виден владельцу" on public.app_wallets
  for select using (auth.uid() = user_id);

-- Проверить:
--   select user_id, chain, address, created_at from public.app_wallets limit 5;
