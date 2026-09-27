# Coin economy (proposed defaults — D9)

Goal from the brief: coins come from inviting friends and playing; entering matches/tables costs coins;
an active player should **never get stuck** at zero. All numbers → `packages/shared/src/config/economy.ts`.

## Faucets (coins in)

| source | amount | rule |
|---|---|---|
| Signup bonus | 200 | once per account (device-bound for guests) |
| Daily login | 30 | first app open per Tehran calendar day (Asia/Tehran) |
| Daily free matches | 3 / day | entry fee waived; payout from a **house pot** = normal win payout × 0.5 |
| Win payout | pot × 0.9 | pot = sum of entry fees; 10% burned (sink) |
| Draw | refund entry fee − 10% | |
| Loss consolation | 5 | only for full matches (not abandon), max 10 per day |
| Invite reward (inviter) | 100 | granted when the invitee completes **3 finished matches** (anti-abuse) |
| Invite reward (invitee) | +50 on redemption | plus free chat unlock |
| UGC item approved | 40 | per approved submission, max 5/day |
| Broke rescue | top-up to 60 | if balance < cheapest entry fee and no free matches left: once per day |
| *(house-funded, not a player faucet)* `bot_match_subsidy` | = the entry fee a human opponent would have paid | credited to the match pot, not to any user, whenever a bot fills a seat — keeps win/draw/loss payout math identical to a human match. See `docs/logic/bots.md` §Economy interaction (D23). Needs balancing once bots are simulated. |

## Sinks (coins out)

| sink | amount |
|---|---|
| Duel entry | 20 |
| Team entry | 20 per player |
| Private table | host-chosen 0–100 per player (0 = friendly, no payout, no burn) |
| House cut | 10% of every pot |
| Abandon | entry fee lost |
| (later) cosmetics: avatars, card backs, taunt packs | TBD |

## Rules

- **Single write path:** `LedgerService.apply({userId, delta, reason, ref, idempotencyKey})` inside a DB
  transaction with `SELECT ... FOR UPDATE` on the user's balance row. Nobody else writes coins.
- Balance may never go negative; spending with insufficient funds → `INSUFFICIENT_COINS` error.
- Every match-related movement is keyed: `entry:<matchId>:<userId>`, `payout:<matchId>:<userId>`,
  `refund:<matchId>:<userId>` → retries are safe.
- Aborted match ⇒ refund all escrowed entries (except no-show/abandon rule in matchmaking.md).
- Team payout is split equally between the two teammates (odd coin → captain of last turn).

## Anti-abuse

- Invite rewards: invitee must have a distinct device id and phone (if verified), and complete 3
  matches against players other than the inviter. One redemption per account, ever.
- Private-table coin farming: payouts from private tables capped at *PRIVATE_DAILY_PAYOUT_CAP* = 300/day
  per user; pairs that play each other > 10 times/day get fee 0 forced.
- Daily counters reset at 00:00 Asia/Tehran.

## Balancing

`packages/shared/scripts/simulate-economy.ts` simulates N players with play-frequency distributions
for 30 days and prints median/p10/p90 balances + % of player-days stuck. Target: < 2% stuck,
median balance slowly rising (so future cosmetics sink has room). Run it whenever config changes.
