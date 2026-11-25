# Деплой lossmap.pro

Сервер Hetzner `2.29.140.100`. Порты 80/443 занимает Caddy проекта бота (`ai-project-agent-caddy-1`, конфиг — `/opt/bot/deploy/`). Сайт LossMap подключается к **этому же Caddy**, второй Caddy не ставим.

```
/opt/bot/deploy/                 проект бота (репозиторий AI-Project-Agent, деплой через его CI)
├─ docker-compose.yml            + 2 строки volumes у caddy (шаг 5)
└─ Caddyfile                     + 1 строка import (шаг 5)

/opt/lossmap/                    наш сайт
├─ site/                         собранный сайт → в контейнере /srv/lossmap
├─ site.prev/                    предыдущая версия (для отката)
└─ caddy/lossmap.caddy           блоки lossmap.pro → в контейнере /etc/caddy/lossmap/
```

Все правила сайта (CSP, кэш, редиректы) живут в нашем репозитории (`deploy/lossmap.caddy`) и выкладываются `deploy.sh`. В файлы бота вносится только подключение — один раз.

## Шаг 1. Папки на сервере (один раз)

```bash
mkdir -p /opt/lossmap/site /opt/lossmap/caddy
```

## Шаг 2. DNS в Cloudflare

Новые записи — так же, как у `calc` (облако оранжевое или серое). Если оранжевое, в SSL/TLS режим **Full (strict)**.

| Тип | Имя | Значение |
|---|---|---|
| A | `@` (lossmap.pro) | `2.29.140.100` |
| A | `www` | `2.29.140.100` |
| AAAA | `@`, `www` | `2a01:4f9:c014:e66c::1` — только если AAAA есть у `calc` |

## Шаг 3. Выложить сайт (с вашего компьютера)

Нужны Node 22, rsync, ssh. В корне репозитория LossMap:

```bash
cp deploy/.env.deploy.example deploy/.env.deploy
./deploy/deploy.sh
```

Сайт ляжет в `/opt/lossmap/site/`, конфиг — в `/opt/lossmap/caddy/`. Caddy бота их пока не видит — это нормально.

## Шаг 4. Проверить конфиг заранее (на сервере)

Временный Caddy с будущим конфигом; работающий не трогается:

```bash
cp /opt/bot/deploy/Caddyfile /tmp/Caddyfile.test && echo 'import /etc/caddy/lossmap/*.caddy' >> /tmp/Caddyfile.test
docker run --rm --env-file /opt/bot/.env -v /tmp/Caddyfile.test:/etc/caddy/Caddyfile:ro -v /opt/lossmap/caddy:/etc/caddy/lossmap:ro caddy:2.11-alpine caddy validate --config /etc/caddy/Caddyfile
```

Должно быть `Valid configuration`.

## Шаг 5. Подключить в репозитории бота (AI-Project-Agent)

Правки — в репозитории бота, не на сервере: сервер обновляется из GitHub, ручные правки сотрёт следующий деплой бота.

`deploy/docker-compose.yml`, сервис `caddy` → `volumes:` (две последние строки — новые):

```yaml
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
      - /opt/lossmap/site:/srv/lossmap:ro
      - /opt/lossmap/caddy:/etc/caddy/lossmap:ro
```

`deploy/Caddyfile` — в самый конец:

```
# Сайт lossmap.pro (репозиторий LossMap): конфиг и файлы кладёт его deploy.sh в /opt/lossmap/
import /etc/caddy/lossmap/*.caddy
```

Commit → push в ветку, с которой деплоит CI бота. CI пересоздаст Caddy (перерыв для calc — несколько секунд) и Caddy получит сертификаты для lossmap.pro и www. Логи:

```bash
cd /opt/bot/deploy && docker compose logs -f --since 5m caddy
```

Ждать `certificate obtained successfully` для `lossmap.pro` и `www.lossmap.pro`.

## Шаг 6. Проверить

- https://lossmap.pro — сайт;
- https://www.lossmap.pro — редирект на lossmap.pro;
- https://lossmap.pro/privacy и https://lossmap.pro/нет-такой — политика и страница 404;
- https://calc.lossmap.pro и бот — работают как раньше.

## Если что-то пошло не так

Откатить коммит в репозитории бота (git revert) и дать CI задеплоить. Бот и calc от сайта не зависят: пустая папка `/opt/lossmap/caddy` ничего не ломает.

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
