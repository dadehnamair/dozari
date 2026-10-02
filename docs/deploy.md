# Deploying to a server (production)

`docker-compose.yml` in the repo root is **development only** (MySQL, Adminer, MinIO with throw-away
passwords and open ports). The production stack is `docker-compose.prod.yml`:

| Service | What it is | Reachable from outside |
|---|---|---|
| `mysql` | MySQL 8.4, data in a volume | no (compose network only) |
| `migrate` | applies the DB migrations, then exits | no |
| `server` | the game server (REST, Socket.io, admin panel, product images) | only through Caddy |
| `web` | Caddy: https certificates, the web app (PWA), proxy to the server | ports 80 / 443 |

## Before you start

- A Linux server with Docker and the Compose plugin; ports 80 and 443 open.
- Two DNS A records pointing at the server: `APP_DOMAIN` (the web app, e.g. `dozari.example.ir`) and
  `API_DOMAIN` (the game server, e.g. `api.dozari.example.ir`). Caddy gets the https certificates
  itself, which only works once both names resolve to this server.
- The API address is baked into the web build, so changing `API_DOMAIN` later means rebuilding `web`.

## First run

```bash
git clone <repo> dozari && cd dozari
cp deploy/.env.example .env.prod
nano .env.prod          # every line: domains, MYSQL_*, JWT_SECRET, ADMIN_TOKEN (openssl rand -hex 24)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps     # migrate: exited (0), others: running
curl https://$API_DOMAIN/health
```

The server **refuses to start in production** with a short or default `JWT_SECRET` / `ADMIN_TOKEN`
(`docs/security.md`). Open `https://<API_DOMAIN>/admin`, paste `ADMIN_TOKEN` for quick access. Real admin accounts (roles `owner|editor|support|viewer`) are made with:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm -w /app/apps/server server \
  pnpm exec tsx src/admin/accounts/cli.ts <username> owner "<display name>"
```

## Catalogue (products, prices, images)

The game needs product data. Load it once (and again after changing the seed files):

```bash
dc="docker compose -f docker-compose.prod.yml --env-file .env.prod"
$dc run --rm --user root -w /app/packages/db server pnpm exec tsx src/seed/run.ts            # products + prices
$dc run --rm --user root -w /app/packages/db server pnpm exec tsx src/seed/upload-images.ts  # product images -> volume
```

Images are stored in the `images` volume and served by the game server at `https://<API_DOMAIN>/images/`.
To use S3-compatible storage instead (ArvanCloud, MinIO), add the `S3_*` variables from `.env.example`
to the `server` service environment and run the upload command above.

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Migrations run by themselves before the server restarts. Players see «نسخهٔ تازه» in the app and
update with one tap (D102).

## Backups

```bash
# nightly (cron): dump the database
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T mysql \
  sh -c 'mysqldump -udozari -p"$MYSQL_PASSWORD" --single-transaction dozari' | gzip > dozari-$(date +%F).sql.gz
```

Also copy the `images` volume if images are not re-creatable from the repo. Restore:
`gunzip -c dozari-DATE.sql.gz | docker compose … exec -T mysql sh -c 'mysql -udozari -p"$MYSQL_PASSWORD" dozari'`.

## Notes

- One server process: the rate limits and the live-match queue live in memory (`docs/security.md`).
  Do not scale `server` to several replicas yet.
- `127.0.0.1:3000` is published on the host only for debugging; remove that `ports:` entry if you do not need it.
- Logs: `docker compose … logs -f server`.
- Bale bot and SMS keys are optional; leave them empty to keep those features off.
