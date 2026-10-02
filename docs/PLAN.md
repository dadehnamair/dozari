# Implementation plan

Phased roadmap. Each phase ends with something playable/testable. Tick boxes as work lands.
Every task follows the `feature-workflow` skill (spec → shared → server → client → tests).

Legend: 🧩 shared logic · 🗄 db · 🖥 server · 📱 mobile · 📚 content · 🧪 tests

---

## Phase 0-A — Stack spikes (de-risk before scaffolding)

Owner-approved (2026-09-26) tech consult; see `docs/DECISIONS.md` D13–D18. ~3–5 days. Each item
gets a short dated write-up appended to `DECISIONS.md` §Phase 0-A spike when done — a failed
spike can still flip a decision before real code depends on it.

- [ ] **Expo RTL + local build**: Expo app, forced RTL, bundled Vazirmatn, booted with a
      placeholder screen; build the Android APK **locally** (no EAS cloud) and install on ≥2 real
      devices (include one older/budget device); export the same code as web/PWA and open it in
      mobile Safari on an iPhone. Confirms D2, D13.
- [ ] **Realtime latency + framework choice**: minimal Socket.io echo server deployed on
      ArvanCloud; measure round-trip latency and reconnect behavior from Irancell/Hamrah-e-Avval
      mobile data. Spend ≤1 day building the same echo server with Colyseus and compare fit for
      the turn-based/redaction model. Decide D17 (Socket.io vs Colyseus) from the result.
- [ ] **Self-hosted OTA**: stand up a self-hosted `expo-updates` server; push a change and confirm
      it reaches the Phase-0-A build without a store re-submission. Confirms D14.
