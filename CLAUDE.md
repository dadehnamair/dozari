# CLAUDE.md — «دوزاری» (Dozari)

Online multiplayer Persian puzzle game about **Iranian price nostalgia**: NYT Connections mechanic
(16 items → 4 hidden groups of 4) over historical nominal prices of Iranian products; live 1v1, 2v2,
private tables. Name/slogans/voice: `docs/brand.md` (D29); visual direction: `docs/brand-visual.md`.

Product source of truth: `docs/design-brief.fa.md`; refinements/overrides: `docs/DECISIONS.md`.
Read both before any product-level change. Roadmap: `docs/PLAN.md`. Stack: `docs/ARCHITECTURE.md`.

## Language

- Talk to the user in **Persian**. Code, identifiers, comments, commits, `docs/` specs, skills → English.
- In-game UI strings are Persian, only in `apps/mobile/src/i18n/fa.ts` (never inline in components).
  Group titles / taunts / product stories are DB content, not i18n.

## Layout (create as phases progress)

`apps/mobile` Expo RN client (RTL) · `apps/server` Fastify + Socket.io, authoritative ·
`apps/admin` (later) moderation · `apps/landing` landing site + blog (own container, no DB; `docs/logic/landing-site.md`) · `packages/shared` pure TS (types, zod, socket contracts, rules,
validator, scoring, config; no I/O) · `packages/db` Drizzle schema/migrations/seed ·
`prototype/index.html` static demo (large; read only when needed).

## Specs — read the matching one before coding (`docs/logic/`)

data-model · puzzle-generation · game-rules · matchmaking · economy · chat-and-access · ugc ·
result-chart · price-guess-round · profile-and-identity · bots · app-screens (screen-by-screen UI) ·
progression (level/XP, skill-tier puzzle difficulty) · offline-solo (cached pages, saved puzzles).
Code and spec must never diverge: fix one or the other in the same change.

## Non-negotiable rules

1. Prices are **nominal**, never inflation-adjusted.
2. Money = integer **rials** (`BIGINT`), displayed as toman. No floats (see `price-catalog` skill).
3. Years = Solar Hijri integers (`1375`); Gregorian only as display helper.
4. **Server authoritative.** Client never sees unsolved group solutions; checking/scoring/coins server-side.
5. Every puzzle has exactly one solution — `validatePuzzle` (shared) before save/serve.
6. Coins move only via append-only `coin_ledger` through one service fn. Never `UPDATE users SET coins`.
7. Play needs no invite code; free-text chat needs a redeemed one (`users.chat_unlocked_at`), else canned taunts.
8. No Google/Firebase deps (FCM, Firebase Auth, runtime Google Fonts, Maps…). Bundle fonts, self-host.
9. Economy numbers/timers/limits only in `packages/shared/src/config/*.ts`.

## Commands

```bash
pnpm install; pnpm -r typecheck; pnpm -r lint; pnpm -r test
docker compose up -d              # optional: mysql + adminer (:8080) + minio (:9001). Docker-free path: docs/LOCAL-DEV.md
pnpm --filter @dozari/server dev  # needs MySQL (docker or native)
pnpm --filter @dozari/mobile start
pnpm --filter @dozari/db db:generate  # after editing packages/db/src/schema.ts
pnpm --filter @dozari/db db:migrate
pnpm --filter @dozari/db images:upload  # seed/images/* -> MinIO (S3_* env, see .env.example)
pnpm --filter @dozari/db seed:check  # validate seed JSON; `seed` loads it (idempotent)
```
Before pushing: typecheck + lint + tests of every touched package pass.

## Conventions

TS `strict`; zod at every boundary. Game logic = pure fns in shared + unit tests; server wraps with I/O.
Socket events `domain:action`, contracts in `packages/shared/src/socket/events.ts`. IDs UUID v7;
DATETIME(3) UTC; MySQL 8, no JSON columns (D63). Game-logic randomness via injected seeded RNG. Small phase-scoped PRs; tick
`docs/PLAN.md` boxes. Open product question → record a *proposed* default in `DECISIONS.md` and
tell the user in Persian.

## Token hygiene

Read only the spec/skill for the task at hand, with line ranges for big files (`PLAN.md`,
`DECISIONS.md`, `prototype/index.html`). Search with Grep before reading whole files.
Don't restate docs in replies — link paths.
