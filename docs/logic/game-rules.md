# Game rules (match logic)

All values in *italics* are config in `packages/shared/src/config/game.ts`.

## Modes

| mode | players | matching | entry fee |
|---|---|---|---|
| `solo` | 1 | none (practice) | 0, no coin rewards |
| `duel` (1v1) | 2 | queue | yes |
| `team` (2v2) | 4 (2 sides) | queue / party | yes |
| `private` | 2–4 (1v1 or 2v2) | room code | host-chosen (0 … *PRIVATE_MAX_FEE*) |

## Core mechanic (all modes)

- Board shows 16 items. A player selects exactly 4 and submits.
- Result of a submission:
  - **correct** → that group is solved, revealed (title + explanation + color), items leave the board.
  - **one away** → exactly 3 of the 4 belong to one unsolved group. Feedback «یکی مونده!» shown.
  - **wrong** → otherwise.
- Submitting an identical set twice is rejected client- and server-side (no penalty, "already tried").
- When 3 groups are solved, the last group is auto-revealed (no one scores it).

## Solo

Classic Connections: *SOLO_MAX_MISTAKES* = 4 mistakes allowed; game over at the 4th wrong guess
(remaining groups revealed). Result screen + chart.

Implemented as the pure reducer `packages/shared/src/game/solo.ts` (`startSolo`, `submitGuess`,
`shuffleBoard`; seeded RNG injected). One away counts as a mistake like any wrong guess; a repeated
set (any order) is `duplicate` and free; anything that is not 4 distinct cards on the board is
`invalid` and changes nothing; after three solved groups the fourth is auto-revealed and the game is
`won`; at the 4th mistake the rest are revealed and the game is `lost`. The initial board never lays
out a row as a whole group. The reducer needs the solution, so it runs server-side (rule 4).

Served by `apps/server/src/solo/` (practice, no coins): `POST /solo/start` (503 `no_puzzles` when no
`approved` puzzle exists), `GET /solo/:id`, `POST /solo/:id/guess {productIds[4]}`,
`POST /solo/:id/shuffle`. Sessions live in memory (2 h idle TTL) until solo results are persisted.
The client only ever receives `SoloView`: card ids + `name_fa`/`unit_fa` (no prices), solved groups with
their title/explanation (flagged `revealed` when shown by the game), mistakes, status. Unsolved groups'
membership and texts never leave the server.
`GET /solo/:id/chart` returns the price history of all four groups, but only once the game is over
(409 `game_in_progress` otherwise, since it would reveal the groups); the result screen draws it with
`buildChartData`.

## Competitive: shared board, alternating turns (Decision D8 — **accepted**, confirmed 2026-09-27)

One board, both sides play it in turns.

### Turn
- Active side has *TURN_SECONDS* = 45 s to submit.
- **Correct** → side scores `GROUP_POINTS[level]` = [1, 2, 3, 4] (yellow…purple) and **keeps the turn**
  (streak). A bonus of *FIRST_BLOOD_BONUS* = 1 for the very first group of the match.
