# Decisions (ADR log) & open questions

Status values: **accepted** (from the brief or confirmed by the owner), **proposed** (default chosen
by Claude to unblock work — owner may override), **superseded**.

When the owner confirms or changes a proposed decision, update the status here and adjust the
matching spec in `docs/logic/`.

## Decisions

| # | Decision | Status | Rationale |
|---|---|---|---|
| D1 | No Firebase / Google Cloud | accepted | Filtering + sanctions in Iran (brief). |
| D2 | React Native (Expo) over Flutter | accepted | JS ecosystem, AI-assisted coding, single language with Node backend (brief). |
| D3 | Custom Node.js + Socket.io + Postgres backend instead of self-hosted Supabase | proposed | Brief allowed both. Custom backend keeps game logic in one TS codebase, fewer moving parts to self-host (Supabase = ~10 containers), realtime match logic needs a custom authoritative server anyway. Revisit if admin/CRUD needs explode. |
| D4 | Drizzle ORM | proposed | Pure TS, no engine binary download (Prisma engines download can fail from Iran). |
| D5 | Prices stored as integer **rials** (`BIGINT`), displayed as toman | proposed | Brief says "toman, nominal". Rial integers avoid fractional toman for very old prices (e.g. 5 rials = 0.5 toman) and are unambiguous across the new-toman redenomination. Display layer converts. Nominality is unchanged. |
| D6 | Years stored as Solar Hijri integers | proposed | Content & players think in شمسی ("سال ۷۵"). |
| D7 | Guest accounts first, phone OTP optional | proposed | Brief: entry must be completely free/frictionless. |
| D8 | **Shared board, alternating turns** for competitive matches | proposed | Brief says gameplay is turn-based/slow; a shared board makes it a real head-to-head (steal groups from the opponent) and gives 2v2 teams something to coordinate on. Alternative (parallel race on separate boards) documented in `logic/game-rules.md` §Alternatives. |
| D9 | Coin amounts per `logic/economy.md` defaults | **accepted** (2026-09-27) | Brief left formula open (open question 1). Owner confirmed the launch defaults as-is, on the condition every number stays a config value (never hardcoded) so they're tunable post-launch. All values in `packages/shared/src/config/economy.ts`. |
| D10 | Free chat gated by *redeemed* invite code; canned taunts for everyone | accepted | Brief. Visibility details in `logic/chat-and-access.md` are **proposed**. |
| D11 | Group titles are witty/indirect; hidden rule is objective and machine-checkable | proposed | Title = flavor (brief), rule = what validator checks. Keeps "infinite puzzles" solvable & fair. |
| D12 | No ELO at start; FIFO queue with widening wait | accepted | Brief. |
| D13 | Expo (React Native) ships **web (PWA) as a first-class target**, not just Android | accepted | Owner-approved tech consult (2026-09-26). iOS distribution from Iran is impractical (no Apple developer account, unreliable alt-stores); web covers iPhone users and makes invite/room-code links openable without installing anything — important for the growth loop. |
| D14 | **Build and OTA-update pipeline is self-hosted**, not EAS cloud | accepted | Same consult. EAS (Expo's cloud build/update service) may be unreachable or account-restricted from Iran. Use local builds (`expo prebuild` + Gradle, or `eas build --local`) and a self-hosted `expo-updates` server for OTA. |
| D15 | Chart library: hand-rolled `react-native-svg`, no Skia-based chart lib | accepted | Same consult. Skia-based chart libraries (e.g. Wagmi/Reanimated-Skia charts) are heavy on the web build; SVG works identically across Android and web. Supersedes the `victory-native` option listed in ARCHITECTURE.md §Stack — keep as fallback only if hand-rolled SVG proves insufficient. |
| D16 | Primary server hosting **inside Iran** (ArvanCloud or ParsPack), with off-country backups | accepted | Same consult. During international connectivity outages, only in-country services stay reachable; in-country hosting also lowers latency for the target audience. Backups replicated outside Iran for disaster recovery. |
| D17 | Evaluate **Colyseus** as an alternative to hand-rolled Socket.io room/match logic | proposed | Same consult. Colyseus is a purpose-built Node multiplayer room framework (matchmaking, state sync, reconnection) that could remove custom code from `MatchmakingService`/`MatchService`. Time-boxed to ~1 day of spike (Phase 0-A, experiment 2) before committing; plain Socket.io (current ARCHITECTURE.md default) remains the fallback if Colyseus doesn't fit the turn-based/redaction model cleanly. |
| D18 | Iranian-first vendor list for payments, SMS OTP, error tracking, analytics, push, ads | accepted | Same consult. Payments: Cafe Bazaar/Myket IAP (Poolakey) for in-app purchases, ZarinPal (needs Enamad) for web. SMS OTP: Kavenegar, SMS.ir, Ghasedak. Error tracking: self-hosted GlitchTip (not Sentry SaaS/Crashlytics). Analytics: self-hosted Umami or PostHog. Push (if built): Pushe or Najva. Ads (if/when monetization is decided, see open question 4): Tapsell, Adivery. |
| D19 | Add a **price-guess bonus round** after every puzzle (solo: 5-tier staircase scoring; competitive: blind-simultaneous, closest-wins, 4 rounds) | accepted | Owner request (2026-09-27), resolves open question "رقابت قیمتی" — a guess-the-exact-price mode was referenced in the brief's market research but never designed as a mode. Folded into the existing puzzle flow rather than a separate top-level mode. Full spec: `docs/logic/price-guess-round.md`. |
| D20 | Nickname & avatar are **gallery-picked only** (never free text), random at signup, customization unlocks at 3 games (avatar) / 10 games (nickname) | accepted | Owner request (2026-09-27). Removes free-text nickname moderation risk entirely; the play-count unlock is a light progression hook. Full spec: `docs/logic/profile-and-identity.md`. |
| D21 | Profile carries **tags** (achievement / skill-rank / special / self-equipped) next to the avatar | accepted | Owner request (2026-09-27). One equipped at a time from the user's earned set. Full spec: `docs/logic/profile-and-identity.md`. |
| D22 | Phone-number linking (OTP) is **fully optional**, account-recovery only, never a gate on any feature | accepted | Owner request (2026-09-27), refines D7. Entry point is a profile-screen button, not onboarding. |
| D23 | Matchmaking is backed by an **undisclosed pool of AI opponents ("bots")** that fill queues when no human is available | accepted | Owner request (2026-09-27): "کاملاً شبیه آدم واقعی جلوه بره" — always available, human-like randomized delay, never revealed as a bot in any UI/API surface. Because this touches real coin stakes, a subsidy mechanism (`bot_match_subsidy` ledger reason) keeps payout math fair to the human player — see `docs/logic/bots.md` §Economy interaction. Chat is canned-taunts-only for MVP (no live LLM in the realtime path). |
| D24 | Price-guess rounds carry a **real coin wager** (2–5 coins/round, escrowed per round, winner takes the pot minus house cut) in competitive modes | accepted | Owner request (2026-09-27) — the "شرط‌بندی" (betting) flavor the owner liked earlier now has real stakes, not just match-score points. Solo has no wager. Full spec: `docs/logic/price-guess-round.md` §Real coin side-bet. |
| D25 | Design the **coin-package IAP schema now** (`coin_packages` table, Cafe Bazaar/Myket billing, `purchase` ledger reason with server-side receipt verification), without building or enabling it at MVP | accepted | Owner request (2026-09-27): "از همین الان براش جا باز کنیم در طراحی." Whether/when to turn purchases on is still open question 4 — this decision is only about not needing a schema retrofit later. Full spec: `docs/logic/economy.md` §Real-money coin purchases. |
| D26 | Bootstrap catalog sourcing: **manual/AI-assisted archive research + personal/family memories**, both allowed until UGC carries the load | accepted | Owner request (2026-09-27). AI research suggestions land as `status: pending`, never auto-approved — human verifies before publish. Full spec: `price-catalog` skill §Bootstrap sourcing. |
| D27 | **Hand-curate 50–100 puzzles first**, generator built afterward to imitate that style; group titles are **AI-drafted, owner-approved** (never auto-published) | accepted | Owner request (2026-09-27): quality/tone bar set by humans before automating. Full spec: `docs/logic/puzzle-generation.md` §Content bootstrap order. |
| D28 | Brand mood = **nostalgia + playfulness combined** (warm aged-paper base + the bright Connections group colors as accents); Vazirmatn for UI, a **separate nostalgic display font for titles/brand** (family TBD); app icon/logo deferred | accepted (direction) / open (specific tokens) | Owner request (2026-09-27). Group colors were already locked in `persian-rtl-ui` skill; this decision is the *mood* and the *two-font system*, not final hex/font-family values — those are explicitly still open. Full spec: `docs/BRAND.md`. |
| D29 | Final game name: **«دوزاری» (Dozari)**, code identifier `dozari`, deep-link scheme `dozari://`, primary tagline «دوزاریت می‌افته؟» | accepted | Owner choice (2026-09-27), resolves open question 5. Double meaning: the old 2-rial payphone coin (price nostalgia = content) and «دوزاریت افتاد؟» = "did the penny drop?" (the Connections aha moment = mechanic). Repo/internal scaffolding may still reference the earlier `gheymat` codename in places; `dozari` is the product-facing identifier going forward. Store/domain availability still to be checked. Full name, slogans, voice, and approved copy: `docs/brand.md`. |
| D30 | Turn model (D8) reconfirmed as final: **shared board, alternating turns**, not parallel race | accepted | Owner confirmed (2026-09-27), resolves open question 6. No change to `logic/game-rules.md` mechanics — the "Alternatives" section stays for reference only. |
| D31 | Locked-out side that stays to the end and wins price-guess rounds gets a **small consolation bonus score** (never enough to overturn a puzzle-portion loss) | accepted | Owner request (2026-09-27), resolves open question 9. A side that forfeits/abandons gets no bonus. Full spec: `logic/game-rules.md` §Price-guess bonus points & the locked-out side. |
| D32 | Min content for launch confirmed: **≥ 300 products (≥ 3 price points each) + ≥ 200 validated puzzles pre-generated** | accepted | Owner confirmed (2026-09-27) as the launch target, resolves open question 7. Hand-curated 50–100 (D27) is the earlier internal MVP/tone-setting milestone within this larger target, not a separate lower bar. |

## Phase 0-A spike: de-risk the stack before Phase 0 scaffolding

Owner-approved (2026-09-26). Do these ~3–5 days of experiments first; their results can still
flip D13–D17 before real code is built on top of them. Tracked as checkboxes in `docs/PLAN.md`
Phase 0-A. Each experiment gets a short write-up appended to this section (date, result, verdict).

1. Expo app with RTL + bundled Vazirmatn, **local** Android build (no EAS cloud), installed on
   ≥2 real devices; same code exported to web/PWA and opened in mobile Safari (iPhone). Confirms D2, D13.
2. Minimal Socket.io server on ArvanCloud, hit from Irancell/Hamrah-e-Avval mobile data; measure
   latency and reconnect behavior. Spend ≤1 day comparing against a Colyseus equivalent (D17).
3. Self-hosted `expo-updates` OTA server: push a change, confirm it reaches an installed build
   without a store re-submission. Confirms D14.
4. Try `npm install` / `docker pull` from an Iranian network path (or via the project's CI); note
   which registries/mirrors need to be pinned in `.npmrc` / `Dockerfile` for reproducible installs.

If experiment 1 fails badly (Expo web output is unusable), fall back to a plain React (Vite) web
app wrapped with Capacitor for the Android build — record that pivot here as a superseding decision.

## Open questions (from the brief + new)

Resolved: ~~final game name~~ (D29), ~~turn model confirmation~~ (D30), ~~price-guess tie-break
precedence~~ (D31), ~~min content for launch~~ (D32) — see Decisions table above.

1. **Exact scoring / coin formula** — defaults proposed (D9). Needs playtesting.
2. **Sources for historical prices** — deferred. Schema already has `source_type`, `source_url`, `source_note`, `confidence`.
3. **Team chat vs cross-team chat visibility** — proposed in `logic/chat-and-access.md`.
4. **Long-term monetization** (ads / subscription / coin packs) — the *schema and integration plan* for
   coin packs is now decided (D25, `economy.md` §Real-money coin purchases); *whether/when* to actually
   enable real-money purchases, ads, or a subscription is still open. Iranian IAP = Cafe Bazaar / Myket
   billing SDKs; Iranian ad networks (Tapsell, Adivery). Don't build/enable until decided.
5. **Moderation capacity for UGC & free chat** — who reviews? Proposed: admin panel + community votes threshold.
6. **Bot economy subsidy mechanism** (D23) — `bot_match_subsidy` ledger reason and its exact
    accounting are proposed, not yet balanced/simulated. Run through
    `packages/shared/scripts/simulate-economy.ts` once bots are built (Phase 4/6).
7. **Bot pool sizing & fallback timing** (`BOT_POOL_SIZE`, `BOT_FALLBACK_SECONDS`) — defaults
    proposed in `docs/logic/bots.md`, to be tuned with real queue-wait data after launch.
8. **Full app-screen inventory** — an in-progress owner interview (2026-09-27) is going
    screen-by-screen through onboarding, home/lobby, private tables, queue, match, chat, result,
    profile, invite, and UGC. Decisions land here and in `docs/logic/` as each screen closes;
    not all screens are covered yet (see `docs/PLAN.md` for what's locked vs. still open).
9. **Exact `PRICE_GUESS_ROUND_WAGER`** pinned value (D24 sets a 2–5 coin range, not a single
   number) and full economy simulation once bots/wagers are implemented.
10. **Nostalgic display font, base "paper" color tokens, primary accent color, app icon/logo** —
    all explicitly deferred in `docs/BRAND.md`.
11. **Admin panel screens** — not yet interviewed.
