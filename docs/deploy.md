# Деплой lossmap.pro

Схема: сайт собирается локально (или в GitHub Actions) и копируется по `rsync` на сервер. На сервере в Docker работают Caddy (сайт + HTTPS) и Umami (статистика без cookies) с PostgreSQL.

```
/opt/lossmap/
├─ docker-compose.yml   ← deploy/docker-compose.yml
├─ Caddyfile            ← deploy/Caddyfile
├─ .env                 ← из deploy/.env.example, с вашими значениями
├─ site/                ← текущая версия сайта (кладёт deploy.sh)
└─ site.prev/           ← предыдущая версия (для отката)
```

## 1. Подготовка сервера (один раз)

Нужен VPS в Европе с Ubuntu 24.04, 1 vCPU / 1–2 ГБ RAM достаточно.

1. Установите Docker по официальной инструкции: https://docs.docker.com/engine/install/ubuntu/
2. Создайте пользователя для деплоя (под root):
   ```bash
   adduser --disabled-password --gecos "" deploy
   usermod -aG docker deploy
   mkdir -p /home/deploy/.ssh && nano /home/deploy/.ssh/authorized_keys   # вставьте свой публичный SSH-ключ
   chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
   ```
3. Firewall — открыть только SSH, 80 и 443:
   ```bash
   ufw allow OpenSSH
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow 443/udp
   ufw enable
   ```
4. Отключите вход по паролю: в `/etc/ssh/sshd_config` — `PasswordAuthentication no`, затем `systemctl restart ssh`.
5. Папка проекта:
   ```bash
   mkdir -p /opt/lossmap/site && chown -R deploy:deploy /opt/lossmap
   ```

## 2. DNS в Cloudflare

В панели Cloudflare → домен lossmap.pro → DNS → Records:

| Тип | Имя | Значение | Proxy |
|---|---|---|---|
| A | `lossmap.pro` (`@`) | IPv4 сервера | DNS only (серое облако) |
| A | `www` | IPv4 сервера | DNS only |
| A | `stats` | IPv4 сервера | DNS only |
| AAAA | те же три имени | IPv6 сервера, если есть | DNS only |

На первом запуске оставьте «DNS only», чтобы Caddy спокойно получил сертификаты. Потом проксирование можно включить (оранжевое облако) — тогда в SSL/TLS обязательно режим **Full (strict)**.

Проверка: `dig +short lossmap.pro` должен вернуть IP сервера.

## 3. Первый запуск

С вашего компьютера, из корня репозитория:

```bash
scp deploy/docker-compose.yml deploy/Caddyfile deploy@SERVER:/opt/lossmap/
scp deploy/.env.example deploy@SERVER:/opt/lossmap/.env
```

На сервере заполните `.env`:

```bash
cd /opt/lossmap
nano .env    # ACME_EMAIL; UMAMI_DB_PASSWORD и UMAMI_APP_SECRET — из `openssl rand -hex 32`
chmod 600 .env
```

Выложите сайт (локально, см. раздел 4), затем на сервере:

```bash
cd /opt/lossmap && docker compose up -d
docker compose logs -f caddy    # дождаться «certificate obtained successfully»
```

Проверьте: https://lossmap.pro, https://www.lossmap.pro (редирект), https://stats.lossmap.pro (вход в Umami).

## 4. Обновление сайта

Локально, один раз: `cp deploy/.env.deploy.example deploy/.env.deploy` и впишите `DEPLOY_USER=deploy`, `DEPLOY_HOST=<IP или имя сервера>`.

Каждый релиз:

```bash
./deploy/deploy.sh
```

Скрипт: `npm ci` → тесты → сборка → проверка CSP → копия текущей версии в `site.prev` → `rsync` новой версии в `site/`. Перезапускать Caddy не нужно.

Если менялись `Caddyfile` или `docker-compose.yml` — скопируйте их на сервер и выполните `docker compose up -d` (для Caddyfile достаточно `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`).

### Через GitHub Actions (по желанию)

Workflow `.github/workflows/deploy.yml` выключен. Чтобы включить:

1. Создайте отдельный SSH-ключ для деплоя (`ssh-keygen -t ed25519 -f lossmap-deploy`), публичную часть добавьте в `authorized_keys` пользователя deploy.
2. GitHub → Settings → Secrets and variables → Actions:
   - Secrets: `DEPLOY_SSH_KEY` (приватный ключ), `DEPLOY_KNOWN_HOSTS` (вывод `ssh-keyscan SERVER`), `DEPLOY_USER`, `DEPLOY_HOST`;
   - Variables: `DEPLOY_ENABLED` = `true`, при нестандартном порте — `DEPLOY_PORT`.
3. Actions → Deploy → Run workflow.

## 5. Откат

Быстро — вернуть предыдущую версию (одна ступень назад). Папку `site/` не переименовывайте: она смонтирована в контейнер, Caddy продолжит отдавать старую. Только копировать поверх:

```bash
ssh deploy@SERVER 'rsync -a --delete /opt/lossmap/site.prev/ /opt/lossmap/site/'
```

На любую версию — пересобрать из git:

```bash
git checkout <коммит или тег>
./deploy/deploy.sh
git checkout -
```

## 6. Umami: подключить статистику

1. Откройте https://stats.lossmap.pro, войдите (по умолчанию `admin` / `umami`) и **сразу смените пароль**.
2. Settings → Websites → Add website: имя LossMap, домен `lossmap.pro`. Скопируйте Website ID.
3. В `src/content/ru/site.json`:
   ```json
   "analytics": {
     "umamiSrc": "https://stats.lossmap.pro/script.js",
     "umamiWebsiteId": "<Website ID>"
   }
   ```
4. Выложите сайт (`./deploy/deploy.sh`). CSP в Caddyfile уже разрешает `stats.lossmap.pro`.
5. Закрепите версию Umami: `docker compose images umami` → подставьте тег вместо `postgresql-latest` в `docker-compose.yml`.

UTM-метки Umami показывает сам (раздел UTM у сайта). Cookies Umami не ставит — баннер не нужен.

## 7. Резервная копия статистики

```bash
docker compose exec -T umami-db pg_dump -U umami umami | gzip > umami-$(date +%F).sql.gz
```

Сайт бэкапить не нужно: он целиком собирается из git.

## Если что-то не работает

- Нет сертификата — проверьте DNS (`dig`), открыты ли 80/443, логи: `docker compose logs caddy`.
- После включения прокси Cloudflare — бесконечный редирект: режим SSL/TLS должен быть Full (strict), не Flexible.
- Сайт открылся, но скрипты не работают — в консоли браузера ошибка CSP: соберите сайт и запустите `node scripts/check-csp.mjs`, он подскажет хэш для Caddyfile.
