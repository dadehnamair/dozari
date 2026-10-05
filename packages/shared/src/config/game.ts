/** Match/game numbers (CLAUDE.md rule 9: tunables live only in config/). See docs/logic/game-rules.md. */

export const GROUP_COUNT = 4;
export const GROUP_SIZE = 4;
export const BOARD_SIZE = GROUP_COUNT * GROUP_SIZE;

/** Solo: the 4th wrong guess ends the game and reveals the remaining groups. */
export const SOLO_MAX_MISTAKES = 4;
/** Solo combo (D178): a group solved within this many seconds of the previous one keeps the combo going; the timer ring shows what is left. Cosmetic only (no points, no coins). */
export const COMBO_WINDOW_SECONDS = 25;
/** Solo last chance (D178): the heartbeat on the final life repeats at this interval. */
export const LAST_LIFE_HEARTBEAT_MS = 1100;
/** A product needs at least this many approved price points (distinct dates) to show a price range; the admin flags fewer. */
export const MIN_PRICE_POINTS_PER_PRODUCT = 3;

/** Price-guess bonus round (docs/logic/price-guess-round.md). All four groups get one round. */
export const PRICE_GUESS_ROUNDS = GROUP_COUNT;

/** Standalone price-guess mode (docs/logic/price-guess-round.md §Price-only mode): rounds per game, admin-editable (`priceonly.rounds`). */
export const PRICE_ONLY_ROUNDS = 5;
export const PRICE_ONLY_MAX_ROUNDS = 10;

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

/** Competitive match (docs/logic/game-rules.md §Competitive). Proposed defaults, to be playtested. */
export const TURN_SECONDS = 45;

/** Free «nudge» for brand-new players (docs/logic/progression.md): idle this long in solo and two cards of one group light up. */
export const NUDGE_MAX_LEVEL = 1;
export const NUDGE_IDLE_SECONDS = 20;
export const NUDGE_MAX_PER_GAME = 2;

/** Solo puzzles kept on the phone for playing without internet (docs/logic/offline-solo.md). Practice only: no XP, no coins. */
export const OFFLINE_PACK_SIZE = 5;
/** Puzzles one account may download per rolling 24 h, so the offline pack cannot be used to collect every solution. */
export const OFFLINE_PACK_DAILY_LIMIT = 15;
export const MATCH_MAX_MISTAKES = 4;
/** Boards (16-card packs) played in a 2v2 match; a 1v1 is always one board. Scores add up, mistakes reset per board. */
export const TEAM_MATCH_BOARDS = 3;
/** Two timeouts in a row make a side forfeit. */
export const MAX_CONSECUTIVE_TIMEOUTS = 2;
/** Points for solving a group, yellow to purple. */
export const GROUP_POINTS = [1, 2, 3, 4] as const;
/** Extra point for the very first group solved in a match. */
export const FIRST_BLOOD_BONUS = 1;
/** Locked-out side that stayed to the end: added to its final tally per price-guess round it won. */
export const PRICE_GUESS_LOSER_BONUS_PER_ROUND = 1;

/** Free pick: finished games before the player may choose one avatar / one nickname from the free sets (D65; to be editable in the admin panel). */
export const AVATAR_UNLOCK_GAMES = 3;
export const NICKNAME_UNLOCK_GAMES = 10;
/** Paid (coin) avatars / nicknames: minimum player level; an activated profile is also required (D65). */
export const AVATAR_CHANGE_MIN_LEVEL = 3;
export const NICKNAME_CHANGE_MIN_LEVEL = 5;
