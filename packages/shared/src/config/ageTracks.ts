/** Age tracks (docs/logic/age-tracks.md, D198). Proposed defaults; every number a track rule needs lives here (rule 9). */
export const AGE_TRACKS = ['kid', 'teen', 'adult'] as const;
export type AgeTrack = (typeof AGE_TRACKS)[number];

export const DEFAULT_AGE_TRACK: AgeTrack = 'adult';

/** Labels only: a player's track is chosen, never computed from these edges. */
export const AGE_TRACK_EDGES = { kidMax: 11, teenMax: 17 } as const;

/** Chat modes a guardian can pick for a child (docs/logic/age-tracks.md §Guardian panel). */
export const CHAT_MODES = ['friends_text', 'phrases', 'off'] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

/** Which readers a blocked word applies to: everybody, or only the kid and teen tracks (the stricter list). */
export const WORD_TRACKS = ['all', 'kid_teen'] as const;
export type WordTrack = (typeof WORD_TRACKS)[number];

/** How a child's new friends are handled (docs/logic/age-tracks.md §Guardian panel): `auto` = they just happen (the guardian is told in the digest), `ask` = the guardian approves first. */
export const FRIEND_APPROVALS = ['auto', 'ask'] as const;
export type FriendApproval = (typeof FRIEND_APPROVALS)[number];

/** A guardian's quiet hours are minutes from midnight; the daily reminder fires after this many play minutes (null = off). Proposed defaults, all tunable. */
export const GUARDIAN_REMINDER_CHOICES = [15, 30, 45, 60, 90] as const;
/** The soft «rest» card can be dismissed for this long; it never locks the child out. */
export const QUIET_CARD_SNOOZE_MINUTES = 10;
