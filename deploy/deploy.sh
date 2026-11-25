#!/usr/bin/env bash
# Сборка и выкладка сайта: npm ci → build → проверки → rsync dist/ на сервер.
# Перед выкладкой текущая версия на сервере копируется в site.prev (для отката).
# Переменные: DEPLOY_USER, DEPLOY_HOST, DEPLOY_PORT — из окружения или deploy/.env.deploy.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f deploy/.env.deploy ]]; then set -a; source deploy/.env.deploy; set +a; fi
: "${DEPLOY_USER:?Укажите DEPLOY_USER (deploy/.env.deploy)}"
: "${DEPLOY_HOST:?Укажите DEPLOY_HOST (deploy/.env.deploy)}"
PORT="${DEPLOY_PORT:-22}"
REMOTE="/opt/lossmap"
SSH="ssh -p $PORT"

npm ci
npm test
npm run build
node scripts/check-csp.mjs

$SSH "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p $REMOTE/site && rm -rf $REMOTE/site.prev && cp -a $REMOTE/site $REMOTE/site.prev"
rsync -avz --delete -e "$SSH" dist/ "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE/site/"

echo "Готово: https://lossmap.pro"
