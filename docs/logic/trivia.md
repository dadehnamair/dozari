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

## Not built
Rewards, a bulk import, a per-table trivia count, trivia in 2v2.
