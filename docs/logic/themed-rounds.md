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

## Slice 1b — topic draft and rounds (built)
- Settings: `match.duel_rounds` (3: a queue duel plays this many boards), `table.min_rounds` (3; the table form starts there and the server clamps up; `TABLE_ROUNDS_MAX` is now 5), `match.topic_draft` (1).
- **Draft** (pure: `packages/shared/src/topics/draft.ts`): before the first board of a **1v1 or 2v2** with ≥ 3 rounds and at least as many offered topics as rounds, the sides take turns naming each round's topic (in a **2v2** too: the sides alternate and, inside a side, the two members take their turns in order — A1, B1, A2, B2 …; only the one whose turn it is may pick, the partner just watches — `chooserId`/`chooserName` in `draft:state`); a used topic closes; `random` draws; the last round of an odd count is the system's; a chooser who is silent for `TOPIC_PICK_SECONDS` (20 s) gets a random topic; a bot chooser answers after ~1–3 s. Fewer topics than rounds or the setting off → random boards as before.
- A topic is offered only if it has ≥ `TOPIC_MIN_PUZZLES` approved puzzles in the players' track. Each round then serves an unseen puzzle of its topic (falling back to any puzzle if the topic ran dry for these players).
- The draft lives inside `MatchService.start` (a drafting player counts as in a match; nothing is charged until the match really starts; leaving cancels with no penalty). Socket: `draft:state` (server → client, also re-sent on resume) and `draft:pick {topic}` (id or `random`). `MatchView.topics` carries the round topics for the HUD.
- Admin: puzzle tab «موضوع‌ها» (create / rename / order / switch off topics, with the count of approved puzzles) and, on each puzzle card, a topic select and tags (`PUT /admin/puzzles/:id/topic`).
- Not built: a topic filter in solo, search by tag in the admin.

## Defined tags (built)
- Tags are a **vocabulary the admin defines**, not free text: table `puzzle_tag_defs` (slug latin kebab-case, Persian name, order, on/off; migration 0084). `puzzle_tags.tag` stores the slug. `PUT /admin/puzzles/:id/topic` rejects a tag that is not defined (`unknown_tag`); a switched-off tag cannot be added any more but stays on puzzles that already carry it. Renaming a slug moves its puzzles along.
- Admin: tab «موضوع‌ها» has «برچسب‌های پازل» (create / rename / order / switch off, with the puzzle count) and each puzzle card shows a chip per tag to toggle. API: `GET/POST /admin/puzzle-tags`.

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
