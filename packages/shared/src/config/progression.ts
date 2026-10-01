/** Level / XP numbers (docs/logic/progression.md D33). Proposed defaults; the admin panel overrides them. */
export const XP_SOLO_BASE = 5;
export const XP_DUEL_BASE = 10;
export const XP_WIN_BONUS = 15;
/** Total XP to reach level n+1 is `XP_CURVE_BASE * n²` (level 2 at 50 XP, level 3 at 200 …). */
export const XP_CURVE_BASE = 50;
export const LEVEL_MAX = 50;

/** Nickname rules a player-chosen name must follow (owner item 14). Every one is an admin setting. */
export const NICKNAME_MIN_LEN = 2;
export const NICKNAME_MAX_LEN = 20;
