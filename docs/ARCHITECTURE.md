# Architecture

## Constraints driving the design

- Users are in Iran: Google/Firebase services are filtered or sanction-blocked; payment via
  international gateways is impossible. Iranian app stores: Cafe Bazaar (بازار), Myket (مایکت).
- Gameplay is **turn-based and slow** → a single Node process with Socket.io is plenty for MVP.
- The team codes with heavy AI assistance → one language (TypeScript) across the whole stack.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile | React Native + Expo (TypeScript), Expo Router | Android first (Bazaar/Myket APK/AAB). iOS later (sideload/web). No Google Play Services dependency. |
| Web (optional) | Expo web build of same app | Cheap distribution channel for iOS users; share links land here. |
| State (client) | Zustand for local UI state, TanStack Query for REST | Match state comes from socket snapshots, not local truth. |
| Realtime | Socket.io (server + client) | Rooms = matches. Acks for every client→server command. |
| API | Fastify + zod (`fastify-type-provider-zod`) | REST for catalog, profile, economy, UGC. |
| DB | PostgreSQL 16 | Drizzle ORM + drizzle-kit migrations (pure TS, no binary engine download). |
| Cache/queues | In-memory for MVP → Redis when >1 server instance | Socket.io Redis adapter at that point. |
| Object storage | S3-compatible (ArvanCloud Object Storage) | Product images; CDN in front. |
| Charts | `react-native-svg` + `victory-native` (or hand-rolled SVG) | Must render offscreen for share image. |
| Share | `react-native-view-shot` + `expo-sharing` | |
| Auth | Guest device account (anonymous JWT) → optional phone OTP upgrade | OTP via Iranian SMS provider (e.g. Kavenegar / SMS.ir). |
| Push | Deferred. Candidates: Pushe / Najva (Iranian) or none for MVP | No FCM. |
| Hosting | ArvanCloud (IaaS/Container) or non-sanctioning foreign VPS | Docker Compose: `server`, `postgres`, `redis` (later), `caddy`. |
| CI | GitHub Actions: typecheck, lint, test, build | |

Rejected alternatives are recorded in `DECISIONS.md` (Firebase, Flutter, Supabase self-hosted).

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
3. Reducer returns `{ state, events }`. Service persists key events (guess log, result) to Postgres,
   then broadcasts **redacted** snapshots per recipient (never reveal unsolved groups).
4. Timers (turn timeout) are server-side; on fire they enqueue a `timeout` command into the same path.

Because the reducer is pure, every rule in `docs/logic/game-rules.md` is unit-testable without sockets.

### Redaction rule

`toClientView(state, viewerId)` is the ONLY function allowed to produce data sent to clients. It
strips `groups[].itemIds` / `rule` / `title` for unsolved groups and strips all price data until the
match is finished.

## Deployment (MVP)

- One VM: Docker Compose with Caddy (TLS) → server (Node 22) → Postgres (volume, nightly `pg_dump` to object storage).
- Images served from object storage + CDN; the app caches them.
- Environment config via `.env` (never committed). `.env.example` documents keys.
