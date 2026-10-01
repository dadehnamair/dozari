# Local development without Docker

Docker is optional. Containerisation (server image, compose for prod) comes later; until then
everything runs directly on the host. Needs Node 22 (`.nvmrc`), pnpm, and a local MySQL 8
(decision D63 in `DECISIONS.md`).

## 1. MySQL

Install it natively (XAMPP/Laragon/MySQL Installer on Windows, `brew install mysql`, `apt install mysql-server`),
then create the database and user:

```sql
CREATE DATABASE dozari CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dozari'@'%' IDENTIFIED BY 'dozari';
GRANT ALL ON dozari.* TO 'dozari'@'%';
```

Use phpMyAdmin / Adminer / any client to manage it. The connection string matches `.env.example`;
change `DATABASE_URL` if yours differs (e.g. XAMPP's root without a password:
`mysql://root@localhost:3306/dozari`).

## 2. Env + install

```bash
cp .env.example .env     # git-ignored; defaults use local-disk images, no MinIO needed
pnpm install
```

`.env` is loaded via `--env-file` by the server `dev` script and the `@dozari/db` scripts.

## 3. Schema, seed, images

```bash
pnpm --filter @dozari/db db:migrate
pnpm --filter @dozari/db seed              # idempotent; `seed:check` only validates
pnpm --filter @dozari/db images:upload     # seed/images/* -> .local/images (served by the API)
```

Image storage is chosen by env: if `S3_ENDPOINT` is set it uploads to S3-compatible storage
(MinIO via `docker compose`, ArvanCloud in prod), otherwise it copies to `LOCAL_IMAGES_DIR`.

## 4. Run and look

```bash
pnpm --filter @dozari/server dev           # http://localhost:3000
curl localhost:3000/health
curl localhost:3000/products               # every active product with audiences and era tags
curl localhost:3000/products/<id>/prices   # approved points only, rials as strings
# images: http://localhost:3000/images/products/<slug>/<file>
```

`/prices` returns `[]` until price points are `approved`; seed entries marked `pending`
(AI-suggested, unverified) are stored but never served. Flip `status` to `approved` in the seed
JSON after verifying a source, then re-run `seed`.

Mobile: `pnpm --filter @dozari/mobile start` (Expo web/Android; needs no server yet).

## 5. Review prices (`/admin`)

Set `ADMIN_TOKEN` in `.env` (see `.env.example`) and restart the server, then open
`http://localhost:3000/admin`, paste the token, and approve / reject / re-queue price points.
Points that jump >5× or drop >30% versus the previous point are flagged (usually a rial↔toman slip).
Approving a second price for the same year and month is refused. Without `ADMIN_TOKEN` the page and
API are not served at all; the server listens on all interfaces, so use a long random token on any
shared network.

## 6. Play solo in the app

There must be at least one `approved` puzzle in the database. Puzzle authoring is not built yet, so for a first look create a
**fake demo puzzle** (16 invented `demo-*` products, hidden from the catalog, made-up prices — dev only):

```bash
pnpm --filter @dozari/db demo:puzzle           # create
pnpm --filter @dozari/db demo:puzzle:remove    # delete it again
```

Then:

```bash
pnpm --filter @dozari/server dev      # API on :3000
pnpm --filter @dozari/mobile start    # then press `w` for web, or scan the QR with Expo Go
```

The app reads the API address from `EXPO_PUBLIC_API_URL` (default `http://localhost:3000`; on a phone use
your computer's LAN IP). For the **web** build also set `CORS_ORIGIN=http://localhost:8081` in `.env`
(native apps don't need CORS).

### If the solo screen says «اتصال به سرور برقرار نشد»

The screen now prints the address it tried (`آدرس سرور: …`). Check, in order:
1. `http://localhost:3000/health` opens in a browser (the server is running).
2. Expo **web** only: `.env` has `CORS_ORIGIN=*` (or the exact web origin) and the server was restarted; the browser console (F12) mentions CORS.
3. On a **phone**: `localhost` is the phone itself. Start Expo with `EXPO_PUBLIC_API_URL=http://<computer LAN IP>:3000` and allow port 3000 in the firewall.
