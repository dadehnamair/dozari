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
1 slogan lower ✔ · 2 invite friends to a table ✔ (#90) · 3 online dot ✔ (#90; "other players' profile is plain" — still plain) · 4 guide character on Home explaining the menus ✔ (D120) · 5 private chat between friends ✔ (#90) · 6 price finder by category ✔ (D70 note) · 7 app-wide soft music, more exciting in competitions ✔ (D121, synthesised; web only) · 8 table icons from our pack ✔ · 9 wheel as a separate thing: chance after a win ✔ (D116; gems still don't exist) (**there is no gems currency** — needs an owner decision; `daily/DailyWheelPage.tsx` still exists, unused) · 10 daily reward as before ✔ · 11 shop → «بازار» ✔; a guide explaining why items are locked ✔ (D120) · 12 message filters ✔ · 13 tap the coin count → coin history ✔ (D118, `GET /me/ledger` + `LedgerSheet`) · 14 level star icon ✔ · 15 table button: join / create menu ✔ · 16 no zoom ✔.

## New owner notes (2026-10-02, late)
17 no page may scroll — measured in headless Chromium (390×780, 360×640, 360×560) with a real server: Hub, Settings (rows tighten), Duel mode select (cast shrinks) and every sheet reachable from Home no longer overflow (the Bazaar now pages its items) ✔; pages with real data lists (inbox, chat, ledger, leaderboard, tournaments) still scroll inside their list, by design; not checked with lots of data ✘ · 18 characters were unused — now hosts: baqal (Bazaar, coin history), mirza (price finder), ajan (inbox), khale (chat), pahlevan (leaderboard, tournaments), goli (friends); players' avatars are now cast faces (D122) ✔; empty states now use cast characters (`EmptyNote` in inbox, coin history, tournaments, leaderboard; `EmptyState` ported to `Character`) ✔; result screens already had them · 19 admin «بازبینی قیمت‌ها» crashed with `appendChild … not of type 'Node'` when a price had a warning flag (nested array passed to `h()`); fixed in `ui/core.ts` (`h` flattens arrays), reproduced and verified in headless Chromium. Its empty state also points to «صندوق ربات».

22 Scene animations stopped on the owner's device: cause was the wobble filter recomputed per frame (D124) — moving scenes now skip it, Hub gets moving cloud/palms; fixed, verify on the phone. The switch Settings → «حرکت کمتر» still freezes everything by design.

23 Hub regression fixed: after fitting the map to the screen the purple hill / ground stopped at the map's edges; the SVG now spans the whole screen (viewBox centred on the map) and hill, ground and road extend past it.

24 Duel «ارتباط با سرور» error on the owner's host: locally fine; client now falls back to long-polling (D127). If it persists, check websockets on the api proxy and `CORS_ORIGIN` (polling needs it). **Deploy: run migrations 0034–0038.**

25 Solo said «پازل نیست»: the server had 1 product and 0 puzzles. Admin page «ساخت پازل» added (D130): needs ≥ 16 catalog products, then the owner builds puzzles by hand. The generator is built (D131): ~150 products with ≥3 approved price years are needed for it to succeed reliably; drafts need a human title + approval. The owner still has no real catalogue: ask for / write a real seed (never invent prices as approved; AI guesses go `pending`).

## Queue rule (owner, 2026-10-02)
New asks go to the END of the queue unless the owner says it is truly urgent.

## Queued at the end
20 **Phone ↔ existing account conflict** ✔ (D126, migration 0036; verified in a browser against a real server: card shown, load_previous swaps the account).

21 **Confirmations + OTP for account deletion** ✔ (D125; run `db:migrate` on the server for 0034 `xp_events` and 0035 `account_delete_codes`).

## Not built (older asks)
screen-login with phone ✔ (D147: first-run screen + settings row, see `docs/GAPS.md` for the full list of what is still missing), public player number + default handle (covered by `users.handle`, see D123), Bale payment docs (pasted by the owner → `docs/logic/bale-payments.md`, D129), gems/outfits/avatars shop tabs, (week/month leaderboards ✔ D123), team and propose-and-vote modes, recent games on profile ✔ (D128).

## Suggested next order
7 (music) → 9 after the owner picks: wheel by win-chance and/or gems.

## Local dev
MySQL `mysqld_safe --user=mysql`; `pnpm --filter @dozari/db db:migrate`; server `pnpm --filter @dozari/server dev`; web `EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web --port 8081`. Docker is not available in the cloud container, so images and Caddy are never built there.
