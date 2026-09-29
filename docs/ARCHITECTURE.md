# Architecture

## Constraints driving the design

- Users are in Iran: Google/Firebase services are filtered or sanction-blocked; payment via
  international gateways is impossible. Iranian app stores: Cafe Bazaar (بازار), Myket (مایکت).
- iOS distribution from Iran is impractical (no local Apple developer account, unreliable
  alt-stores) → the **web build is a first-class target**, not an afterthought, both for iPhone
  users and for opening invite/room links without installing anything (D13).
- International connectivity can drop entirely during outages, while in-country services stay
  up → **primary hosting is inside Iran** (D16), with backups replicated abroad.
- Cloud dev-tooling accounts (Expo EAS, Docker Hub, some npm registries) can be rate-limited,
  blocked, or account-restricted from Iran → prefer **self-hosted / local-build** pipelines over
  vendor cloud services wherever the alternative isn't much extra work (D14).
- Gameplay is **turn-based and slow** → a single Node process with Socket.io is plenty for MVP.
- The team codes with heavy AI assistance → one language (TypeScript) across the whole stack.

See `docs/DECISIONS.md` D13–D18 for the tech consult these constraints came out of, and
Phase 0-A in `docs/PLAN.md` for the spikes that validate them before real code is built on top.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile | React Native + Expo (TypeScript), Expo Router | Android (Bazaar/Myket APK/AAB) **and web/PWA** built from the same codebase (D13). iOS only via the web build for now. No Google Play Services dependency. |
| Build/OTA | Local Android builds (`expo prebuild` + Gradle, or `eas build --local`); self-hosted `expo-updates` server | No dependency on Expo's EAS cloud (D14) — validated in Phase 0-A. |
| Web hosting | Static export of the Expo web build, served from the same origin/CDN as the API | Also where invite/room-code links resolve for users without the app installed. |
| State (client) | Zustand for local UI state, TanStack Query for REST | Match state comes from socket snapshots, not local truth. |
| Realtime | Socket.io (server + client); **Colyseus evaluated as an alternative** (D17) | Rooms = matches. Acks for every client→server command. Phase 0-A spikes both before Phase 4 is built. |
| API | Fastify + zod (`fastify-type-provider-zod`) | REST for catalog, profile, economy, UGC. |
| DB | MySQL 8 (utf8mb4) — interim owner choice, see D63; Postgres is the reversal path | Drizzle ORM + drizzle-kit migrations (pure TS, no binary engine download). |
| Cache/queues | In-memory for MVP → Redis when >1 server instance | Socket.io Redis adapter at that point. |
| Object storage | S3-compatible (ArvanCloud Object Storage) | Product images; CDN in front. |
| Charts | Hand-rolled `react-native-svg` (D15) | No Skia-based chart library — keeps the web build light. Must render offscreen for share image. |
| Share | `react-native-view-shot` + `expo-sharing` | |
| Auth | Guest device account (anonymous JWT) → optional phone OTP upgrade | OTP via Iranian SMS provider: Kavenegar, SMS.ir, or Ghasedak (D18). |
| Payments (later) | Cafe Bazaar / Myket IAP (Poolakey SDK) for in-app; ZarinPal (needs Enamad) for web | Not built until monetization model is decided (open question 4). |
| Error tracking | Self-hosted GlitchTip | Not Sentry SaaS or Crashlytics (D18). |
| Analytics | Self-hosted Umami or PostHog | D18. |
| Push | Deferred. Candidates: Pushe / Najva (Iranian) or none for MVP | No FCM (D18). |
| Ads (if monetized) | Tapsell, Adivery | Iranian ad networks (D18); deferred with open question 4. |
| Hosting | **Primary: ArvanCloud or ParsPack (inside Iran)**, backups replicated to an off-country location | D16 — stays reachable during international connectivity outages, lower latency for the target audience. Docker Compose: `server`, `mysql`, `redis` (later), `caddy`. |
| CI | GitHub Actions: typecheck, lint, test, build | Pin npm/Docker registry mirrors reachable from Iran once Phase 0-A experiment 4 identifies them. |

Rejected alternatives are recorded in `DECISIONS.md` (Firebase, Flutter, Supabase self-hosted,
Skia-based charts, Expo EAS cloud, hosting outside Iran).

## Module boundaries

```
packages/shared  ← pure, imported by everyone
   ├─ types/          domain types (Product, PricePoint, Puzzle, Match, ...)
   ├─ schemas/        zod schemas mirroring types
   ├─ config/         game.ts (timers, limits), economy.ts (coin amounts)
   ├─ puzzle/         group-rule evaluators, validatePuzzle, generator (RNG injected)
   ├─ game/           match reducer: (state, command) -> (state, events)
   ├─ economy/        pure calculators: entryFee(), payout(), dailyBonus()
   ├─ socket/         event name constants + payload types (client<->server contract)
   └─ format/         toman formatting, Persian digits, Jalali helpers
packages/db      ← Drizzle schema, migrations, seed; depends on shared types
apps/server      ← depends on shared + db
   ├─ http/           Fastify routes
   ├─ realtime/       socket handlers → call MatchService
   ├─ services/       MatchService, MatchmakingService, LedgerService, PuzzleService, ChatService, UgcService
   └─ jobs/           puzzle pre-generation, daily resets
apps/mobile      ← depends on shared only (never db)
```

### Match engine pattern

The match is an in-memory state machine owned by `MatchService` on the server:

1. Socket handler validates payload with zod → `MatchService.handle(matchId, command)`.
2. `MatchService` calls the pure reducer `applyCommand(state, command, ctx)` from `packages/shared/game`.
3. Reducer returns `{ state, events }`. Service persists key events (guess log, result) to MySQL,
   then broadcasts **redacted** snapshots per recipient (never reveal unsolved groups).
4. Timers (turn timeout) are server-side; on fire they enqueue a `timeout` command into the same path.

Because the reducer is pure, every rule in `docs/logic/game-rules.md` is unit-testable without sockets.

### Redaction rule

`toClientView(state, viewerId)` is the ONLY function allowed to produce data sent to clients. It
strips `groups[].itemIds` / `rule` / `title` for unsolved groups and strips all price data until the
match is finished.

## Deployment (MVP)

- One VM: Docker Compose with Caddy (TLS) → server (Node 22) → MySQL (volume, nightly `mysqldump` to object storage).
- Images served from object storage + CDN; the app caches them.
- Environment config via `.env` (never committed). `.env.example` documents keys.
