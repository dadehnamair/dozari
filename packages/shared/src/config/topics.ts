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
/**
 * Question difficulty (docs/logic/trivia.md §Difficulty): 1 easy, 2 medium, 3 hard — set by the admin (or suggested by the author), and
 * measured from play (`plays`, `right`). With the admin switch `trivia.level_matching` on, a draw prefers the difficulty that fits the
 * players' level: easy below `TRIVIA_LEVEL_MEDIUM_FROM`, medium below `TRIVIA_LEVEL_HARD_FROM`, hard from there.
 */
export const TRIVIA_DIFFICULTY_DEFAULT = 2;
export const TRIVIA_LEVEL_MEDIUM_FROM = 6;
export const TRIVIA_LEVEL_HARD_FROM = 15;
/** A question's measured difficulty counts once it was answered this often; a right-rate at or above EASY is easy, below HARD is hard (percent). */
export const TRIVIA_MEASURE_MIN_PLAYS = 30;
export const TRIVIA_MEASURE_EASY_PERCENT = 75;
export const TRIVIA_MEASURE_HARD_PERCENT = 45;

/**
 * The question workshop (docs/logic/question-workshop.md): players design questions, the admin approves, authors and reviewers are rewarded.
 */
export const WORKSHOP_SUBMIT_DAILY = 5;
export const WORKSHOP_AUTHOR_COINS = 40;
export const WORKSHOP_AUTHOR_FIRST_BONUS = 40;
export const WORKSHOP_AUTHOR_MILESTONE_EVERY = 5;
export const WORKSHOP_AUTHOR_MILESTONE_BONUS = 50;
/** A topic with fewer approved questions than this pays the thin-topic bonus for a new one. */
export const WORKSHOP_THIN_BELOW = 40;
export const WORKSHOP_THIN_BONUS = 15;
/** Campaign multiplier on the whole author reward, in percent over normal (100 = double); 0 = no campaign. */
export const WORKSHOP_BOOST_PERCENT = 0;
export const WORKSHOP_REVIEW_DAILY = 20;
export const WORKSHOP_REVIEW_AGREE_BONUS = 3;
export const WORKSHOP_MILESTONE_POINTS = 30;
export const WORKSHOP_MILESTONE_COINS = 10;
export const WORKSHOP_APPROVE_SCORE = 6;
export const WORKSHOP_REJECT_SCORE = 5;
export const WORKSHOP_MIN_REVIEWERS = 3;
/** Reviewer titles by total points (the Persian names live in fa.ts); the key is the minimum points. */
export const WORKSHOP_TITLE_POINTS = [0, 30, 120, 400, 1000] as const;
export const TRIVIA_SOLO_FEE = 3;
export const TRIVIA_SOLO_REFUND_PERCENT = 75;
export const TRIVIA_DUEL_FEE = 12;
/** After a question duel ends both sides may ask for a rematch for this long. */
export const TRIVIA_DUEL_REMATCH_SECONDS = 30;
