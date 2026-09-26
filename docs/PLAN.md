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

- [ ] pnpm workspace: `apps/mobile`, `apps/server`, `packages/shared`, `packages/db`
- [ ] Root `tsconfig.base.json` (strict), ESLint + Prettier, `.editorconfig`, `.nvmrc` (Node 22)
- [ ] `docker-compose.yml`: postgres (+ adminer for dev)
- [ ] 🗄 Drizzle setup, first migration from `docs/logic/data-model.md` (products, price_points only)
- [ ] 🧩 `packages/shared/src/format`: `rialsToTomanString`, `toPersianDigits`, Jalali year helpers + tests
- [ ] 📱 Expo app boots in RTL with bundled Vazirmatn font, `fa.ts` i18n file, placeholder home
- [ ] GitHub Actions CI: typecheck, lint, test
- [ ] Fill the **Commands** section of `CLAUDE.md` with real commands

**Exit:** `pnpm -r typecheck && pnpm -r test` green in CI; app shows a Persian RTL screen.

## Phase 1 — Catalog & content pipeline

- [ ] 🗄 Seed format (`packages/db/seed/*.json`) validated by zod — see `price-catalog` skill
- [ ] 📚 First 60 products × ≥3 price points (hand-curated, with sources where available)
- [ ] 🖥 REST: `GET /products/:id`, `GET /products/:id/prices` (for result chart)
- [ ] 🖥 Image upload to object storage (script, not UI yet)
- [ ] 🧪 Seed validation test: every product has ≥1 price point, no duplicate (product, year)

**Exit:** catalog queryable; seed can be re-run idempotently.

## Phase 2 — Puzzle engine (single-player, offline logic)

- [ ] 🧩 Group rule types + evaluators (`logic/puzzle-generation.md` §Rule types)
- [ ] 🧩 `validatePuzzle()` — uniqueness of solution, difficulty ordering, item constraints
- [ ] 🧩 `generatePuzzle(catalog, rng, opts)` — template-driven generator with retries
- [ ] 🗄 `puzzles`, `puzzle_groups`, `puzzle_group_items`, `group_title_templates`
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

## Phase 4 — Identity & multiplayer core

- [ ] 🖥 Guest auth (device id → JWT), profile (nickname, avatar pick)
- [ ] 🧩 Socket event contracts (`logic/matchmaking.md`, `logic/game-rules.md`)
- [ ] 🧩 Match reducer: shared board, turns, timers-as-commands, scoring, end conditions
- [ ] 🖥 MatchService + redaction (`toClientView`), turn timer, persistence of match log
- [ ] 🖥 MatchmakingService: 1v1 queue, private table (room code), reconnect grace
- [ ] 📱 Lobby: quick match 1v1, create/join private table, waiting screen
- [ ] 📱 Match screen: whose turn, timer, scores, opponent's last guess feedback
- [ ] 🧪 Reducer tests for every rule; socket integration test with two fake clients

**Exit:** two phones can play a 1v1 and a private-table match.

## Phase 5 — 2v2 teams, taunts, chat gating

- [ ] 🧩 Team turn model + "proposal" flow (teammate proposes selection, captain submits)
- [ ] 🖥 2v2 queue (party of 2 or solo fill), team rooms
- [ ] 🗄 `canned_taunts` (Persian, categorized), `invite_codes`, `users.chat_unlocked_at`
- [ ] 🖥 ChatService: canned taunts for all; free text only if sender unlocked; team vs all channels
- [ ] 🖥 Profanity filter (Persian wordlist + normalization of ی/ي، ک/ك، ZWNJ) + report/mute
- [ ] 📱 Chat drawer with tabs (team / all), taunt picker, invite-code redemption screen
- [ ] 🧪 Visibility matrix tests (`logic/chat-and-access.md`)

## Phase 6 — Coin economy

- [ ] 🗄 `coin_ledger` (append-only) + balance view; idempotency keys
- [ ] 🧩 `config/economy.ts` + pure calculators; 🧪 simulation script for faucet/sink balance
- [ ] 🖥 LedgerService (single write path), entry fee escrow at match start, payout at end, refunds on abort
- [ ] 🖥 Daily free games + daily login bonus + invite reward (with anti-abuse rules)
- [ ] 📱 Coin balance header, entry-fee confirmation, reward animation, invite share screen

## Phase 7 — UGC phase 1 (single item suggestions)

- [ ] 🗄 `ugc_submissions`, `ugc_votes`
- [ ] 🖥 Submit item (name, year, price, source, photo), vote, admin approve → product/price_point
- [ ] 📱 "Suggest an item" form + "Review suggestions" voting feed
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