- **One away / wrong** → side gets a mistake, turn passes. One-away feedback is visible to **both** sides
  (it leaks info — that's intentional tension).
- **Timeout** → counts as a pass (no mistake), turn passes. *MAX_CONSECUTIVE_TIMEOUTS* = 2 → that side forfeits.
- Each side has *MATCH_MAX_MISTAKES* = 4. A side at 4 mistakes is **locked out**; the other side keeps
  playing alone until the board is done or they also lock out.

### End of match
- Ends when: 3 groups solved (4th auto-revealed), or both sides locked out, or forfeit/abandon.
- Winner = higher score. Tie-break: fewer mistakes → earlier last correct guess → **price-guess
  bonus points** (below) → draw.
- Forfeit/abandon: the remaining side wins regardless of score (see matchmaking.md for reconnect grace).

### Price-guess bonus points & the locked-out side (resolves open question 9, owner-confirmed 2026-09-27)
- A side that got locked out (4 mistakes) during the puzzle **cannot win the match outright** off
  price-guess-round points alone — the puzzle-portion result still decides the match winner when
  it alone would have decided it.
- But a locked-out side that **stayed in the match to the end** (didn't forfeit/abandon) and won
  price-guess rounds gets a **small bonus score** added to their final tally — enough to affect a
  close tie-break (per the tie-break order above) or pad the loss margin shown on the result
  screen, never enough to flip a clear puzzle-portion win. Exact bonus size:
  `PRICE_GUESS_LOSER_BONUS_PER_ROUND` (proposed, small — e.g. 1 point per round won; pin the
  number in `packages/shared/src/config/game.ts` and reconcile with `price-guess-round.md`
  §Competitive scoring `PRICE_GUESS_ROUND_POINTS`).
- A side that forfeits/abandons gets no such bonus — this only rewards staying till the end.

### 2v2 specifics
- The side (team) shares one turn, one score, one mistake counter.
- Within a team, either member may **propose** a selection (visible live to the teammate only,
  shown as highlighted cards). The **captain** of that turn submits; captain alternates each turn so both
  teammates act. Captain may also submit their own selection directly.
- If the captain disconnects, the teammate becomes captain automatically.
- Team chat channel exists (see chat-and-access.md).

### Visibility (redaction)
- Everyone sees: board items, solved groups, scores, mistakes, whose turn, timer, each side's
  submitted selection result (the 4 items and correct/one-away/wrong).
- Opponents do NOT see a side's in-progress selections/proposals.
- Nobody receives unsolved group membership or any price until the match ends.

## Reducer contract (`packages/shared/src/game`)

```ts
type Command =
  | { t: 'submit'; by: UserId; itemIds: ItemId[] }
  | { t: 'propose'; by: UserId; itemIds: ItemId[] }   // team only, not persisted
  | { t: 'timeout'; turnId: number }                   // stale turnId ignored
  | { t: 'leave'; by: UserId }
  | { t: 'forfeit'; side: Side };

applyCommand(state, cmd, ctx: { now: number }) => { state, events: MatchEvent[] } | { error: RuleError }
```

Implemented in `packages/shared/src/game/match.ts` for 1v1 (one player per side, `MatchSide` 0|1): `startMatch`,
`applyCommand` (`submit`, `timeout`, `leave`, `forfeit`; `propose` waits for the team flow in Phase 5), `matchClientView`
(the only shape that leaves the server), and for after the price-guess round `resolveWinner` / `finalScores`.
Details the spec left open, as built: a correct guess restarts the turn clock for the same side; when the opponent is
locked out the active side keeps the turn after a mistake or a timeout; a repeated set is a `DUPLICATE_SELECTION`
error (no penalty), not a turn; two consecutive timeouts forfeit (a submit resets the count); `leave` is an `abandon`;
a tie after score, mistakes and earliest last-correct guess leaves `result.winner = null` for `resolveWinner`
to settle with the price-guess rounds (a locked-out side cannot win that way while the other side is still in).
Constants: `TURN_SECONDS`, `MATCH_MAX_MISTAKES`, `MAX_CONSECUTIVE_TIMEOUTS`, `GROUP_POINTS`, `FIRST_BLOOD_BONUS`,
`PRICE_GUESS_LOSER_BONUS_PER_ROUND` in `config/game.ts`.

Invariants (unit-tested):
- Only the active side's captain (or active player) can `submit`; others → `NOT_YOUR_TURN`.
- `itemIds` length 4, all on board, unique → else `INVALID_SELECTION`.
- Score only increases; mistakes ≤ max; solved groups never un-solve.
- `turnId` increments on every turn change; timeouts carry the `turnId` they were scheduled for.
- A finished state accepts no commands.

## Match HUD (D39)

During any live match (duel/2v2/table), each side's panel always shows, not just score/mistakes:
avatar, nickname, current coin balance, and level (from `progression.md`, D33). Owner: "وقتی داریم
با یکی بازی میکنیم مشخصاتش آواتارش مقدار سکه‌هاش لولش همش بیاد که هیجان کارو زیاد کنه" — makes the
opponent read as a real person with something at stake, not just an abstract score column. Coin
balance shown is a snapshot at match start (own client already tracks it live; the opponent's is
whatever the server last broadcast — no new real-time sync requirement beyond what already exists
for score/mistakes). Prototype: `prototype/index.html` `renderStatus()`'s `.side .id` row.

## Mid-match disconnect → bot takeover (D43)

If a player disconnects or goes AFK (no input) mid-match past a grace period, the server silently
swaps a bot into their seat — same undisclosed-bot policy as `bots.md`/D23, now covering an
abandoned *live* seat, not just an unfilled queue. The remaining player(s) never see any
"opponent disconnected" state; the seat just keeps playing, at the same visual fidelity as D39's
HUD (avatar/coins/level unchanged). Grace-period timer is `BOT_TAKEOVER_GRACE_SECONDS`, proposed at
15s (D62) — see `bots.md`. Economy subsidy accounting (`bots.md` §Economy interaction) extends to
cover a mid-match handoff.

## Result screen (all modes)
- Full solution (4 colored rows, title + explanation), scores, mistakes, coins won/lost.
- Overlaid price chart (see result-chart.md) + product stories.
- Rematch button (private & duel: both must accept within 15 s).

## Alternatives (not chosen, keep for reference)
- **Parallel race:** each side gets its own copy of the board; first to solve all 4 wins, mistakes add
  time penalties. Simpler netcode, less interaction; would fit if D8 is rejected. Reducer design above
  supports it with a `boards` map per side.
