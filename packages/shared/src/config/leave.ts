/** Leaving a running duel/table (docs/logic/leave-penalty.md, D226). Proposed defaults, admin-editable via settings. */

/** After a connection drops, the player keeps their seat this long; only then it counts as a leave. */
export const LEAVE_RECONNECT_GRACE_SECONDS = 90;
/** This many leaves in one Tehran day close duels and tables until the day ends. */
export const LEAVE_DAY_BAN_COUNT = 4;
/** This many leaves inside the window earn the «ترک‌کننده» badge, shown on the profile until the count falls below it again. */
export const LEAVE_BADGE_COUNT = 8;
export const LEAVE_BADGE_WINDOW_DAYS = 30;