- [ ] **Registry reachability**: try `npm install` and `docker pull` from an Iranian network path
      (or the project's own CI runner); record which registries/mirrors need pinning in `.npmrc`
      / `Dockerfile` for reproducible installs.

**Exit:** D13–D17 confirmed or superseded with a written rationale in `DECISIONS.md`; if the Expo
web output proves unusable, record a pivot to React (Vite) + Capacitor here instead of silently
carrying it into Phase 0.

## Phase 0 — Foundations (repo & tooling)

- [x] pnpm workspace: `apps/mobile`, `apps/server`, `packages/shared`, `packages/db`
- [x] Root `tsconfig.base.json` (strict), ESLint + Prettier, `.editorconfig`, `.nvmrc` (Node 22)
- [x] `docker-compose.yml`: mysql (+ adminer for dev) — was postgres until D63
- [x] 🗄 Drizzle setup, first migration from `docs/logic/data-model.md` (products, price_points only)
- [x] 🧩 `packages/shared/src/format`: `rialsToTomanString`, `toPersianDigits`, Jalali year helpers + tests
- [x] 📱 Expo app boots in RTL with bundled Vazirmatn font, `fa.ts` i18n file, placeholder home
- [x] GitHub Actions CI: typecheck, lint, test
- [x] Fill the **Commands** section of `CLAUDE.md` with real commands

**Exit:** `pnpm -r typecheck && pnpm -r test` green in CI; app shows a Persian RTL screen.
Verified in-sandbox: `pnpm -r typecheck/lint/test` all green and `expo config` resolves the app
cleanly. Not verified here (no Docker daemon / physical device in this container): MySQL
actually running via docker-compose, and the app booting on a real Android device or in a
browser — both need the owner's own machine (see Phase 0-A).

## Phase 1 — Catalog & content pipeline

- [x] 🗄 Seed format (`packages/db/seed/*.json`) validated by zod — see `price-catalog` skill
- [ ] 📚 First 60 products × ≥3 price points (hand-curated: archive/AI-assisted research +
      personal/family memories, per `price-catalog` skill §Bootstrap sourcing)
- [x] 🖥 REST: `GET /products/:id`, `GET /products/:id/prices` (for result chart)
- [x] 🖥 Image upload to object storage (script, not UI yet) — MinIO in dev, S3-compatible so ArvanCloud in prod
- [x] 🧪 Seed validation test: every product has ≥1 price point, no duplicate (product, year)
- [x] 🖥 Interim price review page (`/admin`, token-guarded via `ADMIN_TOKEN`): approve / reject / re-queue
      `pending` price points, with >30%-drop / >5×-jump flags. Replaced by the Phase 7 admin panel.

**Exit:** catalog queryable; seed can be re-run idempotently.

## Phase 2 — Puzzle engine (single-player, offline logic)

- [x] 🧩 Group rule types + evaluators (`logic/puzzle-generation.md` §Rule types)
- [x] 🧩 `validatePuzzle()` — uniqueness of solution, difficulty ordering, item constraints
- [x] 🗄 `puzzles`, `puzzle_groups`, `puzzle_group_items`, `group_title_templates`
- [ ] 📚 **Hand-curate 50–100 puzzles first** (`curated` groups, admin-approved) to set the tone/
      humor bar before the generator exists — `puzzle-generation.md` §Content bootstrap order
- [ ] 🧩 AI-drafted group titles (2–3 candidates per rule `kind`) + human pick/edit before a
      puzzle is saved `approved` — `puzzle-generation.md` §Group titles
- [x] 🧩 `generatePuzzle(catalog, rng, opts)` — template-driven generator with retries, **built to
      imitate the hand-curated pool's style**, not before it exists
- [~] 🖥 Job: pre-generate a pool of N validated puzzles; admin CLI to approve/rename titles (admin page «ساخت پازل» does it by hand; no scheduled top-up job yet)
- [x] 🧩 Single-player reducer (select 4 → submit → correct / one-away / wrong, 4 mistakes)
- [x] 📱 Board UI: 4×4 grid, select/deselect, shuffle, submit, solved-row reveal with colors (placeholder styling until the designed art in `docs/design/asset-plan.md` lands)
- [x] 📱 Solo practice mode (no coins) using a served puzzle (`/solo/*` + `SoloScreen`; needs ≥1 `approved` puzzle in the DB)
- [~] 🧪 Property tests: generated puzzles always pass validator; reducer invariants (reducer invariants done with fast-check; generator part waits for the generator)

**Exit:** a person can play solo puzzles on the phone end-to-end.

## Phase 3 — Result chart & share

- [x] 🧩 Chart data builder: union of years, per-product series, gaps (`logic/result-chart.md`) — `buildChartData`, `normalizeX/Y`, `compactTomanLabel` in shared
- [x] 📱 Overlaid line chart (4 lines, one per item of a chosen group, or 16 thin lines + highlight) — `ChartView`/`ChartPanel` (react-native-svg), colour tabs per group, log/linear toggle; shown on the solo result screen
- [ ] 📱 Share card render (view-shot) with branding + deep link; `expo-sharing`
- [x] 🧪 Snapshot test of chart data builder

**Exit:** after a solo puzzle, user sees & shares the chart image.

## Phase 3-A — Price-guess bonus round (`logic/price-guess-round.md`)

- [x] 🧩 Round item selection (1 random item/group) + solo staircase scorer — `selectRounds`, `staircasePoints`, `parseTomanInput` in shared
- [x] 🧩 Competitive blind-simultaneous-guess reducer (4 rounds, reuses turn timer) — `applyPriceGuessCommand`, `priceGuessClientView` in shared (the timer itself is the server's `timeout` command)
- [x] 📱 Solo price-guess UI (numeric input, staircase feedback) — `PriceRoundPanel` + `GET /solo/:id/price-rounds`, `POST /solo/:id/price-guess`; runs after the puzzle, before the chart
- [ ] 📱 Competitive price-guess UI (hidden entry, simultaneous reveal animation)
- [~] 🧪 Scoring tests (staircase tiers, tie-on-distance draw done; the locked-out-side match rule waits for the match reducer)

**Exit:** every finished puzzle (solo or competitive) flows into a price-guess round before the result screen.

## Phase 4 — Identity & multiplayer core

- [x] 🖥 Guest auth (device id → JWT); random nickname+avatar assignment at creation
      (`logic/profile-and-identity.md`) — `POST /auth/guest`, `GET /me`, `users` table; client wiring comes with the lobby
- [x] 🧩 Socket event contracts (`logic/matchmaking.md`, `logic/game-rules.md`) — `socket/events.ts` (queue + 1v1 match; rooms/parties/chat later)
- [x] 🧩 Match reducer: shared board, turns, timers-as-commands, scoring, end conditions — `game/match.ts` (1v1; team/captain flow is Phase 5)
- [x] 🖥 Socket.io gateway: JWT handshake, per-user room, 1v1 queue join/leave with acks, live stats in the admin panel «سرویس سوکت» (`realtime/`)
- [x] 🖥 MatchService (v1): in-memory 1v1 around the shared reducer, redacted snapshots, turn timer, queue pairing, submit/resume/leave over sockets. Still open: persistence of match log, entry-fee escrow/payouts, price-guess round, ready handshake, reconnect grace, bot takeover
- [ ] 🖥 MatchmakingService: 1v1 queue, private table (room code, v1 built D93), reconnect grace
- [ ] 🖥 Bot pool + fallback-fill logic (`logic/bots.md`) — bots flow through the same MatchService
      path as real players; `is_bot` never leaves the server
- [ ] 📱 Lobby: quick match 1v1, create/join private table, waiting screen (est. wait, cancel,
      "play solo while waiting", short puzzle info)
- [x] 📱 4-slide onboarding tutorial (skippable) before first Home screen (D96)
- [ ] 📱 Match screen: whose turn, timer, scores, opponent's last guess feedback
- [ ] 🧪 Reducer tests for every rule; socket integration test with two fake clients; bot-fill test

**Exit:** two phones can play a 1v1 and a private-table match, with a bot stepping in when no
human opponent is found.

## Phase 4-B — Coin ledger & daily reward (D64)

- [x] 🗄 `coin_ledger` (append-only, idempotency key), `user_balances`, `daily_reward_steps`, `user_daily_rewards`
- [x] 🖥 `applyLedgerEntry` (the one place coins move), daily reward service + routes, admin editor tab
- [x] 🧪 Streak calculator tests (10/15/20, 24 h cooldown, skipped day resets), concurrent-tap test
- [ ] 📱 Daily reward card/popup (7-day card, claim button, countdown) — needs the client to log in first
- [ ] 🖥 Signup bonus and the other faucets/sinks of `economy.md`

## Phase 4-A — Profile screen (`logic/profile-and-identity.md`)

- [ ] 🗄 `user_tags`, tag catalog table, `users.equipped_tag_id`, avatar/nickname gallery tables
- [ ] 🖥 Play-count tracking + unlock checks (avatar @3 games, nickname @10 games)
- [ ] 🖥 Optional phone-link/OTP endpoint (account merge, not creation) — Iranian SMS provider (D18)
- [ ] 📱 Profile screen: stats, match history, achievements/tags, chat-lock status + redeem CTA,
      invite/referral block (copyable code, share sheet, live tracker), phone-link button
- [ ] 📱 Share-invite action also reachable from the match-result screen
- [ ] 🧪 Unlock-threshold tests; tag equip/unequip tests

**Exit:** a returning player has a profile that shows real progress, not just a coin balance.

## Phase 5 — 2v2 teams, taunts, chat gating

- [x] 🧩 Team turn model + "proposal" flow (teammate proposes selection, captain submits) — `game/match.ts`, `__tests__/team.test.ts`
- [x] 🖥 2v2 queue (solo fill + bot fill; party of 2 / team rooms still open) — `realtime/gateway.ts`, `match-service.ts#startTeam`
- [ ] 🗄 `canned_taunts` (Persian, categorized), `invite_codes`, `users.chat_unlocked_at`
- [ ] 🖥 ChatService: canned taunts for all; free text only if sender unlocked; team vs all channels
- [ ] 🖥 Profanity filter (Persian wordlist + normalization of ی/ي، ک/ك، ZWNJ) + report/mute
- [ ] 📱 Chat drawer: floating icon button + unread badge (`logic/app-screens.md`), tabs (team /
      all), taunt picker, invite-code redemption screen
- [ ] 🧪 Visibility matrix tests (`logic/chat-and-access.md`)
- [x] 📱 Settings screen: sound/vibration toggles, delete account/log out, replay tutorial, about/support (D89 + D96, inside the profile sheet)

## Phase 6 — Coin economy

- [ ] 🗄 `coin_ledger` (append-only) + balance view; idempotency keys
- [x] 🧩 `config/economy.ts` + pure calculators; 🧪 simulation (D90, `economy/simulate.ts`) for faucet/sink balance
- [ ] 🖥 LedgerService (single write path), entry fee escrow at match start, payout at end, refunds on abort
- [ ] 🖥 Daily free games + daily login bonus + invite reward (with anti-abuse rules)
- [ ] 🖥 `bot_match_subsidy` ledger reason + pot top-up when a bot fills a seat (`logic/bots.md`)
- [ ] 🧩 Price-guess round wager: per-round escrow, winner-takes-pot-minus-cut, auto-sit-out if
      unaffordable (`logic/price-guess-round.md` §Real coin side-bet)
- [ ] 🗄 `coin_packages` table + `purchase`/IAP ledger plumbing, **built but disabled** at MVP
      (`economy.md` §Real-money coin purchases) — enabling real purchases is a separate, later task
- [ ] 📱 Coin balance header, entry-fee confirmation, reward animation, invite share screen
- [ ] 📱 Single-scroll result screen: win/loss summary → 4 solved-group rows → 4 price-guess
      rounds → overlaid price chart (bottom) — see `logic/price-guess-round.md` §Result screen integration

## Phase 7 — UGC phase 1 (single item suggestions)

- [ ] 🗄 `ugc_submissions`, `ugc_votes`
- [ ] 🖥 Submit item (name, year, price, source, photo), vote, admin approve → product/price_point
- [ ] 📱 "Suggest an item" form + "Review suggestions" voting feed — reachable from its **own
      card on the Home screen**, alongside the mode cards (owner decision, 2026-09-27)
- [ ] Coin reward on approval (ledger)
- [ ] `apps/admin` minimal moderation panel (or protected Expo web routes)

## Phase 8 — Launch hardening

- [ ] Rate limiting, input size caps, abuse logging
- [ ] Error tracking (self-hosted GlitchTip/Sentry-compatible, not Google)
- [ ] Analytics (self-hosted, e.g. Umami/PostHog self-host) — match funnel, retention
- [ ] Load test: 500 concurrent matches on one instance
- [ ] Store listing for Cafe Bazaar & Myket; privacy policy (Persian)
- [ ] Backups + restore drill

## Later

- UGC phase 2: full puzzle builder + community puzzle browsing
- Monetization (once decided): Bazaar/Myket IAP for coins, rewarded ads
- Redis + horizontal scaling; seasonal leaderboards; lightweight rating for matchmaking
- Daily shared puzzle as an additional mode


## Ideas queue (owner, 2026-10-01)

- [x] 🛡 Profanity filter on all free text (D69): admin-editable word list, normalisation, server-side (filter + list + admin done; wire it into chat when chat exists)
- [x] Player profile sheet + friend requests (D67 v1) and gender setting switching the Home hero (D68 v1); app icon switch and tap-everywhere wait for screens
- [x] Admin accounts with roles, password sign-in, per-admin audit (D76)
- [x] Store review prompts (Myket / Bazaar / Bale) from admin settings (D75)
- [x] Admin: user management (detail, ban reason, logout everywhere, identity reset, notes) and app management (maintenance, min build, feature switches) (D74)
- [x] Admin message center (D73): compose / history / retract, in-app inbox + Bale live; SMS, e-mail, push await providers and recipients
- [x] Bale bot (D72): link by one-time code, outbox + dispatcher, match result / daily reward / broadcast notifications, admin section
- [x] Price range per product (D71): `priceRange`/`priceOnDate` in shared, admin catalog shows range + flags products below the minimum number of approved points
- [x] 🔎 Price lookup screen «استعلام قیمت» (D70): product + year -> approved price with source, chart, «request this item»
- [x] 🖥 Admin panel v2: sidebar SPA, dashboard, catalog + icon picker, price review, bot inbox/sources, daily reward, settings registry (`config/registry.ts`, `app_settings`), users + coin adjust, socket, audit log (`admin/ui/*`)
- [x] 🖥 Content bot: sources (`html_table`/`csv`/`text_lines`), runs, pending-only candidates with source + excerpt, approve/reject, in-process schedule + `bot:run` CLI (`bot/*`)
- [x] 📱 Guest login + token on device, daily reward card and coin balance on Home, item icons on board cards
- [ ] 🔔 Admin: word-filter section (with D69)
- [x] 🖥 Settings wired into: solo max mistakes, price-guess staircase + floor, daily reward cooldown/window (read live; a running solo game keeps the rules it started with)
- [ ] 🖥 Settings still to wire when their consumers exist: turn seconds, match mistakes, match scoring, avatar/nickname thresholds, chart limits (stored, editable, served at `GET /config`)

## Owner backlog 2026-10-01 (27 items) — see `docs/logic/owner-backlog-2026-10.md`

- [x] A. Player record: stats, XP/level, skill tier, city, optional e-mail, nickname rules, warnings/commendations/badges/medals (items 24, 8, 7, 14; D83)
- [ ] B. Coin economy — [x] shop + solo hints (D78); [x] referral "gold" (D79); [x] gifts and loans (D80); [x] coin packages built, off (D91, item 3), [x] economy audit + simulator (D90, item 4)
- [ ] C. Contact and friends — [x] phone + Bale contact verification, SMS adapter (D81, item 6); [x] public ID, search by ID/phone, contacts API, shortener + link-friend (items 19, 20; app contacts screen pending); [x] badge-gated sharing: perk + `containsContactInfo` (item 22; chat must enforce it)
- [x] D. Chat and moderation — city chat, canned taunt categories, duel taunts, reports (D84) with agent powers (D83); [ ] private-table chat and shared tables (items 16, 17, 18, 21, 23) — rest of D: chat, shared tables, city room, canned taunt categories, "Agent Dozari" powers (items 16, 17, 18, 21, 23)
- [x] E. Content control — [x] daily puzzle by day conditions/trends (item 15; D87); [x] tournament entry rules (coins + level), builder, own page, bracket engine (items 26, 27; D85); [x] admin bot players: accounts, queue fill, human-like play, taunt replies, tournament fill (item 25; D86); [ ] trend-based daily puzzle (15)
- [ ] F. Feel: [x] city dialect phrases (item 9; D88); [x] personal settings + web sound effects (items 10, 12; D89; native sound pending); dialects, sounds, city backgrounds, personal settings, touch-everything polish (items 9, 10, 11, 12, 13)
