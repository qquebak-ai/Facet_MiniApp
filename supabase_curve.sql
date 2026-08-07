-- Адрес бондинг-кривой у токена и её кошелька жетона.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Кривая — это рынок токена: покупка идёт сообщением на её адрес,
-- продажа — переводом жетонов на её кошелёк. Без этих двух полей
-- приложение не знает, куда отправлять сделки.

alter table public.tokens
  add column if not exists curve_address text;

alter table public.tokens
  add column if not exists curve_jetton_wallet text;

create index if not exists tokens_curve_address_idx
  on public.tokens (curve_address)
  where curve_address is not null;
