/** Chat limits (docs/logic/chat-and-access.md). Message length is also an admin setting; the rest are fixed here. */
export const CHAT_MAX_LEN = 120;
/** Free-text messages: this many per window per player. */
export const CHAT_TEXT_RATE = { count: 5, windowMs: 10_000 } as const;
/** Canned taunts: one per 3 seconds per player. */
export const CHAT_TAUNT_RATE = { count: 1, windowMs: 3_000 } as const;
export const CHAT_HISTORY_LIMIT = 50;
/** Chat history is kept this many days for moderation, then purged. */
export const CHAT_RETENTION_DAYS = 30;
