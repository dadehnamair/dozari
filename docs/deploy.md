# Deploying to a server (production)

`docker-compose.yml` in the repo root is **development only** (MySQL, Adminer, MinIO with throw-away
passwords and open ports). The production stack is `docker-compose.prod.yml`:

| Service | What it is | Reachable from outside |
|---|---|---|
| `s-dozari-mysql` | MySQL 8.4, data in a volume | no (compose network only) |
| `s-dozari-migrate` | applies the DB migrations, then exits | no |
| `s-dozari-server` | the game server (REST, Socket.io, admin panel, product images) | `127.0.0.1:3000` |
| `s-dozari-web` | the web app (PWA) as static files over plain HTTP | `127.0.0.1:8081` (`WEB_PORT`) |
| `s-dozari-phpmyadmin` | phpMyAdmin on the same MySQL (§phpMyAdmin) | `127.0.0.1:8082` (`PMA_PORT`) |

Naming: every compose service is `s-dozari-<name>` and its container `c-dozari-<name>` (`docker compose` commands take the
service name, plain `docker` commands such as `docker logs` take the container name). The dev stack follows the same rule.

**This stack binds neither port 80 nor 443.** The server already runs other services behind a reverse proxy, so
that proxy keeps the domains and https and forwards two names to the containers (§Reverse proxy):

| Public name (DNS A record to the server) | Forward to |
|---|---|
| `mrbots.ir` (`APP_DOMAIN`, the web app) | `127.0.0.1:8081` |
| `api.mrbots.ir` (`API_DOMAIN`, the game server; product images live at `/images/`) | `127.0.0.1:3000`, **websockets on** |
| `mrdozari.ir` (`LANDING_DOMAIN`, the landing site and blog, D173) | `127.0.0.1:8083` (`LANDING_PORT`) |
| `2oi.ir` (the short-link domain, `domain.short`, D172) | `127.0.0.1:3000` with the original `Host` header kept |

The API address is baked into the web build, so changing `API_DOMAIN` later means editing `.env.prod` and
rebuilding `s-dozari-web`.

## Before you start

- A Linux server with Docker and the Compose plugin.
- A reverse proxy on the host that can forward two domains (nginx, Caddy, Nginx Proxy Manager ...).

## First run

```bash
git clone <repo> dozari && cd dozari
cp deploy/.env.example .env.prod
nano .env.prod          # every line: domains, MYSQL_*, JWT_SECRET, ADMIN_TOKEN (openssl rand -hex 24)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps     # s-dozari-migrate: exited (0), others: running
curl http://127.0.0.1:3000/health   # once the proxy forwards: https://api.mrbots.ir/health
```

The server **refuses to start in production** with a short or default `JWT_SECRET` / `ADMIN_TOKEN`
(`docs/security.md`). Open `https://<API_DOMAIN>/admin`, paste `ADMIN_TOKEN` for quick access. Real admin accounts (roles `owner|editor|support|viewer`) are made with:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm -w /app/apps/server s-dozari-server \
  pnpm exec tsx src/admin/accounts/cli.ts <username> owner "<display name>"
```

## Reverse proxy

Add the two forwards from the table above in whatever proxy owns 80/443. `deploy/nginx.example.conf` is a
ready nginx example. In Nginx Proxy Manager add two Proxy Hosts — `mrbots.ir` → `http://127.0.0.1:8081` and
`api.mrbots.ir` → `http://127.0.0.1:3000` with *Websockets Support* on — and request a Let's Encrypt certificate
for each. Two things matter: **websockets** (live duels and chat use Socket.io on the API host) and passing
`X-Forwarded-*` headers (the server runs with `TRUST_PROXY=1`). Check: `https://api.mrbots.ir/health` answers,
`https://mrbots.ir` shows the game, and a duel connects.

## phpMyAdmin

