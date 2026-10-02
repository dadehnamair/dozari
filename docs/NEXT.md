# Open work checklist — state at 2026-10-02 (end of session 01YBi3YgeezPWzWpm7QVi62M)

For the next chat. Read `CLAUDE.md`, `docs/HANDOFF.md`, then this file. `docs/PLAN.md` boxes are partly stale: several phase 4–6 items are built but not ticked — verify in code before building.

Tick a box (`- [x]`) in the same PR that finishes the item. Nothing is dropped: every open `PLAN.md` box, owner note and backlog item is listed here.

## Merged (for context)
PR #91 — post-win lucky wheel (D116), level-road coin rewards + hint-pack shop tiers (D117), animated scenes, duel socket token renewal, admin badge refresh + campaign invite codes, first iPhone safe-area pass. PR #92 — iPhone full-bleed art + safe-area content (open).

## A. This session's leftovers
- [ ] Merge PR #92 (iPhone full-bleed art + safe areas), deploy, verify on a real iPhone (remove + re-add the PWA)
- [ ] iPhone safe areas for full-screen sheets that do not use `PageShell` (leaderboard, tables, transfers, invite, Bale, review, badges, find, player, city hub, hint sheet, loans)
- [ ] Deploy: `docker compose … up -d --build`; `migrate` must end `exited (0)` (tables `wheel_spins`, `level_reward_claims`; ledger reasons `wheel_spin`, `level_reward`)
- [ ] Economy simulation for the lucky wheel (≈13 coins/spin) and the level road (1375 coins to level 50) — both are new faucets with guessed numbers
- [ ] Admin panel: «در انتظار» price / bot-inbox list shows a count but is empty (need: which list, the count, the role, and the `/admin/catalog` / `/admin/bot/candidates` responses)
- [ ] Admin panel: collect and fix the other issues the owner hinted at ("very much work")
- [ ] Scenes: owner's extra lantern-light / tree animations are not in the repo — push `Scene.dc.html` changes, then port; consider a stronger lantern glow
- [ ] Level road: S-shaped path + stars of the design, tap on past cards, entry from the Home level pill
- [ ] Level road shop goods beyond hint packs (outfits, avatars, frames) — needs the gems / currency decision
- [ ] Lucky wheel: decide whether solo / team / bot wins should spin; gems do not exist
- [ ] Bale bot: never run on real Bale servers; check `BALE_BOT_TOKEN` / `BALE_BOT_USERNAME` reach the `server` service in `docker-compose.prod.yml`; answer the owner's earlier webhook question (long polling, no webhook)
- [ ] Content bot (scraper): configure a real source, run it once on live data, review the candidates
- [ ] Seed: write a bigger real catalogue seed (`seed/images` is empty, one starter product only)

## B. Owner's 16 notes still open (HANDOFF.md)
- [ ] 4 — guide character on Home explaining the menus
- [ ] 6 — price lookup busier, by category
- [ ] 7 — app-wide soft music (a bit more exciting in competitions); `sound/engine.ts` is WebAudio SFX only
- [ ] 11 — guide explaining why an item is locked
- [ ] 13 — tap the coin count → coin history (`GET /me/ledger` + sheet, financial entries only)
- [ ] 3 — other players' profile is still plain

## C. Older asks not built
- [ ] Login with phone (needs the account-recovery decision)
- [ ] Public player number + default handle (`dozari_7k2m`)
- [ ] Bale payment docs (allow `docs.bale.ai` or paste the payment section)
- [ ] Shop tabs: gems / outfits / avatars
- [ ] Week and month leaderboards
- [ ] Team 2v2 and propose-and-vote modes
- [ ] Recent games on the profile
- [ ] Contacts screen in the app (API exists)
- [ ] Private-table chat and shared tables (owner backlog items 16, 17, 18, 21, 23)
- [ ] Trend-based daily puzzle (backlog item 15)
- [ ] Backlog F: native sound, city backgrounds, personal settings, touch-everything polish (items 9–13)
- [ ] Backlog C: badge-gated sharing must be enforced in chat (item 22)
- [ ] Admin: word-filter section; wire remaining settings to their consumers (turn seconds, match mistakes, match scoring, avatar/nickname thresholds, chart limits)
- [ ] Message center: SMS, e-mail and push await providers and recipients

