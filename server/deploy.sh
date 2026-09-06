#!/usr/bin/env bash
# Обновление API на сервере: забрать код, доставить зависимости,
# перезапустить службу. Запускать от root: sudo /srv/mintly/server/deploy.sh
#
# Служба перезапускается только после успешной установки: иначе на
# полуобновлённом каталоге она поднялась бы и упала, а старая версия к
# тому моменту уже была бы остановлена.

set -euo pipefail

КАТАЛОГ=${КАТАЛОГ:-/srv/mintly}
ПОЛЬЗ=${ПОЛЬЗ:-mintly}

echo "== код =="
sudo -u "$ПОЛЬЗ" git -C "$КАТАЛОГ" fetch --quiet origin main
sudo -u "$ПОЛЬЗ" git -C "$КАТАЛОГ" reset --hard --quiet origin/main
sudo -u "$ПОЛЬЗ" git -C "$КАТАЛОГ" log -1 --oneline

echo "== зависимости =="
sudo -u "$ПОЛЬЗ" npm --prefix "$КАТАЛОГ" ci --omit=dev --no-audit --no-fund

echo "== перезапуск =="
systemctl restart mintly-api
sleep 2
systemctl --no-pager --lines=0 status mintly-api

echo "== проверка =="
curl -fsS localhost:8080/health && echo
