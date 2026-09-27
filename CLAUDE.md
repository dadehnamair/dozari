# CLAUDE.md — "Gheymatesh Chand Bood?" (قیمتش چند بود؟) — working title

Online multiplayer Persian puzzle game about **Iranian price nostalgia**.
Mechanic = NYT Connections (16 items → 4 hidden groups of 4), content = historical nominal
prices of Iranian products, format = live social competition (1v1, 2v2, private tables).

The product source of truth is `docs/design-brief.fa.md` (Persian). Decisions that refine or
override it live in `docs/DECISIONS.md`. Read both before any product-level change.

## Language rules (important)

- **Talk to the user in Persian (فارسی).** All explanations, summaries, questions, PR
  descriptions aimed at the user → Persian.
- **Internal/engineering text in English:** code, identifiers, code comments, commit messages,
  this file, skills, `docs/` specs (except the Persian brief).
- **All in-game UI strings are Persian**, stored in `apps/mobile/src/i18n/fa.ts` — never
  hard-code Persian text inside components. Group titles / taunts / product stories are
  content (DB), not i18n.

## Repo map (target layout — create as phases progress; see `docs/PLAN.md`)

```
apps/
  mobile/        React Native (Expo, TypeScript) client — RTL, Persian
  server/        Node.js (Fastify + Socket.io) — authoritative game server + REST
  admin/         (later) small web panel for catalog/UGC moderation
packages/
  shared/        Pure TS: types, zod schemas, socket event contracts, game rules,
                 puzzle validator, scoring, economy config. NO I/O, NO platform deps.
  db/            Drizzle ORM schema + migrations + seed (Postgres)
docs/
  design-brief.fa.md   product brief (Persian, source of truth)
  PLAN.md              phased roadmap with checkboxes
  ARCHITECTURE.md      stack, deployment, module boundaries
  DECISIONS.md         ADR log + open questions
  logic/               precise game logic specs (read the relevant one before coding)
```

## Logic specs — read before touching the matching code

| Topic | Spec |
|---|---|
| Data model (products, price history, puzzles, users, ledger) | `docs/logic/data-model.md` |
| Puzzle structure, group rules, generation, validation | `docs/logic/puzzle-generation.md` |
| Match flow, turns, guesses, mistakes, scoring, win condition | `docs/logic/game-rules.md` |
| Queues, 1v1/2v2 matching, private table codes, reconnects | `docs/logic/matchmaking.md` |
| Coins: faucets, sinks, ledger, anti-abuse | `docs/logic/economy.md` |
| Invite codes, free chat vs canned taunts, team/cross-team visibility | `docs/logic/chat-and-access.md` |
| User-submitted items/puzzles, voting, moderation | `docs/logic/ugc.md` |
| Post-match overlaid price chart & sharing | `docs/logic/result-chart.md` |
| Price-guess bonus round (after every puzzle) | `docs/logic/price-guess-round.md` |
| Profile, avatar/nickname galleries, tags, phone link | `docs/logic/profile-and-identity.md` |
| Undisclosed AI opponents ("bots") in matchmaking | `docs/logic/bots.md` |

If code and spec disagree, fix the code **or** update the spec in the same change — never
leave them diverged.

## Skills (`.claude/skills/`)

- `feature-workflow` — default procedure for any feature: spec → shared logic → server → client → tests.
- `puzzle-design` — authoring/validating puzzles, group rules, witty Persian titles, difficulty colors.
- `price-catalog` — adding products & price points, units (rial/toman), Jalali years, sources.
- `multiplayer-realtime` — Socket.io events, server-authoritative match state machine, reconnects.
- `coin-economy` — any change that grants/spends coins; ledger invariants; balancing.
- `persian-rtl-ui` — RTL layout, Persian digits/number formatting, fonts, i18n.
- `result-chart` — the overlaid price-history line chart and screenshot/share flow.

## Non-negotiable domain rules

1. **Prices are nominal (اسمی/خام), never inflation-adjusted.** The nostalgic shock comes from raw numbers.
2. **Store money as integer rials (`BIGINT`), display in toman.** Never floats. See `price-catalog` skill
   (also handles the new-toman redenomination question).
3. **Years are Solar Hijri (شمسی) integers** (e.g. `1375`). Gregorian only as a derived display helper.
4. **Server is authoritative.** Client never knows the solution of an unsolved group; it only receives
   item ids + display data. Guess checking, scoring, coin changes happen server-side.
5. **Every puzzle must have exactly one valid solution** — run the validator in `packages/shared`
   (`validatePuzzle`) before a puzzle is saved or served.
6. **Coins only move through the append-only `coin_ledger`** via one service function. Balance = sum of ledger.
   Never `UPDATE users SET coins = ...`.
7. **Login/play and free chat are independent.** Anyone can play without an invite code; free-text chat
   requires a redeemed invite code (`users.chat_unlocked_at`). Otherwise only canned taunts.
8. **No Google/Firebase dependencies** (FCM, Firebase Auth, Google Fonts at runtime, Google Maps, etc.) —
   unreliable in Iran. Bundle fonts; use self-hosted services. Push notifications: see ARCHITECTURE.md.
9. Economy numbers, timers, and limits live in `packages/shared/src/config/*.ts` — no magic numbers in
   server/client code.

## Commands (fill in once Phase 0 scaffolding exists — keep this section accurate)

```bash
pnpm install              # install all workspaces
pnpm -r typecheck         # tsc --noEmit everywhere
pnpm -r lint              # eslint
pnpm -r test              # vitest (shared, server); jest-expo (mobile)
pnpm --filter server dev  # run server (needs Postgres; see docker-compose.yml)
pnpm --filter mobile start
pnpm --filter db migrate  # drizzle-kit migrate
pnpm --filter db seed     # load sample catalog + puzzles
```

Before pushing: typecheck + lint + tests of every touched package must pass.

## Coding conventions

- TypeScript `strict` everywhere. zod schemas at every boundary (socket payloads, REST bodies, DB seeds).
- Game logic = pure functions in `packages/shared` with unit tests; server wraps them with I/O.
- Socket event names: `domain:action` (e.g. `match:guess`, `queue:join`). Contracts in
  `packages/shared/src/socket/events.ts` — both client and server import the same types.
- IDs: UUID v7 (sortable). Timestamps: `timestamptz`, UTC.
- Randomness in game logic takes an injected seeded RNG so tests are deterministic.
- Keep PRs small and phase-scoped; tick checkboxes in `docs/PLAN.md` when a task is done.

## Open questions

Tracked in `docs/DECISIONS.md` → "Open questions". When you make a default choice for one, record it
there as a *proposed* decision and tell the user (in Persian) so they can override it.
