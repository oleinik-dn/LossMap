# Деплой lossmap.pro

Сервер Hetzner `2.29.140.100`. Порты 80/443 занимает Caddy проекта бота (`ai-project-agent-caddy-1`, конфиг — `/opt/bot/deploy/`). Сайт LossMap подключается к **этому же Caddy**, второй Caddy не ставим.

```
/opt/bot/deploy/                 проект бота (не наш)
├─ docker-compose.yml            + 2 строки volumes у caddy (шаг 2)
└─ Caddyfile                     + 1 строка import (шаг 2)

/opt/lossmap/                    наш сайт
├─ site/                         собранный сайт → в контейнере /srv/lossmap
├─ site.prev/                    предыдущая версия (для отката)
└─ caddy/lossmap.caddy           блоки lossmap.pro → в контейнере /etc/caddy/lossmap/
```

Все правила сайта (CSP, кэш, редиректы) живут в нашем репозитории (`deploy/lossmap.caddy`) и выкладываются `deploy.sh`. В файлы бота вносится только подключение — один раз.

## Шаг 1. Проверки на сервере

```bash
cd /opt/bot && git status --short && git remote -v
```

Если `/opt/bot` — git-репозиторий и бот обновляется через `git pull` или CI, правки шага 2 нужно **внести в репозиторий бота** (`deploy/docker-compose.yml` и `deploy/Caddyfile`), иначе следующий деплой бота их сотрёт.

```bash
grep -n "lossmap" /opt/bot/deploy/Caddyfile
```

Должен найтись только `calc.lossmap.pro`. Если там уже есть блок `lossmap.pro` или `www.lossmap.pro` — сначала удалить его, иначе Caddy не примет конфиг.

## Шаг 2. Подключить сайт к Caddy бота (один раз)

1. Папки:
   ```bash
   mkdir -p /opt/lossmap/site /opt/lossmap/caddy
   ```
2. Бэкап файлов бота:
   ```bash
   cp /opt/bot/deploy/docker-compose.yml /opt/bot/deploy/docker-compose.yml.bak
   ```
   ```bash
   cp /opt/bot/deploy/Caddyfile /opt/bot/deploy/Caddyfile.bak
   ```
3. В `/opt/bot/deploy/docker-compose.yml`, сервис `caddy`, в список `volumes:` добавить две строки:
   ```yaml
         - /opt/lossmap/site:/srv/lossmap:ro
         - /opt/lossmap/caddy:/etc/caddy/lossmap:ro
   ```
4. В **конец** `/opt/bot/deploy/Caddyfile` добавить строку:
   ```
   import /etc/caddy/lossmap/*.caddy
   ```
5. Проверить compose:
   ```bash
   cd /opt/bot/deploy && docker compose config --quiet && echo ok
   ```

Пересоздавать Caddy пока не нужно — сначала выложим сайт (шаг 4), чтобы проверить конфиг целиком до переключения.

## Шаг 3. DNS в Cloudflare

Посмотрите, как сделана запись `calc` (облако оранжевое или серое) — новые сделайте так же. Если оранжевое, в SSL/TLS должен быть режим **Full (strict)**.

| Тип | Имя | Значение |
|---|---|---|
| A | `@` (lossmap.pro) | `2.29.140.100` |
| A | `www` | `2.29.140.100` |
| AAAA | `@` | `2a01:4f9:c014:e66c::1` |
| AAAA | `www` | `2a01:4f9:c014:e66c::1` |

AAAA добавляйте, только если для `calc` она тоже есть (и `calc` работает по IPv6). Проверка через пару минут:

```bash
dig +short lossmap.pro
```

## Шаг 4. Первая выкладка (с вашего компьютера)

Нужны Node 22, rsync, ssh. В корне репозитория:

```bash
cp deploy/.env.deploy.example deploy/.env.deploy
```

Значения там уже под ваш сервер (`root@2.29.140.100`). Затем:

```bash
./deploy/deploy.sh
```

Скрипт соберёт сайт, выложит его в `/opt/lossmap/site/`, конфиг — в `/opt/lossmap/caddy/`, и сделает `caddy reload`. На первом запуске reload ничего не изменит (Caddy ещё не видит наши папки) — это нормально.

## Шаг 5. Включить (на сервере)

