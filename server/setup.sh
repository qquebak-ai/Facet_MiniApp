#!/usr/bin/env bash
# Установка API на чистый сервер. Запускать от root:
#
#   curl -fsSL https://raw.githubusercontent.com/qquebak-ai/Facet_MiniApp/main/server/setup.sh | sudo bash
#
# Скрипт можно запускать повторно: он доводит до нужного состояния, а не
# ломается на том, что уже сделано. Первый запуск заканчивается просьбой
# заполнить ключи — служба не поднимается вслепую, чтобы не крутиться в
# перезапусках с пустой базой.
#
# Имена переменных латиницей намеренно: кириллические bash не принимает и
# считает такую строку командой, а не присваиванием.

set -euo pipefail

DIR=/srv/mintly
USR=mintly
REPO=https://github.com/qquebak-ai/Facet_MiniApp.git

step() { printf "\n== %s ==\n" "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "Нужен root: запусти через sudo"; exit 1; }

# Оборванная ссылка от неудачной прошлой попытки роняет проверку nginx,
# а с ней и установку пакетов, и выпуск сертификата. Убираем сразу.
if [ -L /etc/nginx/sites-enabled/mintly-api ] && [ ! -e /etc/nginx/sites-enabled/mintly-api ]; then
  rm -f /etc/nginx/sites-enabled/mintly-api
  echo "убрал оборванную ссылку nginx от прошлой попытки"
fi

step "Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates nginx >/dev/null
if ! command -v node >/dev/null || [ "$(node -v | sed 's/^v\([0-9]*\).*/\1/')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "node $(node -v)"

step "Пользователь и каталог"
# Без домашнего каталога-скелета: useradd -m кладёт в него свои файлы, и
# git отказывается клонировать в непустое место — на этом установка и
# спотыкалась.
id "$USR" >/dev/null 2>&1 || useradd -r -s /bin/bash -d "$DIR" "$USR"
mkdir -p "$DIR"
chown "$USR:$USR" "$DIR"

step "Код"
if [ -d "$DIR/.git" ]; then
  sudo -u "$USR" git -C "$DIR" fetch --quiet origin main
  sudo -u "$USR" git -C "$DIR" reset --hard --quiet origin/main
else
  # Клонируем рядом и переносим внутрь: каталог уже существует и может
  # быть не пуст, а git такое не любит.
  TMP=$(mktemp -d)
  git clone --quiet --depth 50 "$REPO" "$TMP/code"
  shopt -s dotglob
  mv "$TMP/code"/* "$DIR"/
  shopt -u dotglob
  rm -rf "$TMP"
  chown -R "$USR:$USR" "$DIR"
fi
sudo -u "$USR" git -C "$DIR" log -1 --oneline

step "Зависимости"
# HOME задаём явно: без него npm ищет кеш в /home/mintly, которого нет.
sudo -u "$USR" env HOME="$DIR" npm --prefix "$DIR" ci --omit=dev --no-audit --no-fund

step "Переменные"
if [ ! -f "$DIR/.env.server" ]; then
  cat > "$DIR/.env.server" <<'EOF'
PORT=8080
SUPABASE_URL=https://rinxzaakkhxdbhjghtwa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
APP_URL=https://mintly.company
ALLOW_ORIGINS=https://mintly.company,https://www.mintly.company
FEED_INTERVAL_MS=10000
EOF
  chown "$USR:$USR" "$DIR/.env.server"
  chmod 600 "$DIR/.env.server"
  echo "создан $DIR/.env.server — ключи пока пустые"
else
  echo "$DIR/.env.server уже есть, не трогаю"
fi

step "Служба и вход"
cp "$DIR/server/mintly-api.service" /etc/systemd/system/
systemctl daemon-reload
cp "$DIR/server/nginx.conf" /etc/nginx/sites-available/mintly-api
ln -sf /etc/nginx/sites-available/mintly-api /etc/nginx/sites-enabled/mintly-api
nginx -t && systemctl reload nginx

# Служба поднимается, только когда есть чем ходить в базу: без ключа она
# просто крутилась бы в перезапусках, и это выглядело бы поломкой.
if grep -q "^SUPABASE_SERVICE_ROLE_KEY=.\+" "$DIR/.env.server"; then
  systemctl enable --now mintly-api
  sleep 2
  systemctl --no-pager --lines=0 status mintly-api || true
  echo
  curl -fsS localhost:8080/health && echo
  echo "Готово. Дальше: A-запись api → IP сервера, потом certbot --nginx -d api.mintly.company"
else
  cat <<'EOF'

Осталось заполнить ключи:

  nano /srv/mintly/.env.server

  SUPABASE_SERVICE_ROLE_KEY — Supabase → Project Settings → API → service_role
  CRON_SECRET               — то же значение, что в переменных Vercel

Потом запусти этот же скрипт ещё раз — он поднимет службу.
EOF
fi
