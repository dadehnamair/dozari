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

## Competitive: shared board, alternating turns (Decision D8 — proposed)

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
- Winner = higher score. Tie-break: fewer mistakes → earlier last correct guess → draw.
- Forfeit/abandon: the remaining side wins regardless of score (see matchmaking.md for reconnect grace).

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

Invariants (unit-tested):
- Only the active side's captain (or active player) can `submit`; others → `NOT_YOUR_TURN`.
- `itemIds` length 4, all on board, unique → else `INVALID_SELECTION`.
- Score only increases; mistakes ≤ max; solved groups never un-solve.
- `turnId` increments on every turn change; timeouts carry the `turnId` they were scheduled for.
- A finished state accepts no commands.

## Result screen (all modes)
- Full solution (4 colored rows, title + explanation), scores, mistakes, coins won/lost.
- Overlaid price chart (see result-chart.md) + product stories.
- Rematch button (private & duel: both must accept within 15 s).

## Alternatives (not chosen, keep for reference)
- **Parallel race:** each side gets its own copy of the board; first to solve all 4 wins, mistakes add
  time penalties. Simpler netcode, less interaction; would fit if D8 is rejected. Reducer design above
  supports it with a `boards` map per side.
