/** Group game in Bale/Telegram groups (docs/logic/group-game.md). */

/** A live board with no tap for this long is dropped from memory. */
export const GROUP_ROUND_TTL_MS = 6 * 60 * 60 * 1000;

/** Button taps one person may make per minute in groups (spam guard). */
export const GROUP_TAP_LIMIT = 40;

/** Longest card label on a button; longer names are cut with an ellipsis. */
export const GROUP_CARD_LABEL_MAX = 18;

/** Cards per button row (the board is 4×4). */
export const GROUP_BUTTONS_PER_ROW = 4;
