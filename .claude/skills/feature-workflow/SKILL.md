---
name: feature-workflow
description: Default step-by-step procedure for implementing any feature or task in the price-quiz game «دوزاری» (Dozari). Use whenever starting work on a PLAN.md task, a new game rule, screen, endpoint, socket event, or DB change — even if the user just says "بساز" / "implement X" / "next phase".
---

# Feature workflow

Follow in order. Skip a step only if it truly doesn't apply, and say so.

1. **Locate the task** in `docs/PLAN.md` (phase + checkbox). If it isn't there, add it to the right phase.
2. **Read the spec** in `docs/logic/*.md` for the area (table in `CLAUDE.md`). Also check
   `docs/DECISIONS.md` for proposed/accepted decisions touching it.
   - Spec missing or ambiguous → write/extend the spec first. If the ambiguity is a product decision,
     pick a sensible default, record it as **proposed** in DECISIONS.md, and tell the user in Persian.
3. **Shared first** (`packages/shared`): types → zod schemas → config constants → pure logic → unit tests
   (vitest). Inject RNG/clock; no I/O.
4. **DB** (`packages/db`): Drizzle schema change + generated migration + seed update. Never edit an
   applied migration; add a new one.
5. **Server** (`apps/server`): service wraps shared logic; handlers validate with zod; coins only via
   LedgerService; outgoing match data only via `toClientView`.
6. **Mobile** (`apps/mobile`): strings in `src/i18n/fa.ts`; follow `persian-rtl-ui` skill; server state
   is the truth — no optimistic game results.
7. **Tests**: unit (shared), integration (server, incl. two fake socket clients for match flows).
8. **Verify**: `pnpm -r typecheck && pnpm -r lint && pnpm -r test` (only touched packages is OK while iterating,
   full run before push).
9. **Docs sync**: spec updated if behavior changed; tick PLAN.md checkbox; update CLAUDE.md commands if new ones.
10. **Commit** in English, imperative, scoped: `feat(shared): add price_band_at_year evaluator`.
11. **Report to the user in Persian**: what was done, what's proposed/open, how to test it.

## Related skills
`puzzle-design`, `price-catalog`, `multiplayer-realtime`, `coin-economy`, `persian-rtl-ui`, `result-chart`.
