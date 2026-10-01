# Price-guess bonus round

Owner-approved addition (2026-09-27): a second stage that runs after every finished Connections
puzzle, in every mode (solo, duel, team, private). This is the "حدس دقیق قیمت" mode the market
research referenced, folded into the main game as a bonus round rather than a standalone mode.

## Trigger & item selection

- Starts automatically right after the puzzle ends (3rd/4th group resolved, or solo 4-mistake
  game-over) and before the result screen is shown.
- **4 rounds**, one item per group (yellow → purple), **chosen at random** from that group's 4 items.
- Round order: yellow → green → blue → purple (proposed default — matches the puzzle's own
  difficulty ladder; not separately confirmed with the owner, revisit if it feels anticlimactic).
- The item's image + name is shown; the year being asked about is the group's rule year when the
  rule has one (`price_band_at_year`, `same_price_at_year`), otherwise the most recent year with
  an approved price point.

## Solo scoring — 5-tier staircase by error %

`error% = |guess - actual| / actual * 100`, scored on a fine-grained 5-step ladder (owner asked
for "۵ پله، پله‌های ریزتر" — tighter than the earlier 4-tier sketch):

| error% | points |
|---|---|
| ≤ 5% | 5 |
| ≤ 15% | 4 |
| ≤ 30% | 3 |
| ≤ 60% | 2 |
| > 60% | 1 |

Proposed default (`packages/shared/src/config/game.ts` → `PRICE_GUESS_STAIRCASE`); needs
playtesting like every other economy/scoring number (see `docs/logic/economy.md`).

## Competitive scoring — blind simultaneous guess, closest wins

For duel/team/private:

- The 4 rounds run **sequentially** (turn-by-turn like the rest of the match), but each round
  itself is **simultaneous and blind**: both sides (or both teams, pooling to one guess via the
  same captain mechanic as game-rules.md) submit a hidden number within the round timer
  (reuse `TURN_SECONDS` = 45s, proposed). When both have submitted (or the timer expires), both
  numbers are revealed together.
- Whoever is numerically closer to the actual price wins the round. Exact tie on distance → round
  is a draw, no point.
- Winning a round is worth `PRICE_GUESS_ROUND_POINTS` = 1 point added to that side's match score
  (proposed — same score pool the puzzle groups feed into, so a price-guess sweep can matter for
  the overall win/tie-break in game-rules.md).
- A side that got **locked out** of the puzzle (4 mistakes) still plays every price-guess round —
  they can win individual rounds, but per owner instruction they can never win the **match**
  outright off price-guess points alone while locked out (i.e. the lockout still decides the
  match winner if the puzzle portion alone would have). If that side stays until the end (no
  forfeit) and wins price-guess rounds, it gets a small consolation bonus added to its final
  score — resolved tie-break precedence, see `game-rules.md` §Price-guess bonus points & the
  locked-out side.
- No submission before the timer → counts as the worst possible guess for that side (loses the
  round unless the opponent also times out, then it's a draw).

### Real coin side-bet per round (owner-approved, 2026-09-27)

Each price-guess round also carries a small real coin wager, on top of the match-score point:

- `PRICE_GUESS_ROUND_WAGER` = 2–5 coins (proposed default, range per owner's own framing;
  pin an exact number in `packages/shared/src/config/economy.ts` and simulate it —
  `economy.md` §Balancing).
- Both sides' wager is escrowed via the same `LedgerService` path as the match entry fee
  (idempotency key `price_guess_wager:<matchId>:<round>:<userId>`), **at the moment each round
  starts**, not upfront for all 4 — so a side that got locked out of the puzzle isn't forced to
  pre-commit coins for rounds it might not meaningfully compete in.
- Round winner takes the pot (both wagers minus the standard house cut, `economy.md`'s
  `HOUSE_CUT` = 10%, applied here too for consistency). A round draw (tie on distance, or both
  timed out) refunds both wagers minus the house cut, same as a match draw.
- Solo mode has **no wager** — staircase scoring only, no coins move. This wager only applies to
  duel/team/private (i.e. wherever a real opponent's guess exists to bet against).
- A side that can't afford the wager when a round starts **auto-sits it out**: no guess submitted,
  counts as the worst guess for that round, no coins move for that side (mirrors the
  match-entry-fee affordability check in `matchmaking.md`).

## Server/reducer notes

- Same pattern as the match reducer (`docs/ARCHITECTURE.md` §Match engine pattern): a
  `PriceGuessCommand` (`submit_guess`) flows through `applyCommand`; the actual price is never
  sent to clients until both sides have submitted or the timer fires.
- Persist each round's guesses to `match_events` for the result screen and the share chart.

## Result screen integration

Per `docs/logic/result-chart.md` and the owner's ordering (2026-09-27): the price-guess rounds are
shown on the same single result page, after the 4 solved-group rows and before the price chart —
see updated flow in that file / the result-screen section of `docs/PLAN.md`.

## Implementation (pure logic, `packages/shared/src/priceguess/`)

- `selectRounds(groups, catalog, rng)`: one round per group yellow→purple; random item among those with a
  usable price (rule year if the group has one, else the product's latest priced year).
- `staircasePoints(guess, actual)`: integer-only error% against `PRICE_GUESS_STAIRCASE` (config/game.ts);
  `parseTomanInput` reads what the player types (Persian/Arabic/ASCII digits, separators) as rials.
- Competitive: `startPriceGuess` / `applyPriceGuessCommand` (`submit_guess`, server-issued `timeout`) /
  `priceGuessPoints` / `priceGuessClientView` (never exposes the real price or the opponent's number before
  the simultaneous reveal). A missing guess is the worst possible; two missing is a draw.
- Not here yet: the coin wager (LedgerService), persistence to `match_events`, the locked-out-side match rule
  (belongs to the match reducer, Phase 4).
