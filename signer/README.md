# Служба подписи внутренних кошельков

Ключ, которым зашифрованы ключи внутренних кошельков, не должен лежать
рядом с базой. Пока `APP_WALLET_KEY` живёт в переменных Vercel, одна
утечка окружения открывает и зашифрованные ключи (они в Supabase), и
ключ от них. Эта служба разрывает связку: ключ остаётся на своём
сервере, а Vercel умеет только попросить подписать конкретную
транзакцию.

Служба сама проверяет то, что ей прислали: плательщик должен совпадать
с владельцем ключа, программы — быть из списка (`api/_txguard.js`), а
сумма прямых переводов не больше собственного потолка службы. Просьбу с
завышенным потолком она обрезает до своего: вызывающий тоже может
оказаться взломанным.

## Установка на сервере (77.83.175.35)

```
apt update && apt install -y nodejs npm git
git clone https://github.com/qquebak-ai/Facet_MiniApp.git /opt/mintly
cd /opt/mintly/signer
npm install
```

Ключи. `APP_WALLET_KEY` — тот же, что раньше стоял в Vercel (если
кошельки уже заведены, ключ обязан быть тем же, иначе они не
откроются). `SIGNER_TOKEN` — новый длинный пароль, по которому служба
узнаёт Vercel:

```
openssl rand -base64 32
```

Файл окружения `/etc/mintly-signer.env` (права 600, владелец root):

```
APP_WALLET_KEY=<тот самый ключ>
SIGNER_TOKEN=<длинный пароль>
SOLANA_CURVE_PROGRAM=<адрес программы кривой>
SIGNER_MAX_SOL=5
PORT=8899
HOST=127.0.0.1
```

```
chmod 600 /etc/mintly-signer.env
```

## Служба systemd

Готовый файл лежит рядом — `signer/mintly-signer.service`:

```
cp /opt/mintly/signer/mintly-signer.service /etc/systemd/system/
useradd -r -s /usr/sbin/nologin mintly
systemctl daemon-reload
systemctl enable --now mintly-signer
curl -s localhost:8899/health
```

Прав у службы ровно ноль: ни повышения, ни доступа к домашним
каталогам. А вот `MemoryDenyWriteExecute` в нём нет намеренно: V8
размечает память под машинный код сам, и с этим запретом Node не
доживает до первой строки — падает с «Fatal javascript OOM during
deserialization», а systemd перезапускает его по кругу.

## Как её видит Vercel

Служба слушает только localhost — открытый порт наружу выставлять
нельзя. Наружу её пускает nginx с TLS, и только по одному пути:

```
server {
  listen 443 ssl;
  server_name signer.example.com;

  # сертификаты от certbot
  ssl_certificate     /etc/letsencrypt/live/signer.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/signer.example.com/privkey.pem;

  location /sign {
    proxy_pass http://127.0.0.1:8899/sign;
    proxy_read_timeout 20s;
  }
}
```

Потом в Vercel → Settings → Environment Variables:

```
SIGNER_URL=https://signer.example.com
SIGNER_TOKEN=<тот же длинный пароль>
```

и **убрать оттуда `APP_WALLET_KEY`** — ради этого всё и затевалось.
Пока `SIGNER_URL` не задан, приложение подписывает своим ключом само:
так работает разработка, и так же оно продолжит работать, если службу
не поднимать.

## Ротация ключа

1. На сервере: `APP_WALLET_KEY=<новый>`, `APP_WALLET_KEY_OLD=<старый>`,
   перезапуск службы.
2. Кошельки, закрытые старым ключом, открываются им и перешифровываются
   текущим при первой же операции — метка ключа хранится в
   `app_wallets.key_id`.
3. Когда в базе не осталось строк со старой меткой
   (`select count(*) from app_wallets where key_id is distinct from '<метка>'`),
   `APP_WALLET_KEY_OLD` можно убрать.
