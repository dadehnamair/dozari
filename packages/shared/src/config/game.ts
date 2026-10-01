/** Match/game numbers (CLAUDE.md rule 9: tunables live only in config/). See docs/logic/game-rules.md. */

export const GROUP_COUNT = 4;
export const GROUP_SIZE = 4;
export const BOARD_SIZE = GROUP_COUNT * GROUP_SIZE;

/** Solo: the 4th wrong guess ends the game and reveals the remaining groups. */
export const SOLO_MAX_MISTAKES = 4;

/** Price-guess bonus round (docs/logic/price-guess-round.md). All four groups get one round. */
export const PRICE_GUESS_ROUNDS = GROUP_COUNT;

/**
 * Solo staircase, best tier first: a guess within `maxErrorPct` percent of the real price earns
 * `points`. Anything beyond the last tier earns PRICE_GUESS_MIN_POINTS. Proposed defaults, to be
 * playtested like every scoring number.
 */
export const PRICE_GUESS_STAIRCASE = [
  { maxErrorPct: 5, points: 5 },
  { maxErrorPct: 15, points: 4 },
  { maxErrorPct: 30, points: 3 },
  { maxErrorPct: 60, points: 2 },
] as const;
export const PRICE_GUESS_MIN_POINTS = 1;

/** Competitive: match-score points for winning one price-guess round. */
export const PRICE_GUESS_ROUND_POINTS = 1;
