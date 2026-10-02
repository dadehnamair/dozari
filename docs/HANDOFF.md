# Handoff — state at 2026-10-02 (end of session 01FSfm13JSuXPhZuFaMnZPnv)

For the next chat. Read `CLAUDE.md`, then this file, then `docs/DECISIONS.md` from D99 on.

## Working agreement
- Owner talks Persian; code/commits/docs English. Branch `claude/keen-cray-pdxnxh`; after each merge: `git fetch origin main && git checkout -B claude/keen-cray-pdxnxh origin/main`, push with `--force-with-lease`.
- Standing authorization (until Saturday morning 2026-10-03): squash-merge own PRs after green CI (undraft first, `expectedHeadSha` = full sha), then go on to the next item.
- GitHub only through `mcp__github__*` tools. Commit trailer and PR footer: see the attribution reminder of the session.
- Screens follow the owner's designs (`docs/design/*.dc.html`, D99). One decision entry per feature.

## Deployed / ops
- Owner's server (`~/projects/dozari`, user `shahkochaki`) runs `docker-compose.prod.yml` + `.env.prod`; web on `127.0.0.1:8081`, API on `127.0.0.1:3000`; the host's own proxy forwards `mrbots.ir` and `api.mrbots.ir` (TLS comes from the CDN, no certbot). See `docs/deploy.md`, D110, D113.
- Seed on the server: `$dc run --rm --user root -w /app/packages/db server pnpm exec tsx src/seed/run.ts` (only ONE starter product exists in `packages/db/seed/products/_starter.json`; `seed/images` is empty). `demo-puzzle.ts` makes one fake playable puzzle. Real content must come from the admin panel / content bot — the owner has not got a real catalogue yet. Offer: write a bigger real seed.
- Bale bot uses long polling (`notify/runner.ts`) — **no webhook needed**; set `BALE_BOT_TOKEN` and `BALE_BOT_USERNAME` in `.env.prod`, restart `server`. (The owner asked how to connect a Bale webhook; answer pending in chat — give this.)

## Merged this session
#86 level road / locked popup / wheel / city hub · #87, #88 deploy fixes · #89 polish batch 1 (D114) · #90 presence + friends' DM + table invites (D115; merged together with this file).

## Owner's list of 16 notes — status
1 slogan lower ✔ · 2 invite friends to a table ✔ (#90) · 3 online dot ✔ (#90; "other players' profile is plain" — still plain) · 4 guide character on Home explaining the menus ✘ · 5 private chat between friends ✔ (#90) · 6 price finder busier, by category ✘ · 7 app-wide soft music, a bit more exciting in competitions ✘ (`sound/engine.ts` is WebAudio SFX only) · 8 table icons from our pack ✔ · 9 wheel as a separate thing: chance after a win ✔ (D116; gems still don't exist) (**there is no gems currency** — needs an owner decision; `daily/DailyWheelPage.tsx` still exists, unused) · 10 daily reward as before ✔ · 11 shop → «بازار» ✔; a guide explaining why items are locked ✘ · 12 message filters ✔ · 13 tap the coin count → coin history ✔ (D118, `GET /me/ledger` + `LedgerSheet`) · 14 level star icon ✔ · 15 table button: join / create menu ✔ · 16 no zoom ✔.

## Not built (older asks)
screen-login with phone (needs the account-recovery decision), public player number + default handle (`dozari_7k2m`), Bale payment docs (allow `docs.bale.ai` or paste the payment section), gems/outfits/avatars shop tabs, week/month leaderboards, team and propose-and-vote modes, recent games on profile.

## Suggested next order
6 (lookup categories) → 4 (guide + locked-item explanations) → 7 (music) → 9 after the owner picks: wheel by win-chance and/or gems.

## Local dev
MySQL `mysqld_safe --user=mysql`; `pnpm --filter @dozari/db db:migrate`; server `pnpm --filter @dozari/server dev`; web `EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web --port 8081`. Docker is not available in the cloud container, so images and Caddy are never built there.
