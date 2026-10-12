# Themed rounds, topics and the duel/table overhaul (owner, 2026-10-12)

Proposed defaults; numbers live in `packages/shared/src/config/topics.ts`.

## Plan (six slices, one PR each)
1. **Topics + tags + themed rounds** (this slice) — `puzzle_topics`, `puzzles.topic_id`, `puzzle_tags`; pure picker in `packages/shared/src/topics`.
2. Separate boards per side, turn-based; the idle side's cards flip face-down; the opponent only sees «found N of 4».
3. Leaving a table: penalty, daily ban, monthly badge, reconnect grace.
4. Timeout = wrong guess for scoring/coins, shown differently; a win needs the cards solved.
5. Four-option price questions; general four-option questions per topic.
6. Shop items: shuffle the opponent's cards (expensive) and reveal a group (buyable).

## Topics and tags
- A topic (موضوع: خوراکی، لوازم آشپزخانه، ابزار …) is admin-managed (`puzzle_topics`); a puzzle has at most one (`puzzles.topic_id`, null = general). Tags are free text (`puzzle_tags`, ≤ `PUZZLE_TAGS_MAX`) for filtering.
- A topic is offered only when it has ≥ `TOPIC_MIN_PUZZLES` approved puzzles of the players' track.

## Themed rounds (duel and table)
- A match has ≥ `THEMED_MATCH_MIN_ROUNDS` (3) rounds. Sides alternate naming the topic (`topicChooserForRound`); with an odd count the last round is the system's (random).
- Each pick is one of the open topics or `random`. A topic closes once used and never returns in that match (`openTopics`, `resolveTopicPick`). Server draws with the injected RNG.
- Existing tables keep working: the topic step is skipped until slice 1's server/mobile part lands (`TABLE_ROUNDS_MIN/MAX` in `config/tables.ts` still 1–3 until then; raise to the new minimum together with the server step).

## Slice 2 — separate boards (built)
- Rules flag `separateBoards` (admin setting `match.separate_boards`, default on; games already running keep their mode). Off = the old shared board.
- Each side has its own copy of the 16 cards in its own order and its own found groups / tried sets / mistakes (`MatchState.sep`). Turns still alternate; a correct guess keeps the turn. A side that finds three groups gets the fourth (the cards left) and takes the board: first to all four wins it (`boardsWon`). Both locked out → more groups, then fewer mistakes, else nobody. The match goes to the side with more boards won (tie → points, mistakes, earlier last correct guess).
- The rival never sees a card, a guess, its result or a solved group: the snapshot has `found: [n, n]` (of 4) and the event `found {side,count}`; the service drops `guess` / `group_solved` towards the other side. Snapshot `scores` = boards won in this mode.
- Mobile: while it is not your turn the cards flip onto their backs (flip back on your turn); a line shows «حریفت N از ۴ دسته رو پیدا کرده» (hot colour at 3). Spectators see side 0's board.

## Slice 4 — timeout (built, separate-boards mode)
- A side that runs out of time takes a **mistake** exactly like a wrong guess (it can lock the side out), the turn passes, and only that side is told («زمانت تموم شد! یه اشتباه برات حساب شد.»): the `timeout` event is not sent to the rival, who just sees the mistake count move.
- It never ends the match as a forfeit and never makes the rival a winner: a board is won only by finding its groups; if both sides are locked out the board goes to the side with more groups (then fewer mistakes, else nobody) and two idle sides end a draw. The old consecutive-timeout forfeit stays in the shared-board mode (setting off).

## Open for later slices
Penalty numbers (grace 90 s, 4 leaves/day = ban, 8 in 30 days = badge) are in slice 3's section when it lands.
