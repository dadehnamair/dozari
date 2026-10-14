import { TRIVIA_LEVEL_HARD_FROM, TRIVIA_LEVEL_MEDIUM_FROM, TRIVIA_MEASURE_EASY_PERCENT, TRIVIA_MEASURE_HARD_PERCENT, TRIVIA_MEASURE_MIN_PLAYS } from '../config/topics.js';

/** Which difficulty (1 easy, 2 medium, 3 hard) fits a player level (docs/logic/trivia.md §Difficulty). */
export function triviaTargetDifficulty(level: number, rules: { mediumFrom: number; hardFrom: number } = { mediumFrom: TRIVIA_LEVEL_MEDIUM_FROM, hardFrom: TRIVIA_LEVEL_HARD_FROM }): 1 | 2 | 3 {
  return level >= rules.hardFrom ? 3 : level >= rules.mediumFrom ? 2 : 1;
}

/** The level of several players: their average, rounded (a duel is as hard as the two of them together). */
export function triviaGroupLevel(levels: readonly number[]): number {
  return levels.length === 0 ? 1 : Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
}

/**
 * Difficulty measured from play: the share of right answers over at least `minPlays` answers. Null while there is too little data.
 * The admin sees it next to the difficulty they set and can adopt it.
 */
export function measuredDifficulty(plays: number, right: number, minPlays: number = TRIVIA_MEASURE_MIN_PLAYS): 1 | 2 | 3 | null {
  if (plays < minPlays || plays <= 0) return null;
  const percent = (right * 100) / plays;
  return percent >= TRIVIA_MEASURE_EASY_PERCENT ? 1 : percent < TRIVIA_MEASURE_HARD_PERCENT ? 3 : 2;
}
