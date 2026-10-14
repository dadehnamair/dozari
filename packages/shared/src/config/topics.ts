/** Puzzle topics and themed duel/table rounds (docs/logic/themed-rounds.md). Proposed defaults. */

/** A duel or table has at least this many rounds (owner, 2026-10-12: «از ۳ به بالا»). */
export const THEMED_MATCH_MIN_ROUNDS = 3;
export const THEMED_MATCH_MAX_ROUNDS = 7;
/** Topics offered to the picker each round (besides «random»). */
export const TOPIC_CHOICES_PER_ROUND = 6;
/** A topic needs at least this many approved puzzles of the track to be offered at all. */
export const TOPIC_MIN_PUZZLES = 3;
/** Sentinel pick: the server draws an unused topic. */
export const RANDOM_TOPIC = 'random';
/** The chooser of a round has this long to name a topic; then the server draws one. */
export const TOPIC_PICK_SECONDS = 20;
/** Default rounds of a queue duel and the smallest table (owner, 2026-10-12: «از ۳ به بالا»); admin settings `match.duel_rounds` / `table.min_rounds`. */
export const DUEL_ROUNDS_DEFAULT = 3;
export const TABLE_MIN_ROUNDS_DEFAULT = 3;
/** Tags per puzzle (free-text, for filters and search). */
export const PUZZLE_TAGS_MAX = 8;

/** General four-choice questions (docs/logic/trivia.md): questions per game, the shortest question and the longest answer. */
export const TRIVIA_QUESTIONS_PER_GAME = 8;
export const TRIVIA_TEXT_MAX = 300;
export const TRIVIA_OPTION_MAX = 80;
export const TRIVIA_OPTION_COUNT = 4;
/** The live question duel (docs/logic/trivia.md §Question duel): questions per game and seconds to answer each. */
export const TRIVIA_DUEL_QUESTIONS = 8;
export const TRIVIA_DUEL_SECONDS = 15;
/** The versus card shows this long after the rival is found, before the first question opens (and its clock starts). */
export const TRIVIA_DUEL_INTRO_MS = 3000;
/**
 * Coins of the question modes (docs/logic/trivia.md §Coins). A solo game costs `TRIVIA_SOLO_FEE`, given back when at least
 * `TRIVIA_SOLO_REFUND_PERCENT` of the answers are right (so a good player pays nothing). A question duel costs `TRIVIA_DUEL_FEE` each,
 * the winner takes the pot minus the usual house cut (`duel.house_cut_percent`). Both are below the board duel's 20 on purpose: a question
 * game is quicker and needs less skill, and the house cut makes it a small sink either way. 0 = free.
 */
/**
 * No-repeat memory of the question modes (docs/logic/trivia.md §No repeats): a game draws from up to this many random approved questions of
 * the topic (so even a big bank is seen whole over time), and a player's last `TRIVIA_SEEN_KEEP` seen questions are remembered.
 */
export const TRIVIA_POOL_FETCH = 400;
export const TRIVIA_SEEN_KEEP = 500;
export const TRIVIA_SOLO_FEE = 3;
export const TRIVIA_SOLO_REFUND_PERCENT = 75;
export const TRIVIA_DUEL_FEE = 12;
/** After a question duel ends both sides may ask for a rematch for this long. */
export const TRIVIA_DUEL_REMATCH_SECONDS = 30;
