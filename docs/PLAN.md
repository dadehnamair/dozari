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
- [ ] 🗄 `puzzles`, `puzzle_groups`, `puzzle_group_items`, `group_title_templates`
- [ ] 📚 **Hand-curate 50–100 puzzles first** (`curated` groups, admin-approved) to set the tone/
      humor bar before the generator exists — `puzzle-generation.md` §Content bootstrap order
- [ ] 🧩 AI-drafted group titles (2–3 candidates per rule `kind`) + human pick/edit before a
      puzzle is saved `approved` — `puzzle-generation.md` §Group titles
- [ ] 🧩 `generatePuzzle(catalog, rng, opts)` — template-driven generator with retries, **built to
      imitate the hand-curated pool's style**, not before it exists
- [ ] 🖥 Job: pre-generate a pool of N validated puzzles; admin CLI to approve/rename titles
- [ ] 🧩 Single-player reducer (select 4 → submit → correct / one-away / wrong, 4 mistakes)
- [ ] 📱 Board UI: 4×4 grid, select/deselect, shuffle, submit, solved-row reveal with colors
- [ ] 📱 Solo practice mode (no coins) using a served puzzle
- [ ] 🧪 Property tests: generated puzzles always pass validator; reducer invariants

**Exit:** a person can play solo puzzles on the phone end-to-end.

## Phase 3 — Result chart & share

- [ ] 🧩 Chart data builder: union of years, per-product series, gaps (`logic/result-chart.md`)
- [ ] 📱 Overlaid line chart (4 lines, one per item of a chosen group, or 16 thin lines + highlight)
- [ ] 📱 Share card render (view-shot) with branding + deep link; `expo-sharing`
- [ ] 🧪 Snapshot test of chart data builder

**Exit:** after a solo puzzle, user sees & shares the chart image.

## Phase 3-A — Price-guess bonus round (`logic/price-guess-round.md`)

- [ ] 🧩 Round item selection (1 random item/group) + solo staircase scorer
- [ ] 🧩 Competitive blind-simultaneous-guess reducer (4 rounds, reuses turn timer)
- [ ] 📱 Solo price-guess UI (numeric input, staircase feedback)
- [ ] 📱 Competitive price-guess UI (hidden entry, simultaneous reveal animation)
- [ ] 🧪 Scoring tests (staircase tiers, tie-on-distance draw, locked-out side can't win match off this alone)

**Exit:** every finished puzzle (solo or competitive) flows into a price-guess round before the result screen.

## Phase 4 — Identity & multiplayer core

- [ ] 🖥 Guest auth (device id → JWT); random nickname+avatar assignment at creation
      (`logic/profile-and-identity.md`)
- [ ] 🧩 Socket event contracts (`logic/matchmaking.md`, `logic/game-rules.md`)
- [ ] 🧩 Match reducer: shared board, turns, timers-as-commands, scoring, end conditions
- [ ] 🖥 MatchService + redaction (`toClientView`), turn timer, persistence of match log
- [ ] 🖥 MatchmakingService: 1v1 queue, private table (room code), reconnect grace
- [ ] 🖥 Bot pool + fallback-fill logic (`logic/bots.md`) — bots flow through the same MatchService
      path as real players; `is_bot` never leaves the server
- [ ] 📱 Lobby: quick match 1v1, create/join private table, waiting screen (est. wait, cancel,
      "play solo while waiting", short puzzle info)
- [ ] 📱 4-slide onboarding tutorial (skippable) before first Home screen
- [ ] 📱 Match screen: whose turn, timer, scores, opponent's last guess feedback
- [ ] 🧪 Reducer tests for every rule; socket integration test with two fake clients; bot-fill test

**Exit:** two phones can play a 1v1 and a private-table match, with a bot stepping in when no
human opponent is found.

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

- [ ] 🧩 Team turn model + "proposal" flow (teammate proposes selection, captain submits)
- [ ] 🖥 2v2 queue (party of 2 or solo fill), team rooms
- [ ] 🗄 `canned_taunts` (Persian, categorized), `invite_codes`, `users.chat_unlocked_at`
- [ ] 🖥 ChatService: canned taunts for all; free text only if sender unlocked; team vs all channels
- [ ] 🖥 Profanity filter (Persian wordlist + normalization of ی/ي، ک/ك، ZWNJ) + report/mute
- [ ] 📱 Chat drawer: floating icon button + unread badge (`logic/app-screens.md`), tabs (team /
      all), taunt picker, invite-code redemption screen
- [ ] 🧪 Visibility matrix tests (`logic/chat-and-access.md`)
- [ ] 📱 Settings screen: sound/vibration toggles, delete account/log out, replay tutorial, about/support

## Phase 6 — Coin economy

- [ ] 🗄 `coin_ledger` (append-only) + balance view; idempotency keys
- [ ] 🧩 `config/economy.ts` + pure calculators; 🧪 simulation script for faucet/sink balance
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
