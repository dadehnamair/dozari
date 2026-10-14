# General four-choice questions («پرسش‌های عمومی») — D226 slice 5b

Owner (2026-10-12): beside the price questions, a place to define ordinary four-choice questions that anyone can answer; each must be defined under its own category (topic).

## Content
- Table `trivia_questions` (migration 0083): `topic_id` (required: a question always lives in a topic), `text_fa`, `option_a..d`, `correct_index` 0–3, `explanation_fa`, `age_track`, `status` (draft | approved | retired). No JSON column (D63).
- Topics are the same `puzzle_topics` the themed rounds use; the admin makes them in «ساخت پازل ← موضوع‌ها».
- Admin tab «پرسش‌های عمومی»: list by topic and status, create / edit (topic, question, four choices, which is right, optional explanation, age track), retire / re-activate. Rules (`triviaInputSchema`): topic required and known, 4 different choices, an index 0–3.

## Playing (`/trivia/*`, switch `feature.trivia`, per-game count `trivia.questions` = 8)
- `GET /trivia/topics`: topics with ≥ 1 approved question in the player's track pool, with the counts. `POST /trivia/start {topicId?}`: a game on one topic or a mix; `503 no_questions` when nothing can be asked. `POST /trivia/:id/answer {index, picked}`.
- The choices are shuffled when the game starts (`shuffleTrivia`, seeded); the view never carries the right index. The answer to a question returns `{pickedIndex, correctIndex, correct, explanationFa}`; answering a question twice returns the first answer. One point per right answer; no coins or XP yet (`onFinished` hook exists for later).
- Age tracks: same rule as the price-only mode (`priceOnly`; kids do not get it); the pool is the player's `puzzleTracks`.
- Mobile: a home button «پرسش» (second row), `TriviaScreen`: topic grid + «ترکیبی», then question cards with the verdict (green / red) and the explanation after each tap.

## In a match (duel and private table, 1v1)
- Admin setting `match.trivia_rounds` (0–10, default 0 = off), read when a match starts. After the boards, and after the price round when there is one, both sides answer the same N approved questions, blind and at the same time (`packages/shared/src/trivia/round.ts`, pure state machine; `MatchService` runs it like the price round).
- Questions: the match's own topics first (themed matches), then the whole bank in the players' track pool; choices are shuffled per match (`shuffleTrivia`). Fewer questions than asked is fine; none at all = the match ends as before.
- A question closes when both have answered or `turnSeconds` pass (no answer = wrong). Each right answer is one point, added to the price-round wins before `resolveWinner` / `finalScores`, so the same rules apply (a locked-out side still cannot win off them).
- Wire: `match:state.triviaRound` (never carries the right choice or the rival's pick before the reveal), `trivia:submit {index}`, error `NO_TRIVIA_ROUND`, `match:ended.triviaRound` (everything public). Bots answer right with their level's accuracy.
- Mobile: `duel/DuelTriviaRound.tsx` replaces the board like the price round; the result page shows the right answers of each side.
- No coin wager on trivia rounds. A table's own choice of the count and 2v2 are not built (the setting applies to every 1v1).

## Question duel («دوئل پرسشی») — D234
Owner (2026-10-14): beside «پرسش» (solo), a live 1v1 that works like the board duel's search: find a rival, start, answer the same questions. The only choice is a topic or random.
- Home: a second button «دوئل پرسشی» next to «پرسش» (`feature.trivia_duel`, same age-track rule as the other question/price modes: kids do not get it). `TriviaDuelScreen`: topic grid + «🎲 تصادفی» → the same diamond search screen as the board duel → versus card (3 s, `TRIVIA_DUEL_INTRO_MS`) → `DuelTriviaRound` → result card with a review of every question.
- Own service, not a board match: `apps/server/src/realtime/trivia-duel.ts` (`TriviaDuelService`, in memory) runs the shared `trivia/round.ts` state machine; the board-duel `MatchService` and its queue are untouched. Lines are per topic: a topic player meets the same topic or a random one (that topic is played); two randoms get a mix; two different topics never meet. Pairing also needs the same question pools (age track). Questions come from the approved bank in the pool, choices shuffled per game (`trivia.duel_questions` = 8, `trivia.duel_seconds` = 15 per question; a question closes when both answered or on the clock).
- Bot fallback like the board duel: a waiting human gets an undisclosed bot after `bots.fallback_seconds` (+ jitter); the bot answers right with its level's accuracy (`BotDriver.planDuelAnswer`). Bots and humans in a question duel are invisible to the board-duel queue and vice versa (`ALREADY_IN_MATCH` / `ALREADY_QUEUED`); a private table starting a match for someone mid question duel is not guarded.
- Wire (`socket/events.ts`): `tduel:join {topicId?}`, `tduel:leave`, `tduel:answer {index}`, `tduel:resume`; server `tduel:found`, `tduel:state` (own `TriviaRoundView`: never the right choice nor the rival's pick before the reveal), `tduel:ended {winner, reason: played|forfeit, scores, round}`; the search clock reuses `queue:status`. Errors: `NO_QUESTIONS` (join on an empty topic), `FEATURE_OFF`, `MAINTENANCE`, `ALREADY_IN_MATCH`, `ALREADY_QUEUED`, `NO_TRIVIA_ROUND`. A socket (re)connect re-sends the running game.
- Winner = more right answers (`triviaWinner`), equal = draw. Leaving a running game (or the screen) forfeits it to the rival; a dropped connection does not stop the clock (unanswered = wrong).
- No coins, XP, daily cap, level gate or leave penalty yet (same as solo trivia).

## Not built
Rewards (in solo and in the question duel), a bulk import, a per-table trivia count, trivia in 2v2, a rematch button in the question duel (the result card goes back to the topic picker), inviting a specific friend to a question duel.
