/**
 * Puzzle tiers (docs/logic/progression.md §Puzzle tiers): the admin defines an ordered list of difficulty tiers, each open to a range of
 * player levels, tags every puzzle with one, and a new player is served the easier tiers. Pure; the server wraps it with I/O.
 */

export interface PuzzleTier {
  id: string;
  nameFa: string;
  /** Position in the ladder, easiest first. */
  sortOrder: number;
  /** First player level this tier is for. */
  minLevel: number;
  /** Last player level it is for, or null = no upper bound. */
  maxLevel: number | null;
}

/** The tiers a fresh install starts with (proposed numbers; the admin edits them). `id` is filled in when they are stored. */
export const DEFAULT_PUZZLE_TIERS: readonly Omit<PuzzleTier, 'id'>[] = [
  { nameFa: 'خیلی آسان', sortOrder: 1, minLevel: 1, maxLevel: 3 },
  { nameFa: 'آسان', sortOrder: 2, minLevel: 4, maxLevel: 8 },
  { nameFa: 'متوسط', sortOrder: 3, minLevel: 9, maxLevel: 15 },
  { nameFa: 'سخت', sortOrder: 4, minLevel: 16, maxLevel: 25 },
  { nameFa: 'خیلی سخت', sortOrder: 5, minLevel: 26, maxLevel: null },
];

/** Tiers a player of `level` should be served, easiest first: the ones whose range holds the level. */
export function tiersForLevel(tiers: readonly PuzzleTier[], level: number): PuzzleTier[] {
  return tiers
    .filter((t) => level >= t.minLevel && (t.maxLevel === null || level <= t.maxLevel))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Why a tier definition is not acceptable, or null: a name, a positive min level, and a max not below the min. */
export function tierProblem(t: Pick<PuzzleTier, 'nameFa' | 'minLevel' | 'maxLevel'>): 'name' | 'level_range' | null {
  if (t.nameFa.trim().length < 2 || t.nameFa.trim().length > 40) return 'name';
  if (!Number.isInteger(t.minLevel) || t.minLevel < 1) return 'level_range';
  if (t.maxLevel !== null && (!Number.isInteger(t.maxLevel) || t.maxLevel < t.minLevel)) return 'level_range';
  return null;
}
