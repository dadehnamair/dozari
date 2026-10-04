/** Invite ("gold") code numbers (docs/logic/chat-and-access.md, economy.md, owner-backlog item 2). All admin settings; proposed defaults. */
export const INVITE_CODE_LENGTH = 6;
/** No 0/O/1/I/L: easy to read aloud and type. */
export const INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
/** A player gets a personal code from this level on, so a code is never handed out for free. */
export const INVITE_MIN_LEVEL = 3;
export const INVITE_MAX_USES = 10;
export const INVITE_INVITEE_BONUS = 50;
export const INVITE_INVITER_REWARD = 100;
/** The inviter is paid only after the invited player has finished this many games. */
export const INVITE_REWARD_AFTER_GAMES = 3;
