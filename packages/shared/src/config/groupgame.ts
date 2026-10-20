/** Group game in Bale/Telegram groups (docs/logic/group-game.md). */

/** A live board with no tap for this long is dropped from memory. */
export const GROUP_ROUND_TTL_MS = 6 * 60 * 60 * 1000;

/** Button taps one person may make per minute in groups (spam guard). */
export const GROUP_TAP_LIMIT = 40;

/** The 16-card board of a group is played alone by every member for this long (each sees only their own picks); then the results are announced. */
export const GROUP_PLAY_MS = 15 * 60 * 1000;
/** A reminder goes out when this much of `GROUP_PLAY_MS` is left. */
export const GROUP_PLAY_REMIND_MS = 5 * 60 * 1000;

/** Longest card label on a button; longer names are cut with an ellipsis. */
export const GROUP_CARD_LABEL_MAX = 18;

/** Cards per button row (the board is 4×4). */
export const GROUP_BUTTONS_PER_ROW = 4;

/** Weekly group leaderboard (phase 2): points for finding a group, plus a bonus per difficulty level (0 yellow .. 3 purple). */
export const GROUP_POINTS_PER_GROUP = 10;
export const GROUP_POINTS_LEVEL_BONUS = 5;

/** Rows `/top` shows. */
export const GROUP_TOP_SIZE = 10;

/** Price-guess mode in groups (phase 3): `/price` asks this many questions, each open for this long, `GROUP_PRICE_SESSIONS_PER_DAY` times a day per group. */
export const GROUP_PRICE_ROUNDS = 5;
export const GROUP_PRICE_ROUND_MS = 40_000;
/** The open question is rewritten with the seconds left (and how many answered) this often; Bale/Telegram throttle edits, so not every second. */
export const GROUP_PRICE_TICK_MS = 10_000;
/** Pause between a reveal and the next question. */
export const GROUP_PRICE_PAUSE_MS = 4_000;
export const GROUP_PRICE_SESSIONS_PER_DAY = 2;
/** Points for picking the real price; a wrong pick earns nothing. */
export const GROUP_PRICE_POINTS = 5;

/** General-question mode in groups (`/question`): same shape as price mode, questions come from the «پرسش‌های عمومی» bank. */
export const GROUP_QUESTION_ROUNDS = 5;
export const GROUP_QUESTION_ROUND_MS = 40_000;
export const GROUP_QUESTION_TICK_MS = 10_000;
export const GROUP_QUESTION_PAUSE_MS = 4_000;
export const GROUP_QUESTION_SESSIONS_PER_DAY = 2;
/** Points for the right choice; a wrong pick earns nothing. */
export const GROUP_QUESTION_POINTS = 5;
