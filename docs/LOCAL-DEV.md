# Local development without Docker

Docker is optional. Containerisation (server image, compose for prod) comes later; until then
everything runs directly on the host. Needs Node 22 (`.nvmrc`), pnpm, and a local PostgreSQL 16.

## 1. Postgres

Install it natively (Windows installer / `brew install postgresql@16` / `apt install postgresql`), then:

```bash
psql -U postgres -c "create user dozari superuser password 'dozari'" -c "create database dozari owner dozari"
```

The connection string matches `.env.example`; change `DATABASE_URL` if yours differs.

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
curl localhost:3000/products               # id, slug, name for every active product
curl localhost:3000/products/<id>/prices   # approved points only, rials as strings
# images: http://localhost:3000/images/products/<slug>/<file>
```

`/prices` returns `[]` until price points are `approved`; seed entries marked `pending`
(AI-suggested, unverified) are stored but never served. Flip `status` to `approved` in the seed
JSON after verifying a source, then re-run `seed`.

Mobile: `pnpm --filter @dozari/mobile start` (Expo web/Android; needs no server yet).
