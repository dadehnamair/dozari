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
| D9 | Coin amounts per `logic/economy.md` defaults | proposed | Brief left formula open (open question 1). All values in `packages/shared/src/config/economy.ts`. |
| D10 | Free chat gated by *redeemed* invite code; canned taunts for everyone | accepted | Brief. Visibility details in `logic/chat-and-access.md` are **proposed**. |
| D11 | Group titles are witty/indirect; hidden rule is objective and machine-checkable | proposed | Title = flavor (brief), rule = what validator checks. Keeps "infinite puzzles" solvable & fair. |
| D12 | No ELO at start; FIFO queue with widening wait | accepted | Brief. |
| D13 | Expo (React Native) ships **web (PWA) as a first-class target**, not just Android | accepted | Owner-approved tech consult (2026-09-26). iOS distribution from Iran is impractical (no Apple developer account, unreliable alt-stores); web covers iPhone users and makes invite/room-code links openable without installing anything — important for the growth loop. |
| D14 | **Build and OTA-update pipeline is self-hosted**, not EAS cloud | accepted | Same consult. EAS (Expo's cloud build/update service) may be unreachable or account-restricted from Iran. Use local builds (`expo prebuild` + Gradle, or `eas build --local`) and a self-hosted `expo-updates` server for OTA. |
| D15 | Chart library: hand-rolled `react-native-svg`, no Skia-based chart lib | accepted | Same consult. Skia-based chart libraries (e.g. Wagmi/Reanimated-Skia charts) are heavy on the web build; SVG works identically across Android and web. Supersedes the `victory-native` option listed in ARCHITECTURE.md §Stack — keep as fallback only if hand-rolled SVG proves insufficient. |
| D16 | Primary server hosting **inside Iran** (ArvanCloud or ParsPack), with off-country backups | accepted | Same consult. During international connectivity outages, only in-country services stay reachable; in-country hosting also lowers latency for the target audience. Backups replicated outside Iran for disaster recovery. |
| D17 | Evaluate **Colyseus** as an alternative to hand-rolled Socket.io room/match logic | proposed | Same consult. Colyseus is a purpose-built Node multiplayer room framework (matchmaking, state sync, reconnection) that could remove custom code from `MatchmakingService`/`MatchService`. Time-boxed to ~1 day of spike (Phase 0-A, experiment 2) before committing; plain Socket.io (current ARCHITECTURE.md default) remains the fallback if Colyseus doesn't fit the turn-based/redaction model cleanly. |
| D18 | Iranian-first vendor list for payments, SMS OTP, error tracking, analytics, push, ads | accepted | Same consult. Payments: Cafe Bazaar/Myket IAP (Poolakey) for in-app purchases, ZarinPal (needs Enamad) for web. SMS OTP: Kavenegar, SMS.ir, Ghasedak. Error tracking: self-hosted GlitchTip (not Sentry SaaS/Crashlytics). Analytics: self-hosted Umami or PostHog. Push (if built): Pushe or Najva. Ads (if/when monetization is decided, see open question 4): Tapsell, Adivery. |

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

1. **Exact scoring / coin formula** — defaults proposed (D9). Needs playtesting.
2. **Sources for historical prices** — deferred. Schema already has `source_type`, `source_url`, `source_note`, `confidence`.
3. **Team chat vs cross-team chat visibility** — proposed in `logic/chat-and-access.md`.
4. **Long-term monetization** (ads / subscription / coin packs) — open. Iranian IAP = Cafe Bazaar / Myket billing SDKs; Iranian ad networks (Tapsell, Adivery). Don't build until decided.
5. **Final game name** — open. Working title everywhere: `gheymat` (code), «قیمتش چند بود؟» (UI).
6. **Turn model (D8)** confirmed? shared-board-alternating vs parallel race.
7. **Min content for launch** — proposed: ≥ 300 products with ≥ 3 price points each, ≥ 200 validated puzzles pre-generated.
8. **Moderation capacity for UGC & free chat** — who reviews? Proposed: admin panel + community votes threshold.
