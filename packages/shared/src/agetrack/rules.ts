import { AGE_TRACKS, DEFAULT_AGE_TRACK, type AgeTrack } from '../config/ageTracks.js';

/**
 * What a track may do. One row per track, read by the server on every guarded action and sent to the client through `/me` and `/config`.
 * Hard walls (no strangers outside the track, no wagers, no purchases) are here, so the client simply never draws what a track lacks.
 */
export interface TrackRules {
  /** Price-guess round after a puzzle. */
  priceGuess: boolean;
  /** Coin side-bet on the price round (D24). */
  coinWager: boolean;
  /** Word lesson after a puzzle (kid space). */
  wordLesson: boolean;
  /** Free text needs a redeemed invite code (adults) or a guardian's chat switch (kid/teen); phrases are always on. */
  freeTextChat: 'invite_code' | 'guardian_switch';
  /** Friends, friend duels and private tables only among the same track. */
  socialSameTrackOnly: boolean;
  /** Friends, friend requests, private tables and friend duels need a linked guardian (asked once, when the child first opens them). Play, bots and the same-track quick match never do. */
  socialNeedsGuardian: boolean;
  /** Real-money purchases (when enabled at all). */
  purchases: boolean;
  /** Home entries that need adult content or price knowledge: the daily puzzle (adult pool), «فقط حدس قیمت» and the price lookup. */
  dailyPuzzle: boolean;
  priceOnly: boolean;
  lookup: boolean;
  /** Suggesting items (UGC). */
  ugc: boolean;
  /** Tournaments (coin and gem entry fees, mixed tracks): adult only until kid and teen tournaments exist. */
  tournaments: boolean;
  /** City and province on the public profile. */
  publicCity: boolean;
  /** Puzzle pools the track is served from, in preference order. */
  puzzleTracks: readonly AgeTrack[];
  /** Taunt library the track uses. */
  tauntTrack: AgeTrack;
}

const RULES: Record<AgeTrack, TrackRules> = {
  kid: { priceGuess: false, coinWager: false, wordLesson: true, freeTextChat: 'guardian_switch', socialSameTrackOnly: true, socialNeedsGuardian: true, purchases: false, ugc: false, tournaments: false, publicCity: false, dailyPuzzle: false, priceOnly: false, lookup: false, puzzleTracks: ['kid'], tauntTrack: 'kid' },
  teen: { priceGuess: true, coinWager: false, wordLesson: false, freeTextChat: 'guardian_switch', socialSameTrackOnly: true, socialNeedsGuardian: true, purchases: false, ugc: false, tournaments: false, publicCity: false, dailyPuzzle: false, priceOnly: true, lookup: true, puzzleTracks: ['teen'], tauntTrack: 'teen' },
  adult: { priceGuess: true, coinWager: true, wordLesson: false, freeTextChat: 'invite_code', socialSameTrackOnly: false, socialNeedsGuardian: false, purchases: true, ugc: true, tournaments: true, publicCity: true, dailyPuzzle: true, priceOnly: true, lookup: true, puzzleTracks: ['adult'], tauntTrack: 'adult' },
};

export function trackRules(track: AgeTrack): TrackRules {
  return RULES[track];
}

export function isAgeTrack(value: unknown): value is AgeTrack {
  return typeof value === 'string' && (AGE_TRACKS as readonly string[]).includes(value);
}

/** Unknown or missing values read as the default track, so an old row or a bad client never lands in a kid space by accident. */
export function parseAgeTrack(value: unknown): AgeTrack {
  return isAgeTrack(value) ? value : DEFAULT_AGE_TRACK;
}

/** Position of a track from youngest (0) to oldest. */
export function trackRank(track: AgeTrack): number {
  return AGE_TRACKS.indexOf(track);
}

/**
 * May a player in `from` switch to `to` on their own? Same or younger: yes. Older: only through a guardian (a kid cannot promote themselves).
 */
export function canSelfSwitchTrack(from: AgeTrack, to: AgeTrack): boolean {
  return trackRank(to) <= trackRank(from);
}

/** Can two players meet (queue, friends, duel, table)? Same track only; the family table is the guardian's own flow and does not call this. */
export function canMeet(a: AgeTrack, b: AgeTrack): boolean {
  return a === b;
}

/** The yes/no rules a request gate can check (docs/logic/age-tracks.md §What each band gets). */
export type BooleanTrackRule = { [K in keyof TrackRules]: TrackRules[K] extends boolean ? K : never }[keyof TrackRules];

/**
 * Which rule an HTTP path needs, so the server refuses what a track does not have even if a client still asks (the app only hides it).
 * Real-money buying, suggesting items, tournaments, the daily puzzle, price-only play and the price lookup.
 */
const PATH_RULES: readonly (readonly [prefix: string, rule: BooleanTrackRule])[] = [
  ['/coin-packages', 'purchases'],
  ['/shop-pay', 'purchases'],
  ['/ugc', 'ugc'],
  ['/tournaments', 'tournaments'],
  ['/daily-puzzle', 'dailyPuzzle'],
  ['/price-only', 'priceOnly'],
  ['/lookup', 'lookup'],
];

export function trackRuleForPath(path: string): BooleanTrackRule | null {
  const hit = PATH_RULES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return hit ? hit[1] : null;
}
