---
name: multiplayer-realtime
description: Implement or debug real-time multiplayer — Socket.io events, the server-authoritative match state machine, turns and timers, 1v1/2v2 queues, private room codes, reconnects, redaction of hidden info. Use for anything touching apps/server/realtime, MatchService, MatchmakingService, packages/shared/game or socket contracts, or requests like «حالت دونفره» / «مچ‌میکینگ» / «اتاق خصوصی».
---

# Multiplayer & realtime

Specs: `docs/logic/game-rules.md`, `docs/logic/matchmaking.md`, `docs/ARCHITECTURE.md` §Match engine.

## Architecture in one breath

socket handler (zod-validate, auth) → `MatchService.handle(matchId, cmd)` → pure
`applyCommand(state, cmd, ctx)` from `packages/shared/game` → persist events → broadcast
`toClientView(state, viewerId)` per socket. Timers enqueue `{t:'timeout', turnId}` into the same path.

## Rules

1. **Server authoritative.** Clients send intents only. Never trust client scores, timers, or results.
2. **Redaction:** only `toClientView` builds outgoing match payloads. Unit-test that unsolved group
   membership, rules, titles, and all prices are absent before `finished`. Grep your diff for any
   `io.to(...).emit` with raw state — that's a bug.
3. **Contracts** in `packages/shared/src/socket/events.ts` (event name consts + zod payloads + ack types).
   Add events there first; both apps import them. Naming `domain:action`.
4. **Every command has an ack** `{ok:true, ...} | {ok:false, error: ErrorCode}`. Error codes are an enum
   in shared, localized on the client in `fa.ts`.
5. **Serialize per match:** process commands for one match sequentially (per-match promise queue) to avoid
   races (double submit, timeout vs submit). Stale `turnId` timeouts are ignored.
6. **Snapshots, not diffs:** send the full redacted view on each change (tiny payload); plus `match:event`
   for animations. Client renders from latest snapshot — idempotent and reconnect-safe.
7. **Reconnect:** `match:resume` → full snapshot. Clock keeps running. Grace window from config.
8. **Coins:** escrow at start / payout at end via LedgerService with idempotency keys (see `coin-economy`).
9. **Single instance now:** in-memory match registry + queues. Keep them behind interfaces
   (`MatchStore`, `QueueStore`) so a Redis implementation can drop in later.

## Testing recipe

- Reducer: table-driven tests per rule in game-rules.md (turn keeping on correct, pass on wrong, one-away,
  lockout at max mistakes, auto-reveal of last group, tie-breaks, forfeit after 2 timeouts, team captain rotation).
- Integration: start Fastify+Socket.io on a random port, connect 2 (or 4) `socket.io-client`s with test JWTs,
  drive a full match with a fixed-seed puzzle, assert final ledger rows.
- Use fake timers (vitest) for turn timeouts.
