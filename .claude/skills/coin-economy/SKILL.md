---
name: coin-economy
description: Any change that grants, spends, escrows, refunds, or displays coins (سکه) — entry fees, payouts, daily bonuses, invite rewards, UGC rewards, balancing faucet/sink numbers, the coin_ledger. Use whenever code touches LedgerService, config/economy.ts, or the user asks about coin amounts or «اقتصاد سکه».
---

# Coin economy

Spec: `docs/logic/economy.md`. Numbers are **proposed** (D9) — the owner may change them.

## Invariants (never break)

1. Coins move **only** through `LedgerService.apply()` → one row in `coin_ledger`. No direct balance updates.
2. Ledger is append-only. Corrections = new compensating rows (`admin_adjust`), never UPDATE/DELETE.
3. Every movement has a deterministic `idempotency_key` (`<reason>:<refId>:<userId>`). Retrying a
   payout must be a no-op.
4. Balance never negative; check inside the same transaction with a row lock.
5. Amounts come from `packages/shared/src/config/economy.ts`; pure calculators in
   `packages/shared/src/economy/` (unit-tested). No literals in server/client code.
6. Daily limits reset at 00:00 **Asia/Tehran**.

## When changing numbers

- Edit config only, then run the simulation (`pnpm --filter shared simulate:economy`) and paste
  median/p10/p90 balance + % stuck player-days into the PR/summary. Target < 2% stuck.
- Update the tables in `docs/logic/economy.md` in the same change.
- Tell the user (Persian) what changed and the expected effect.

## When adding a new faucet/sink

- Add a `reason` enum value (DB migration + shared type), config constant, calculator, ledger call with
  idempotency key, anti-abuse cap if it's a faucet, test, and a row in the spec table.

## Money ≠ coins

Real-money purchases (Bazaar/Myket IAP) are **not decided** (open question 4). Don't build payment flows
until DECISIONS.md says so; the `purchase` reason exists only as a placeholder.
