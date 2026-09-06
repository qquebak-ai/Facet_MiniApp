# API на своём сервере

Сайт остаётся на CDN — там он быстрее любого одиночного сервера. Сюда
переезжает то, чему постоянный процесс действительно нужен: обработчики
`api/*.js`, их кеш и обход биржевых лент.

Что это даёт против текущего Vercel:

| | было | стало |
|---|---|---|
| холодный старт | 1,3 с | нет |
| свечи из кеша | 0,3 с | 20–40 мс |
| обход ленты | раз в минуту, чужим планировщиком | свой цикл, шаг задаётся переменной |
| число обработчиков | 12 (лимит тарифа) | сколько нужно |

---

## Установка одной командой

Ubuntu 22.04/24.04, 2 ядра, 2–4 ГБ.

```bash
curl -fsSL https://raw.githubusercontent.com/qquebak-ai/Facet_MiniApp/main/server/setup.sh | sudo bash
```

Скрипт ставит node, nginx и git, заводит пользователя, забирает код,
кладёт службу и вход nginx. Первый запуск заканчивается просьбой
заполнить ключи; заполнив, запусти его ещё раз — он поднимет службу.
Повторный запуск безопасен: скрипт доводит до нужного состояния, а не
делает всё заново.

Ниже — то же самое по шагам, если хочется руками.

## Что нужно на сервере

Node 22, nginx, git.

```bash
sudo apt update
sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v            # должно быть v22.x
```

## Учётная запись и код

Каталог создаётся пустым намеренно: `useradd -m` положил бы в него свои
файлы, а `git clone` в непустой каталог не идёт.

```bash
sudo useradd -r -s /bin/bash -d /srv/mintly mintly
sudo mkdir -p /srv/mintly && sudo chown mintly:mintly /srv/mintly
sudo -u mintly git clone https://github.com/qquebak-ai/Facet_MiniApp.git /tmp/mintly-код
sudo -u mintly bash -c 'shopt -s dotglob; mv /tmp/mintly-код/* /srv/mintly/'
# HOME задаём явно: иначе npm ищет кеш в /home/mintly, которого нет.
sudo -u mintly env HOME=/srv/mintly npm --prefix /srv/mintly ci --omit=dev
```

## Переменные окружения

Файл `/srv/mintly/.env.server`, права `600` — в нём служебный ключ базы и
токен бота.

```bash
sudo -u mintly tee /srv/mintly/.env.server >/dev/null <<'КОНЕЦ'
PORT=8080
SUPABASE_URL=https://rinxzaakkhxdbhjghtwa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role из Supabase → Project Settings → API>
CRON_SECRET=<то же значение, что в переменных Vercel>
APP_URL=https://mintly.company
ALLOW_ORIGINS=https://mintly.company,https://www.mintly.company
FEED_INTERVAL_MS=10000
TELEGRAM_BOT_TOKEN=<токен бота>
TELEGRAM_WEBHOOK_SECRET=<секрет вебхука>
TONCENTER_API_KEY=
TONAPI_KEY=
SOLANA_RPC=
FEE_ADDRESS=
КОНЕЦ
sudo chmod 600 /srv/mintly/.env.server
sudo chown mintly:mintly /srv/mintly/.env.server
```

Остальные переменные (кошелёк приложения, подписант Solana, поддержка)
переносятся из Vercel → Settings → Environment Variables как есть.
Полный список имён — `grep -rho "process\.env\.[A-Z_0-9]*" api/ | sort -u`.

## Служба

```bash
sudo cp /srv/mintly/server/mintly-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mintly-api
systemctl status mintly-api --no-pager
curl -s localhost:8080/health          # {"ok":true,...}
journalctl -u mintly-api -f            # живой журнал
```

## Домен и сертификат

В DNS (там же, где сейчас `mintly.company`) добавить запись:

```
A   api   <IP сервера>
```

Потом:

```bash
sudo cp /srv/mintly/server/nginx.conf /etc/nginx/sites-available/mintly-api
sudo ln -sf /etc/nginx/sites-available/mintly-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.mintly.company
```

Certbot сам допишет блок 443 и продление.

## Переключить сайт на этот API

В Vercel → Settings → Environment Variables добавить:

```
VITE_API_BASE = https://api.mintly.company
```

и передеплоить. Приложение начнёт ходить за свечами, сделками и обходом
сюда. Пустое значение возвращает всё обратно на Vercel — откат в одну
переменную, без правки кода.

## Обновление

```bash
sudo -u mintly git -C /srv/mintly pull
sudo -u mintly npm --prefix /srv/mintly ci --omit=dev
sudo systemctl restart mintly-api
```

Или одной командой: `sudo /srv/mintly/server/deploy.sh`.

## Когда переедет

Оба расписания в GitHub Actions — «Обход ленты» и «Уведомления» — можно
выключить: сервер делает и то и другое своими циклами. Два обходчика
только зря выбирают лимит источника, а уведомления через GitHub ещё и
падали, когда секрет в репозитории расходился с секретом на площадке.

Шаги циклов задаются переменными: `FEED_INTERVAL_MS` (по умолчанию 10 с)
и `NOTIFY_INTERVAL_MS` (10 мин). Выключаются `FEED_LOOP=0` и
`NOTIFY_LOOP=0` — это удобно, если сервер поднимают вторым, рядом с
работающим Vercel.

Уведомлениям нужен `TELEGRAM_BOT_TOKEN` в `.env.server`: без него цикл
просто не запускается.
