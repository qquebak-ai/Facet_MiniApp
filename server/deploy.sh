#!/usr/bin/env bash
# Обновление API на сервере: забрать код, доставить зависимости,
# перезапустить службу. Запускать от root: sudo /srv/mintly/server/deploy.sh
#
# Служба перезапускается только после успешной установки: иначе на
# полуобновлённом каталоге она поднялась бы и упала, а старая версия к
# тому моменту уже была бы остановлена.

set -euo pipefail

# Имена латиницей: кириллические переменные bash не принимает.
DIR=${DIR:-/srv/mintly}
USR=${USR:-mintly}

echo "== код =="
sudo -u "$USR" git -C "$DIR" fetch --quiet origin main
sudo -u "$USR" git -C "$DIR" reset --hard --quiet origin/main
sudo -u "$USR" git -C "$DIR" log -1 --oneline

echo "== зависимости =="
sudo -u "$USR" env HOME="$DIR" npm --prefix "$DIR" ci --omit=dev --no-audit --no-fund

echo "== перезапуск =="
systemctl restart mintly-api
sleep 2
systemctl --no-pager --lines=0 status mintly-api

echo "== проверка =="
curl -fsS localhost:8080/health && echo
