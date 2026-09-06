#!/usr/bin/env bash
# Установка API на чистый сервер. Запускать от root:
#
#   curl -fsSL https://raw.githubusercontent.com/qquebak-ai/Facet_MiniApp/main/server/setup.sh | sudo bash
#
# Скрипт можно запускать повторно: он доводит до нужного состояния, а не
# ломается на том, что уже сделано. Первый запуск заканчивается просьбой
# заполнить ключи — служба не поднимается вслепую, чтобы не крутиться в
# перезапусках с пустой базой.

set -euo pipefail

КАТАЛОГ=/srv/mintly
ПОЛЬЗ=mintly
РЕПО=https://github.com/qquebak-ai/Facet_MiniApp.git

шаг() { printf "\n== %s ==\n" "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "Нужен root: запусти через sudo"; exit 1; }

шаг "Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates nginx >/dev/null
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "node $(node -v), nginx $(nginx -v 2>&1 | awk '{print $3}')"

шаг "Пользователь и каталог"
# Без домашнего каталога-скелета: useradd -m кладёт в него свои файлы, и
# git отказывается клонировать в непустое место — на этом установка и
# спотыкалась.
id "$ПОЛЬЗ" >/dev/null 2>&1 || useradd -r -s /bin/bash -d "$КАТАЛОГ" "$ПОЛЬЗ"
mkdir -p "$КАТАЛОГ"
chown "$ПОЛЬЗ:$ПОЛЬЗ" "$КАТАЛОГ"

шаг "Код"
if [ -d "$КАТАЛОГ/.git" ]; then
  sudo -u "$ПОЛЬЗ" git -C "$КАТАЛОГ" fetch --quiet origin main
  sudo -u "$ПОЛЬЗ" git -C "$КАТАЛОГ" reset --hard --quiet origin/main
else
  # Клонируем рядом и переносим внутрь: каталог уже существует и может
  # быть не пуст, а git такое не любит.
  ВРЕМ=$(mktemp -d)
  git clone --quiet --depth 50 "$РЕПО" "$ВРЕМ/код"
  shopt -s dotglob
  mv "$ВРЕМ/код"/* "$КАТАЛОГ"/
  shopt -u dotglob
  rm -rf "$ВРЕМ"
  chown -R "$ПОЛЬЗ:$ПОЛЬЗ" "$КАТАЛОГ"
fi
sudo -u "$ПОЛЬЗ" git -C "$КАТАЛОГ" log -1 --oneline

шаг "Зависимости"
# HOME задаём явно: без него npm ищет кеш в /home/mintly, которого нет.
sudo -u "$ПОЛЬЗ" env HOME="$КАТАЛОГ" npm --prefix "$КАТАЛОГ" ci --omit=dev --no-audit --no-fund

шаг "Переменные"
if [ ! -f "$КАТАЛОГ/.env.server" ]; then
  install -o "$ПОЛЬЗ" -g "$ПОЛЬЗ" -m 600 /dev/null "$КАТАЛОГ/.env.server"
  cat > "$КАТАЛОГ/.env.server" <<'КОНЕЦ'
PORT=8080
SUPABASE_URL=https://rinxzaakkhxdbhjghtwa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
APP_URL=https://mintly.company
ALLOW_ORIGINS=https://mintly.company,https://www.mintly.company
FEED_INTERVAL_MS=10000
КОНЕЦ
  chown "$ПОЛЬЗ:$ПОЛЬЗ" "$КАТАЛОГ/.env.server"
  chmod 600 "$КАТАЛОГ/.env.server"
  echo "создан $КАТАЛОГ/.env.server — ключи пока пустые"
else
  echo "$КАТАЛОГ/.env.server уже есть, не трогаю"
fi

шаг "Служба и вход"
cp "$КАТАЛОГ/server/mintly-api.service" /etc/systemd/system/
systemctl daemon-reload
cp "$КАТАЛОГ/server/nginx.conf" /etc/nginx/sites-available/mintly-api
ln -sf /etc/nginx/sites-available/mintly-api /etc/nginx/sites-enabled/mintly-api
nginx -t && systemctl reload nginx

# Служба поднимается, только когда есть чем ходить в базу: без ключа она
# просто крутилась бы в перезапусках, и это выглядело бы поломкой.
if grep -q "^SUPABASE_SERVICE_ROLE_KEY=.\+" "$КАТАЛОГ/.env.server"; then
  systemctl enable --now mintly-api
  sleep 2
  systemctl --no-pager --lines=0 status mintly-api || true
  echo
  curl -fsS localhost:8080/health && echo
  echo "Готово. Дальше: A-запись api → IP сервера, потом certbot --nginx -d api.mintly.company"
else
  cat <<'КОНЕЦ'

Осталось заполнить ключи:

  nano /srv/mintly/.env.server

  SUPABASE_SERVICE_ROLE_KEY — Supabase → Project Settings → API → service_role
  CRON_SECRET               — то же значение, что в переменных Vercel

Потом запусти этот же скрипт ещё раз — он поднимет службу.
КОНЕЦ
fi
