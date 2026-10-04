# Dozari — brief for another agent

One-page orientation. Authoritative sources: `CLAUDE.md` (rules), `docs/design-brief.fa.md` (product),
`docs/DECISIONS.md` (overrides, D-numbers), `docs/ARCHITECTURE.md` (stack), `docs/HANDOFF.md` (latest state),
`docs/GAPS.md` (what is left), `docs/PLAN.md` (roadmap; partly stale).

## What it is
«دوزاری» — Persian online multiplayer puzzle game about Iranian price nostalgia. NYT-Connections mechanic:
16 products → 4 hidden groups of 4, based on historical **nominal** prices. Modes: 1v1, 2v2 (team, 3 boards),
private tables, solo/daily puzzle, tournaments. Also: coins economy, shop, lucky wheel, levels/XP, badges,
friends/chat, UGC, bots, post-match price chart + share card, Bale bot.

## Stack
- Monorepo: pnpm workspaces, TypeScript `strict`, Node 22, ESLint/Prettier, GitHub Actions CI.
- `apps/mobile`: React Native + Expo (Expo Router), forced RTL, bundled Vazirmatn font. Targets Android APK
  (Bazaar/Myket, local build via prebuild + Gradle, no EAS) **and web/PWA** (iOS users use web). Zustand + TanStack Query,
  hand-rolled `react-native-svg` charts, `view-shot` + `expo-sharing`.
- `apps/server`: Fastify + zod, Socket.io (authoritative match state machine), modules under `src/`
  (duel, tables, economy, ledger, wheel, tournament, bot, chat, notify, admin...).
- `packages/shared`: pure TS only (types, zod, socket contracts `socket/events.ts`, game reducer, validator,
  scoring, economy calculators, `config/*.ts`, format helpers). No I/O.
- `packages/db`: Drizzle ORM + drizzle-kit migrations, **MySQL 8** (utf8mb4, no JSON columns), seed + image upload (S3/MinIO).
- Infra: Docker Compose (`docker-compose.yml` dev, `docker-compose.prod.yml` prod), Caddy/nginx, hosting inside Iran.
- Auth: guest device JWT + phone OTP (Iranian SMS providers). Errors/analytics self-hosted.

## Non-negotiable rules
1. Prices nominal, never inflation-adjusted. 2. Money = integer rials (BIGINT), shown as toman; no floats.
3. Years = Solar Hijri ints. 4. Server authoritative; clients never see unsolved groups.
5. Every puzzle has exactly one solution (`validatePuzzle`). 6. Coins only via append-only `coin_ledger` service fn.
7. Free-text chat needs redeemed invite code, else canned taunts. 8. **No Google/Firebase** deps or runtime Google Fonts.
9. Economy/timers/limits only in `packages/shared/src/config/*.ts`.

## Conventions
- Talk to owner in Persian; code, comments, commits, docs in English. UI strings only in `apps/mobile/src/i18n/fa.ts`.
- Socket events `domain:action`; IDs UUID v7; DATETIME(3) UTC; seeded injected RNG for game logic.
- Game logic = pure fns in shared + unit tests; server wraps I/O. Code and `docs/logic/*.md` spec must not diverge.
- Read the matching spec in `docs/logic/` and skill (`.claude/skills`) before coding. Screens follow `docs/design/*.dc.html` (D99).
- Small PRs; one DECISIONS entry per feature; new open question → proposed default in DECISIONS.md.

## Commands
```bash
pnpm install; pnpm -r typecheck; pnpm -r lint; pnpm -r test     # must pass before pushing
pnpm --filter @dozari/server dev       # needs MySQL (docker compose up -d, or docs/LOCAL-DEV.md)
pnpm --filter @dozari/mobile start
pnpm --filter @dozari/db db:generate | db:migrate | seed | seed:check
```

## Current state (see HANDOFF.md for detail)
Most features built and merged on `main` (2v2, wheel, tournaments, phone login, bots, admin, Android build workflow).
Unverified from sandbox: real device, live-MySQL migrations/seed, real SMS. Open: finish duel loop (price round, chart,
share card), shop coin tab, `ErrorCard` on remaining screens, real catalogue (~150 products x >=3 price years;
current data is sample seed), PLAN.md ticks. Full list: `docs/GAPS.md`.

## Deploy
Owner's server runs `docker-compose.prod.yml` + `.env.prod`; see `docs/deploy.md`.
