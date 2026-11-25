# Деплой lossmap.pro

**Как устроено.** Сайт живёт на том же сервере Hetzner (`2.29.140.100`), что и бот, и отдаётся **тем же Caddy**, который уже обслуживает calc.lossmap.pro. Каждое слияние PR в `main` репозитория LossMap автоматически собирает сайт, прогоняет тесты и выкладывает его на сервер — так же, как деплоится бот.

```
Сервер
/opt/bot/deploy/          бот (репозиторий AI-Project-Agent). Его Caddy подключает папки сайта:
                          /opt/lossmap/site  → /srv/lossmap
                          /opt/lossmap/caddy → /etc/caddy/lossmap  (import в Caddyfile бота)
/opt/lossmap/site/        сайт (кладёт деплой LossMap)
/opt/lossmap/site.prev/   предыдущая версия, для отката
/opt/lossmap/caddy/       lossmap.caddy — правила сайта: домены, CSP, кэш, редиректы
```

## Первый запуск — 4 шага

### 1. DNS в Cloudflare

DNS → Records → Add record. Облако — такое же, как у записи `calc`.

| Тип | Имя | Значение |
|---|---|---|
| A | `@` | `2.29.140.100` |
| A | `www` | `2.29.140.100` |

Если облако оранжевое — SSL/TLS → Overview → режим **Full (strict)**.

### 2. Ключ для деплоя (на сервере)

Отдельный SSH-ключ, которым GitHub будет заходить на сервер:

```bash
ssh-keygen -t ed25519 -N "" -C lossmap-deploy -f /root/.ssh/lossmap_deploy
```

```bash
cat /root/.ssh/lossmap_deploy.pub >> /root/.ssh/authorized_keys
```

```bash
cat /root/.ssh/lossmap_deploy
```

Последняя команда покажет приватный ключ — скопируйте его целиком, от `-----BEGIN` до `-----END ...-----` включительно (нужен на шаге 3).

### 3. Секреты в GitHub (репозиторий LossMap)

GitHub → репозиторий LossMap → Settings → Secrets and variables → Actions → **New repository secret**:

| Name | Secret |
|---|---|
| `SSH_HOST` | `2.29.140.100` |
| `SSH_USER` | `root` |
| `SSH_PRIVATE_KEY` | приватный ключ из шага 2 |

После этого ключ на сервере можно удалить (публичная часть останется в `authorized_keys`):

```bash
rm /root/.ssh/lossmap_deploy
```

### 4. Слить два PR

1. **Бот** (AI-Project-Agent), ветка `lossmap-site-caddy` — подключает папки сайта к Caddy. После слияния CI бота пересоздаст Caddy (calc недоступен несколько секунд). Бот и calc работают как раньше.
2. **LossMap**, ветка `claude/great-galileo-qf9n5e` — сайт. После слияния GitHub Actions соберёт и выложит сайт, Caddy получит сертификаты для lossmap.pro и www (до минуты).

Проверить: https://lossmap.pro, https://www.lossmap.pro (редирект), https://calc.lossmap.pro и бот.

Ход деплоя — GitHub → LossMap → Actions → Deploy. Логи Caddy на сервере:

```bash
cd /opt/bot/deploy && docker compose logs --since 10m caddy | grep -i -E "lossmap|error"
```

## Дальше

Правите тексты в `src/content/ru/*` → PR → слияние в `main` → сайт обновится сам.

Без GitHub, со своего компьютера (нужны Node 22, rsync, ssh-доступ к серверу):

```bash
cp deploy/.env.deploy.example deploy/.env.deploy
./deploy/deploy.sh
```

Если в `lossmap.caddy` ошибка, Caddy её не примет и продолжит работать со старым конфигом — бот и calc не пострадают; деплой в Actions упадёт с ошибкой.

## Откат

Быстро — предыдущая версия (папку `site/` не переименовывать: она смонтирована в контейнер, только копировать поверх):

```bash
ssh root@2.29.140.100 'rsync -a --delete /opt/lossmap/site.prev/ /opt/lossmap/site/'
```

Или `git revert` неудачного коммита в `main` — деплой выложит исправленную версию.

Отключить сайт целиком (бот не затрагивается):

```bash
rm /opt/lossmap/caddy/lossmap.caddy && docker exec ai-project-agent-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## Если не работает

- Сертификат не выдаётся — `dig +short lossmap.pro` должен вернуть `2.29.140.100`; при оранжевом облаке попробуйте временно серое.
- Бесконечный редирект при оранжевом облаке — режим SSL/TLS Flexible; нужен Full (strict).
- Ошибка CSP в консоли браузера — `node scripts/check-csp.mjs` подскажет хэш для `deploy/lossmap.caddy`.
- Деплой в Actions пропущен с пометкой «секреты не заданы» — шаг 3.

## Umami (статистика) — позже, отдельным шагом

На сервере ~2 ГБ свободной памяти без swap, рядом бот с Postgres. Umami + PostgreSQL ограничены 768 МБ (`mem_limit`), запускать — когда сайт уже работает.

1. DNS: A `stats` → `2.29.140.100`.
2. На сервере:
   ```bash
   mkdir -p /opt/lossmap/umami && docker network ls | grep ai-project-agent
   ```
   Имя сети бота (обычно `ai-project-agent_default`) — в `SHARED_NETWORK`.
3. С компьютера:
   ```bash
   scp deploy/umami/docker-compose.yml deploy/umami/.env.example root@2.29.140.100:/opt/lossmap/umami/
   ```
4. На сервере: `cd /opt/lossmap/umami && cp .env.example .env && nano .env` (секреты — `openssl rand -hex 32`), затем:
   ```bash
   docker compose up -d
   ```
5. Конфиг stats.lossmap.pro:
   ```bash
   scp deploy/umami/stats.caddy root@2.29.140.100:/opt/lossmap/caddy/
   ```
   ```bash
   ssh root@2.29.140.100 'docker exec ai-project-agent-caddy-1 caddy reload --config /etc/caddy/Caddyfile'
   ```
6. https://stats.lossmap.pro — вход `admin` / `umami`, **сразу сменить пароль**. Settings → Websites → Add: `lossmap.pro`, скопировать Website ID.
7. В `src/content/ru/site.json`: `"umamiSrc": "https://stats.lossmap.pro/script.js"`, `"umamiWebsiteId": "<ID>"` → PR → слияние. CSP уже разрешает stats.lossmap.pro.
8. Закрепить версию: `docker compose images umami` → тег вместо `postgresql-latest`.