## PLAN.md — Phase 0-A — Stack spikes (de-risk before scaffolding)
- [ ] **Expo RTL + local build**: Expo app, forced RTL, bundled Vazirmatn, booted with a placeholder screen; build the Android APK **locally** (no EAS cloud) and install on ≥2 real devices (include one older/budget device); export the s
- [ ] **Realtime latency + framework choice**: minimal Socket.io echo server deployed on ArvanCloud; measure round-trip latency and reconnect behavior from Irancell/Hamrah-e-Avval mobile data. Spend ≤1 day building the same echo server 
- [ ] **Self-hosted OTA**: stand up a self-hosted `expo-updates` server; push a change and confirm it reaches the Phase-0-A build without a store re-submission. Confirms D14.
- [ ] **Registry reachability**: try `npm install` and `docker pull` from an Iranian network path (or the project's own CI runner); record which registries/mirrors need pinning in `.npmrc` / `Dockerfile` for reproducible installs.

## PLAN.md — Phase 1 — Catalog & content pipeline
- [ ] 📚 First 60 products × ≥3 price points (hand-curated: archive/AI-assisted research + personal/family memories, per `price-catalog` skill §Bootstrap sourcing)

## PLAN.md — Phase 2 — Puzzle engine (single-player, offline logic)
- [ ] 📚 **Hand-curate 50–100 puzzles first** (`curated` groups, admin-approved) to set the tone/ humor bar before the generator exists — `puzzle-generation.md` §Content bootstrap order
- [ ] 🧩 AI-drafted group titles (2–3 candidates per rule `kind`) + human pick/edit before a puzzle is saved `approved` — `puzzle-generation.md` §Group titles
- [ ] 🧩 `generatePuzzle(catalog, rng, opts)` — template-driven generator with retries, **built to imitate the hand-curated pool's style**, not before it exists
- [ ] 🖥 Job: pre-generate a pool of N validated puzzles; admin CLI to approve/rename titles

## PLAN.md — Phase 3 — Result chart & share
- [ ] 📱 Share card render (view-shot) with branding + deep link; `expo-sharing`

## PLAN.md — Phase 3-A — Price-guess bonus round (`logic/price-guess-round.md`)
- [ ] 📱 Competitive price-guess UI (hidden entry, simultaneous reveal animation)

## PLAN.md — Phase 4 — Identity & multiplayer core
- [ ] 🖥 MatchmakingService: 1v1 queue, private table (room code, v1 built D93), reconnect grace
- [ ] 🖥 Bot pool + fallback-fill logic (`logic/bots.md`) — bots flow through the same MatchService path as real players; `is_bot` never leaves the server
- [ ] 📱 Lobby: quick match 1v1, create/join private table, waiting screen (est. wait, cancel, "play solo while waiting", short puzzle info)
- [ ] 📱 Match screen: whose turn, timer, scores, opponent's last guess feedback
- [ ] 🧪 Reducer tests for every rule; socket integration test with two fake clients; bot-fill test

## PLAN.md — Phase 4-B — Coin ledger & daily reward (D64)
- [ ] 📱 Daily reward card/popup (7-day card, claim button, countdown) — needs the client to log in first
- [ ] 🖥 Signup bonus and the other faucets/sinks of `economy.md`

## PLAN.md — Phase 4-A — Profile screen (`logic/profile-and-identity.md`)
- [ ] 🗄 `user_tags`, tag catalog table, `users.equipped_tag_id`, avatar/nickname gallery tables
- [ ] 🖥 Play-count tracking + unlock checks (avatar @3 games, nickname @10 games)
- [ ] 🖥 Optional phone-link/OTP endpoint (account merge, not creation) — Iranian SMS provider (D18)
- [ ] 📱 Profile screen: stats, match history, achievements/tags, chat-lock status + redeem CTA, invite/referral block (copyable code, share sheet, live tracker), phone-link button
- [ ] 📱 Share-invite action also reachable from the match-result screen
- [ ] 🧪 Unlock-threshold tests; tag equip/unequip tests

## PLAN.md — Phase 5 — 2v2 teams, taunts, chat gating
- [ ] 🧩 Team turn model + "proposal" flow (teammate proposes selection, captain submits)
- [ ] 🖥 2v2 queue (party of 2 or solo fill), team rooms
- [ ] 🗄 `canned_taunts` (Persian, categorized), `invite_codes`, `users.chat_unlocked_at`
- [ ] 🖥 ChatService: canned taunts for all; free text only if sender unlocked; team vs all channels
- [ ] 🖥 Profanity filter (Persian wordlist + normalization of ی/ي، ک/ك، ZWNJ) + report/mute
- [ ] 📱 Chat drawer: floating icon button + unread badge (`logic/app-screens.md`), tabs (team / all), taunt picker, invite-code redemption screen
- [ ] 🧪 Visibility matrix tests (`logic/chat-and-access.md`)

## PLAN.md — Phase 6 — Coin economy
- [ ] 🗄 `coin_ledger` (append-only) + balance view; idempotency keys
- [ ] 🖥 LedgerService (single write path), entry fee escrow at match start, payout at end, refunds on abort
- [ ] 🖥 Daily free games + daily login bonus + invite reward (with anti-abuse rules)
- [ ] 🖥 `bot_match_subsidy` ledger reason + pot top-up when a bot fills a seat (`logic/bots.md`)
- [ ] 🧩 Price-guess round wager: per-round escrow, winner-takes-pot-minus-cut, auto-sit-out if unaffordable (`logic/price-guess-round.md` §Real coin side-bet)
- [ ] 🗄 `coin_packages` table + `purchase`/IAP ledger plumbing, **built but disabled** at MVP (`economy.md` §Real-money coin purchases) — enabling real purchases is a separate, later task
- [ ] 📱 Coin balance header, entry-fee confirmation, reward animation, invite share screen
- [ ] 📱 Single-scroll result screen: win/loss summary → 4 solved-group rows → 4 price-guess rounds → overlaid price chart (bottom) — see `logic/price-guess-round.md` §Result screen integration

## PLAN.md — Phase 7 — UGC phase 1 (single item suggestions)
- [ ] 🗄 `ugc_submissions`, `ugc_votes`
- [ ] 🖥 Submit item (name, year, price, source, photo), vote, admin approve → product/price_point
- [ ] 📱 "Suggest an item" form + "Review suggestions" voting feed — reachable from its **own card on the Home screen**, alongside the mode cards (owner decision, 2026-09-27)
- [ ] Coin reward on approval (ledger)
- [ ] `apps/admin` minimal moderation panel (or protected Expo web routes)

## PLAN.md — Phase 8 — Launch hardening
- [ ] Rate limiting, input size caps, abuse logging
- [ ] Error tracking (self-hosted GlitchTip/Sentry-compatible, not Google)
- [ ] Analytics (self-hosted, e.g. Umami/PostHog self-host) — match funnel, retention
- [ ] Load test: 500 concurrent matches on one instance
- [ ] Store listing for Cafe Bazaar & Myket; privacy policy (Persian)
- [ ] Backups + restore drill

## D. Owner decisions needed
- [ ] Gems currency: yes/no and what it buys (outfits, wheel by payment)
- [ ] Daily reward: random (weighted slices, same expected value) or fixed streak
- [ ] Real-money coin packages on/off (built, disabled)
- [ ] Account recovery model for phone login
- [ ] Prize tables of the wheel and the level road
- [ ] Board-size difficulty scaling (D47) sign-off and content for 3- and 5-item groups
- [ ] City crews (D53) — deferred past launch

## Suggested order
Content seed → admin-panel issues → share card → economy simulation → notes 13 / 4 / 11 → launch hardening.