1. Проверить полный конфиг **во временном контейнере** — работающий Caddy не трогается:
   ```bash
   cd /opt/bot/deploy && docker compose run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile
   ```
   Должно быть `Valid configuration`. Если ошибка — исправить, бот и калькулятор пока работают как раньше.
2. Пересоздать только Caddy (перерыв для бота-web и calc — несколько секунд):
   ```bash
   docker compose up -d --no-deps caddy
   ```
3. Смотреть, как выдаются сертификаты:
   ```bash
   docker compose logs -f --since 2m caddy
   ```
   Ждать `certificate obtained successfully` для `lossmap.pro` и `www.lossmap.pro`. Выход — Ctrl+C.

## Шаг 6. Проверить

- https://lossmap.pro — сайт;
- https://www.lossmap.pro — редирект на lossmap.pro;
- https://lossmap.pro/privacy и https://lossmap.pro/нет-такой — политика и страница 404;
- https://calc.lossmap.pro и бот — работают как раньше.

## Если что-то пошло не так

Вернуть Caddy бота в исходное состояние:

```bash
cd /opt/bot/deploy && cp Caddyfile.bak Caddyfile && cp docker-compose.yml.bak docker-compose.yml && docker compose up -d --no-deps caddy
```

- Нет сертификата — `dig` должен показывать IP сервера; если облако оранжевое, временно сделайте серым.
- Бесконечный редирект при оранжевом облаке — режим SSL/TLS не Flexible, а Full (strict).
- Сайт открылся, но скрипты не работают (ошибка CSP в консоли) — `node scripts/check-csp.mjs` подскажет хэш для `deploy/lossmap.caddy`.

## Обновление сайта

```bash
./deploy/deploy.sh
```

Перезапускать ничего не нужно: файлы обновятся, конфиг применится через `caddy reload`. Если в `lossmap.caddy` ошибка, Caddy откажется её применять и продолжит работать со старым конфигом — бот и калькулятор не пострадают.

### Через GitHub Actions (по желанию)

Workflow `.github/workflows/deploy.yml` выключен. Чтобы включить:

1. Отдельный SSH-ключ: `ssh-keygen -t ed25519 -f lossmap-deploy`, публичную часть — в `~/.ssh/authorized_keys` на сервере.
2. GitHub → Settings → Secrets and variables → Actions:
   - Secrets: `DEPLOY_SSH_KEY` (приватный ключ), `DEPLOY_KNOWN_HOSTS` (вывод `ssh-keyscan 2.29.140.100`), `DEPLOY_USER`, `DEPLOY_HOST`;
   - Variables: `DEPLOY_ENABLED` = `true`.
3. Actions → Deploy → Run workflow.

## Откат

На предыдущую версию (одна ступень назад). Папку `site/` не переименовывать — она смонтирована в контейнер; только копировать поверх:

```bash
ssh root@2.29.140.100 'rsync -a --delete /opt/lossmap/site.prev/ /opt/lossmap/site/'
```

На любую версию из git:

```bash
git checkout <коммит или тег>
./deploy/deploy.sh
git checkout -
```

## Umami — позже, отдельным шагом

На сервере ~2 ГБ свободной памяти без swap, рядом бот с Postgres. Umami + PostgreSQL ограничены 768 МБ (`mem_limit`), но запускать их стоит, когда сайт уже работает.

1. DNS: A (и AAAA) `stats` → тот же IP.
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
5. С компьютера — конфиг для stats.lossmap.pro:
   ```bash
   scp deploy/umami/stats.caddy root@2.29.140.100:/opt/lossmap/caddy/
   ```
   ```bash
   ssh root@2.29.140.100 'docker exec ai-project-agent-caddy-1 caddy reload --config /etc/caddy/Caddyfile'
   ```
6. https://stats.lossmap.pro — вход `admin` / `umami`, **сразу сменить пароль**. Settings → Websites → Add: `lossmap.pro`, скопировать Website ID.
7. В `src/content/ru/site.json`: `"umamiSrc": "https://stats.lossmap.pro/script.js"`, `"umamiWebsiteId": "<ID>"` → `./deploy/deploy.sh`. CSP уже разрешает stats.lossmap.pro.
8. Закрепить версию: `docker compose images umami` → тег вместо `postgresql-latest`.

Бэкап статистики:

```bash
docker exec lossmap-umami-db pg_dump -U umami umami | gzip > umami-$(date +%F).sql.gz
```
