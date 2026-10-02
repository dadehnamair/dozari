# Coin economy (defaults accepted, tunable — D9, confirmed 2026-09-27)

Goal from the brief: coins come from inviting friends and playing; entering matches/tables costs coins;
an active player should **never get stuck** at zero. All numbers → `packages/shared/src/config/economy.ts`.

Owner confirmed the faucet/sink numbers below as the launch defaults (2026-09-27: "همون گزینه
اول اما حتما قابل تنظیم باشه" — keep them, but every number must stay a config value, never a
hardcoded literal, so they can be tuned post-launch from real play data without a code change.

## Faucets (coins in)

| source | amount | rule |
|---|---|---|
| Signup bonus | 200 | once per account (device-bound for guests) |
| Daily reward (D64) | 10 / 15 / 20 … | one claim per 24 h; a streak grows day by day (admin-editable list, last amount repeats), restarts at day 1 after a skipped day. Built: `economy/daily-reward.ts`, `GET /daily-reward`, `POST /daily-reward/claim`, admin editor |
| Daily free matches | 3 / day | entry fee waived; payout from a **house pot** = normal win payout × 0.5 |
| Win payout | pot × 0.9 | pot = sum of entry fees; 10% burned (sink) |
| Draw | refund entry fee − 10% | |
| Loss consolation | 5 | only for full matches (not abandon), max 10 per day |
| Invite reward (inviter) | 100 | granted when the invitee completes **3 finished games** (anti-abuse); a personal code needs level 3 and has 10 uses (D79) |
| Invite reward (invitee) | +50 on redemption | plus free chat unlock |
| UGC item approved | 40 | per approved submission, max 5/day |
| Broke rescue | top-up to 60 | if balance < cheapest entry fee and no free matches left: once per day |
| *(house-funded, not a player faucet)* `bot_match_subsidy` | = the entry fee a human opponent would have paid | credited to the match pot, not to any user, whenever a bot fills a seat — keeps win/draw/loss payout math identical to a human match. See `docs/logic/bots.md` §Economy interaction (D23). Needs balancing once bots are simulated. |

## Sinks (coins out)

| sink | amount |
|---|---|
| Duel entry | 20 (base — see §Entry fee scales with difficulty below) |
| Team entry | 20 per player (base) |
| Private table | host-chosen 0–100 per player (0 = friendly, no payout, no burn) |
| House cut | 10% of every pot |
| Abandon | entry fee lost |
| Price-guess round wager | 2–5 coins/round, escrowed per round | competitive modes only, solo has none — see `price-guess-round.md` §Real coin side-bet |
| Coin packages (IAP) | N/A yet | see §Real-money coin purchases below — designed for now, **not built/enabled** at MVP |
| Solo hints (D78) | 15 / 20 / 35, ×2 from the 2nd per game, level ≥ 2, max 2 per game | or one hint token; see `shop.md` |
| Shop items (D78) | admin-set (starter: 1 token = 20, 5 tokens = 80 from level 3) | per-item level gate and daily limit |
| (later) cosmetics: avatars, card backs, taunt packs | TBD |

## Entry fee scales with difficulty (D51)

A harder match costs more to enter than an easier one — the flat `ENTRY_FEE` above becomes a
tier-scaled table: `entryFee = round(baseEntryFee * DIFFICULTY_MULTIPLIER[tier] / 5) * 5` (rounded
to the nearest 5 coins). Owner: "هرچی بازی رو سخت‌ترش میکنه ورودی‌هاش سنگین‌تر باشه." Applies to
duel/team queue entry (tier = the skill-tier puzzle picked, per `progression.md` D34/D47) and to
private-table hosts picking a difficulty (`app-screens.md` §Private table, D52). Prototype uses
illustrative multipliers `{easy: 0.5, mid: 1, hard: 1.75}` in `prototype/screens/table.html` — not
tuned numbers, just a placeholder shape. Exact multipliers need the same playtesting pass as the
rest of this file's numbers (open question 1); payout math (win = pot × 0.9, etc.) is unchanged,
it just operates on a bigger or smaller pot.

## Gifts and loans between friends (D80)

Owner item 5. Both ways are options in the profile; before first use the app shows the live rules («آجان دوزاری می‌گوید»).
All numbers are admin settings (`transfer.*`, `loan.*`): friends for ≥ 7 days, sender level ≥ 5 and an activated account
(invite code redeemed), 10–100 coins per transfer, **200 coins per rolling week** for gifts + loan principals together
(an open offer reserves its amount; a cancelled or declined one frees it; repayments never refund the cap).
A **gift** moves at once. A **loan** is offered, moves only when the borrower accepts, is due in 7 days, the borrower may repay
in parts any time; at the due date it is taken from whatever the borrower has (never below zero), what remains stays owed and
blocks new loans for that borrower. One open loan per borrower. Ledger reasons: `gift_out/in`, `loan_out/in`, `repay_out/in`
(every step has its own idempotency key). Table `coin_transfers`; API `/transfers`, `/transfers/rules`, `/friends/:id/gift|loan`,
`/loans/:id/accept|decline|cancel|repay`. A transfer is a move, not a faucet: the coin total never changes.

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

## Real-money coin purchases (IAP) — designed now, built later

Owner (2026-09-27): "از همین الان براش جا باز کنیم در طراحی" — make room in the design now, even
though this isn't built or enabled at MVP launch (open question 4 in `DECISIONS.md` still governs
*whether/when* to turn it on; this section is the *how*, decided in advance so the schema and
ledger don't need retrofitting later).

- New `coin_packages` catalog table: `id, coins, price_irr, store_sku_bazaar, store_sku_myket,
  is_active`. A handful of fixed tiers (e.g. small/medium/large), not a free-form amount.
- Purchase flow: client buys via **Cafe Bazaar or Myket in-app billing** (Poolakey SDK, per D18 —
  no other payment path for mobile; a future ZarinPal web top-up is a separate, later decision).
  Server verifies the purchase receipt with the store's server-side verification API before
  crediting coins — never trust the client's "purchase succeeded" event alone.
- Ledger: new `purchase` reason (already reserved as a placeholder in `data-model.md`
  §coin_ledger), `idempotencyKey = purchase:<storeOrderId>`, so a replayed/duplicate store
  callback can't double-credit.
- **Built, switched off (D91):** tables `coin_packages` (+ `min_level`, sort, per-store SKU) and `coin_purchases` (unique store+order id);
  `GET /coin-packages`, `POST /coin-packages/:id/redeem {store, orderId, token}`; admin CRUD `/admin/coin-packages` (economy permission).
  Everything is gated by setting `feature.coin_packages` (default 0). The receipt check is a `ReceiptVerifier`; the shipped one refuses
  everything, so no coin can be credited until a real Bazaar/Myket adapter is written and the flag is turned on.
- Because this is real money, it needs its own refund/dispute handling and store-policy
  compliance review before going live — tracked as a Phase 8+ (or dedicated) task in `PLAN.md`,
  not part of the Phase 6 coin-economy build-out.

## Balancing

`packages/shared/src/economy/simulate.ts` (`simulateEconomy`, seeded, pure) models 2000 players over 30 days
(three play-frequency buckets, daily reward, daily puzzle, 3 free matches, loss consolation, broke rescue) and
returns median/p10/p90 balance, % of player-days stuck and faucet/burn per player. Print it with
`PRINT_ECONOMY=1 pnpm --filter @dozari/shared exec vitest run src/economy/__tests__/simulate.test.ts`.
Target: < 2% stuck, median balance slowly rising (so the shop/cosmetics sink has room). Run it whenever config changes.

### Audit result (launch defaults, 2026-10-02, D90)

| metric | value |
|---|---|
| median / p10 / p90 balance after 30 days | 1336 / 832 / 1692 |
| stuck player-days | 0.002 % (target < 2 %) |
| coins created per player (faucets) | ≈ 1433 |
| coins burned per player (house cut) | ≈ 100 |

Reading: nobody gets stuck, but the balance **inflates** — faucets are ~14× the burn. The mint is mostly
free-match wins paid from the house pot (3/day × 45 % × 9 coins), daily reward and consolation. Model only
covers duels; hints, shop, gifts (zero-sum) and tournaments are not in it. Proposed (not applied): leave
numbers as they are until real play data exists, and use the shop / cosmetics / coin-packages as the sink;
if inflation shows in production lower `FREE_MATCH_PAYOUT_PERCENT` first (settings-tunable).

## Daily game caps (D92)

Admin settings `limit.solo_per_day` and `limit.duel_per_day` (0 = unlimited, default) cap how many games of a mode one player may start per Tehran day. Counted in `daily_play_counts (user, date, mode)`; solo `POST /solo/start` answers 429 `daily_cap`, the duel queue answers `DAILY_CAP`. A duel is counted when the match actually starts (leaving the queue costs nothing). The daily puzzle has its own one-attempt rule and is not counted.
