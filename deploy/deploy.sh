#!/usr/bin/env bash
# Сборка и выкладка: npm ci → тесты → build → проверка CSP → rsync на сервер → reload общего Caddy.
# Перед выкладкой текущая версия на сервере копируется в site.prev (для отката).
# Переменные — из окружения или deploy/.env.deploy (см. deploy/.env.deploy.example).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f deploy/.env.deploy ]]; then set -a; source deploy/.env.deploy; set +a; fi
: "${DEPLOY_USER:?Укажите DEPLOY_USER (deploy/.env.deploy)}"
: "${DEPLOY_HOST:?Укажите DEPLOY_HOST (deploy/.env.deploy)}"
PORT="${DEPLOY_PORT:-22}"
CADDY="${CADDY_CONTAINER:-ai-project-agent-caddy-1}"
REMOTE="/opt/lossmap"
TARGET="$DEPLOY_USER@$DEPLOY_HOST"
SSH="ssh -p $PORT"

npm ci
npm test
npm run build
node scripts/check-csp.mjs

# Папки, бэкап текущей версии. rsync пишет внутрь существующих папок —
# их нельзя пересоздавать/переименовывать: они смонтированы в контейнер Caddy.
$SSH "$TARGET" "mkdir -p $REMOTE/site $REMOTE/caddy && rsync -a --delete $REMOTE/site/ $REMOTE/site.prev/"
rsync -avz --delete -e "$SSH" dist/ "$TARGET:$REMOTE/site/"
rsync -avz -e "$SSH" deploy/lossmap.caddy "$TARGET:$REMOTE/caddy/lossmap.caddy"

# Применить конфиг. Если он с ошибкой, Caddy откажется и продолжит работать со старым.
$SSH "$TARGET" "docker exec $CADDY caddy reload --config /etc/caddy/Caddyfile"

echo "Готово: https://lossmap.pro"
