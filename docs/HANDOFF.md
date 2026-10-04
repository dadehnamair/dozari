# Handoff — update 2026-10-04 (later the same day)

Done on `main`: **A** architecture tidy-up (feedback wiring in `feedback/build.ts`; one `CosmeticSlot` and one wear-key table in shared; `Character`, `HomeScreen`, `admin/ui/views2` split, rendering/output verified byte-identical) · **B** SVG wearable pipeline (`apps/mobile/assets/wear/README.md`, `wear:build`, `wear:check` in CI) · **C** solo combo + timer ring, near-miss pill, last-life heartbeat (D178) · **E** fitting room, the hujre keeps only non-character goods (D179). Not seen on a real phone / live MySQL / Docker (compose services were renamed `s-dozari-*`, containers `c-dozari-*`: on the server run `up -d --build --remove-orphans`).
Still open: the cosmetic pack's extra slots (crown, beard & moustache, skin tone, jewels, badge), bundles, and worn items on leaderboard/friend/chat avatars (D); real art goes in `assets/wear/`.

---

# Handoff — state at 2026-10-04 (read this section first in a new chat)

Everything up to PR #129 is merged to `main` and green. No half-finished branch. Owner talks Persian; reply in Persian.

## Mine, in proposed order
**A. Architecture tidy-up (no behaviour change; existing tests must stay green)**
1. Move the inline wiring in `apps/server/src/index.ts` into builder files; first `FeedbackService` (two direct `products` queries live there).
2. `CosmeticSlot` is declared three times (shared hints-contract, db schema, server shop-store): keep one source.
3. Merge wear keys: `apps/mobile/src/components/wearArt.tsx` (`WEAR_SLOT_OF`) vs default items in `apps/server/src/economy/shop-store.ts`.
4. Split big files: `Character.tsx`, `HomeScreen.tsx`, `admin/ui/views2.ts`.

**B. Owner-drawn wearable pipeline (owner agreed to draw the art)**
- Folder `apps/mobile/assets/wear/<slot>/<key>.svg`; script converting SVG -> react-native-svg component registered in `wearArt.tsx`.
- Art spec for the designer: `viewBox="-20 -18 240 276"`, head centred x=100, eyes y~74, chin y~140, crown of head y~32; outline `#3A2418` width 2.5-3; only path/circle/rect/g; transparent bg; two-layer items as `<key>.front.svg` + `<key>.back.svg`. Slots: hat, hair, glasses, outfit, accessory.
- Adding an item afterwards = drop the file + one shop row with that `iconKey`.

**C. Solo-game excitement (ASK the owner first)**: 1) combo + timer ring, 2) «یکی مونده!» near-miss + last-life heartbeat; later: friend ghost times, nightly rule, boss rounds.

**D. Not built**: worn items on leaderboard/friend/chat avatars (needs `worn` in those lists); admin age-band stats + exact birth date in the admin user sheet; UGC photo upload, outlier guard, Home card; admin number-input grouping.

## Owner's side
DNS/proxy `mrdozari.ir` -> 127.0.0.1:8083 and `2oi.ir` -> 127.0.0.1:3000 (keep Host); `link.android_app` / `link.app_url`; run the Android APK workflow; SEO/GEO sheet, real OG PNG + font; Bale token, store receipt verifier, `feature.coin_packages`; real clothing art; decision on PR #92. Deploy runs `migrate` (up to 0054: the makeup slot).

## Not verified
Real phone, live MySQL, Bale, Docker. Only typecheck/lint/tests (landing 11, shared 284, db 24, mobile 154, server 352) and one headless-Chromium look at the wearables.

Suggested first message in the new chat: "Do A, then B. Ask about C."

---

# Handoff — state at 2026-10-02 (end of session 01FSfm13JSuXPhZuFaMnZPnv)

For the next chat. Read `CLAUDE.md`, then this file, then `docs/DECISIONS.md` from D99 on.

## Session of 2026-10-03 — state and what is left (read this first in a new chat)

Done and pushed to `main` (D140–D155): 2v2 team mode with 3 boards, phone login, scheduled puzzle top-up, character/home animations, opponent-search
grid (1v1 and 2v2 = three «؟»), winding level road + admin level table, no-scroll profile + player card, vocabulary (قبیله، جارچی، حجره، صراف…),
sample seed (`--remove-sample` at launch), header fix, 157-icon pack generated from designs with categories, endless-search diagnosis + bot
auto top-up, `ErrorCard`, wheel everywhere (Home button, daily spin, shop item, level/tournament prizes; migration 0040).

**Not verified (cannot be from the container):** a real phone; migrations 0039/0040 and the seed on a live MySQL; real SMS provider; the bot
auto top-up on a fresh DB (only unit-tested).

**Still open, in the order proposed:**
1. Run migrations + seed on the real server; confirm the search works (needs ≥1 approved puzzle; bots are now auto-made). Ask the owner whether
   the daily spin (`wheel.daily_spins`, default 1) is what «روزانه» meant (D154) and whether the shop prices of 25/100 coins are right.
2. Owner must confirm the fantasy names, especially «صراف» for the price finder (D148).
3. `ErrorCard` on the remaining screens (shop, chat, tournaments, leaderboard, friends) — GAPS B+.
4. A1 shop «سکه» tab (coin packages; server is done) → B1+B2 finish the duel loop (price round, chart, share card) → A3/A4+B8 2v2 result/HUD
   polish → B6 team chat → B3 UGC → A5/A6 FX and badges in game → B4 bot takeover/reconnect. Full list: `docs/GAPS.md`.
5. Admin cannot yet gift wheel spins to one player (`source = 'admin'` is reserved).
6. `docs/PLAN.md` is stale: tick the finished items in one sweep.
7. Content: real catalogue (≈150 products with ≥3 approved price years); the sample seed is only a placeholder.

## Working agreement
- Owner talks Persian; code/commits/docs English. Branch `claude/keen-cray-pdxnxh`; after each merge: `git fetch origin main && git checkout -B claude/keen-cray-pdxnxh origin/main`, push with `--force-with-lease`.
- Standing authorization (until Saturday morning 2026-10-03): squash-merge own PRs after green CI (undraft first, `expectedHeadSha` = full sha), then go on to the next item.
- GitHub only through `mcp__github__*` tools. Commit trailer and PR footer: see the attribution reminder of the session.
- Screens follow the owner's designs (`docs/design/*.dc.html`, D99). One decision entry per feature.

## Deployed / ops
- Owner's server (`~/projects/dozari`, user `shahkochaki`) runs `docker-compose.prod.yml` + `.env.prod`; web on `127.0.0.1:8081`, API on `127.0.0.1:3000`; the host's own proxy forwards `mrbots.ir` and `api.mrbots.ir` (TLS comes from the CDN, no certbot). See `docs/deploy.md`, D110, D113.
- **Sample catalogue (D149, 2026-10-03):** 119 `sample-*` products with rough prices + 10 curated puzzles + generated ones; remove with `... run.ts --remove-sample` before launch (docs/deploy.md §sample). Older note on the seed:
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
