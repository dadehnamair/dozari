/** Match/game numbers (CLAUDE.md rule 9: tunables live only in config/). See docs/logic/game-rules.md. */

export const GROUP_COUNT = 4;
export const GROUP_SIZE = 4;
export const BOARD_SIZE = GROUP_COUNT * GROUP_SIZE;

/** Solo: the 4th wrong guess ends the game and reveals the remaining groups. */
export const SOLO_MAX_MISTAKES = 4;
