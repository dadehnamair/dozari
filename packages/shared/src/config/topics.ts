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
/** Tags per puzzle (free-text, for filters and search). */
export const PUZZLE_TAGS_MAX = 8;
