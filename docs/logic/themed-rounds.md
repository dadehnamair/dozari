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

## Open for later slices
Penalty numbers (grace 90 s, 4 leaves/day = ban, 8 in 30 days = badge) are in slice 3's section when it lands.