The `s-dozari-phpmyadmin` service is already in `docker-compose.prod.yml`, bound to **`127.0.0.1:8082`** (change with `PMA_PORT` in `.env.prod`). Forward a domain of your
choice (say `pma.mrbots.ir`) to that port in the host's proxy — like the other two, with https from the proxy/CDN — and **protect that domain** (basic auth or an
IP allow-list; `deploy/nginx.example.conf` has a block with basic auth). Log in with user `dozari` and `MYSQL_PASSWORD` (database `dozari`), or `root` and
`MYSQL_ROOT_PASSWORD`. Start it with the rest: `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d s-dozari-phpmyadmin`. For local development
the root `docker-compose.yml` has Adminer on `:8080`.

## Catalogue (products, prices, images)

The game needs product data. **No shell on the host?** Nothing to do: the `s-dozari-seed` service runs on every `up -d --build` and loads the catalogue when the database has no
products yet (`SEED_ON_START=empty`, the default; check with `logs s-dozari-seed`). `SEED_ON_START=1` re-runs the full idempotent seed on every `up`, `0` turns it off.
Caveat: after `--remove-sample` with no real products loaded, the next `up` seeds the samples again; set `0` first. With a shell, load it once (and again after changing the seed files):

```bash
dc="docker compose -f docker-compose.prod.yml --env-file .env.prod"
$dc run --rm --user root -w /app/packages/db s-dozari-server pnpm exec tsx src/seed/run.ts            # products + prices + sample puzzles
$dc run --rm --user root -w /app/packages/db s-dozari-server pnpm exec tsx src/seed/upload-images.ts  # product images -> volume
```

Images are stored in the `images` volume and served by the game server at `https://<API_DOMAIN>/images/` (through your proxy).
To use S3-compatible storage instead (ArvanCloud, MinIO), add the `S3_*` variables from `.env.example`
to the `s-dozari-server` service environment and run the upload command above.

### The sample catalogue (D149) — delete it before launch

`packages/db/seed/products/sample-bazaar.json` holds **119 sample products** (slugs `sample-*`, ≥ 3 price years each, icons from the item pack) and
`packages/db/seed/puzzles/sample.json` **10 hand-made puzzles**; the seed run also makes up to 20 more approved puzzles with the generator. Every sample
price is a **rough, approximate number for testing** (the note on each says «نمونه — … پیش از لانچ جایگزین یا پاک شود»), not researched data. The seed is
idempotent. To remove everything the sample made — its products, their prices and every puzzle made from them — before putting real data in:

```bash
$dc run --rm --user root -w /app/packages/db s-dozari-server pnpm exec tsx src/seed/run.ts --remove-sample
```

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
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T s-dozari-mysql \
  sh -c 'mysqldump -udozari -p"$MYSQL_PASSWORD" --single-transaction dozari' | gzip > dozari-$(date +%F).sql.gz
```

Also copy the `images` volume if images are not re-creatable from the repo. Restore:
`gunzip -c dozari-DATE.sql.gz | docker compose … exec -T s-dozari-mysql sh -c 'mysql -udozari -p"$MYSQL_PASSWORD" dozari'`.

## Notes

- One server process: the rate limits and the live-match queue live in memory (`docs/security.md`).
  Do not scale `s-dozari-server` to several replicas yet.
- Both published ports are bound to the loopback only, so nothing is reachable from outside except through your proxy.
- Logs: `docker compose … logs -f s-dozari-server`.
- Bale bot and SMS keys are optional; leave them empty to keep those features off.

## Landing site and short domain (items 8 and 9)

- **`s-dozari-landing` service** (`mrdozari.ir`): server-rendered pages (home, blog, cast, `sitemap.xml`, `robots.txt`, `llms.txt`). It has no database; it reads the game server's public content API (`API_URL=http://s-dozari-server:3000`), so start it with the rest (`up -d --build s-dozari-landing`). Content (blog posts, cast, FAQ, hero text) is edited in the game's admin panel under «سایت معرفی». If the game server is down the site keeps serving its last answers for a while and then shows a calm 503 page. Forward `LANDING_DOMAIN` to `127.0.0.1:LANDING_PORT` and give it a certificate like the other names.
- **`2oi.ir`**: point it at the same reverse proxy and forward it to the **game server** (`127.0.0.1:3000`) **keeping the original `Host` header** (nginx: `proxy_set_header Host $host;`). The server turns requests for `domain.short` into redirects (docs/logic/short-links.md). Links are made in the admin page «لینک کوتاه».
