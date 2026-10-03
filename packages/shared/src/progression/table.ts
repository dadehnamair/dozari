import { z } from 'zod';
import { levelRewardCoins } from './road.js';
import { levelStartXp } from './level.js';

/** One row of the admin's level table (docs/logic/progression.md §Level table): where a level starts and what reaching it pays. */
export const levelRowSchema = z.object({
  level: z.number().int().positive(),
  /** Total XP at which this level starts (level 1 is 0). */
  startXp: z.number().int().nonnegative(),
  /** Coins paid once for reaching it (claimed from the level road); 0 = none. */
  rewardCoins: z.number().int().nonnegative(),
});
export type LevelRow = z.infer<typeof levelRowSchema>;

export const LEVEL_TABLE_MAX = 100;
export const LEVEL_REWARD_MAX = 1_000_000;

export type LevelTableProblem = 'empty' | 'too_long' | 'not_contiguous' | 'first_not_zero' | 'not_increasing' | 'reward_too_big';

/** A table must run 1..N without gaps, start at 0 XP and rise strictly (a level with no XP to earn could never be a level). */
export function checkLevelTable(rows: readonly LevelRow[]): LevelTableProblem | null {
  if (rows.length === 0) return 'empty';
  if (rows.length > LEVEL_TABLE_MAX) return 'too_long';
  if (rows.some((r, i) => r.level !== i + 1)) return 'not_contiguous';
  if (rows[0]!.startXp !== 0) return 'first_not_zero';
  if (rows.some((r, i) => i > 0 && r.startXp <= rows[i - 1]!.startXp)) return 'not_increasing';
  if (rows.some((r) => r.rewardCoins > LEVEL_REWARD_MAX)) return 'reward_too_big';
  return null;
}

/** The table the formulas give today (`xp.curve_base`, `xp.level_max`, `levelreward.*`): the editor's starting point and the fallback shape. */
export function defaultLevelTable(rules: { curveBase: number; levelMax: number }, reward: { every: number; base: number }): LevelRow[] {
  return Array.from({ length: rules.levelMax }, (_, i) => ({ level: i + 1, startXp: levelStartXp(i + 1, rules.curveBase), rewardCoins: levelRewardCoins(i + 1, reward.every, reward.base) }));
}

export const startsOf = (rows: readonly LevelRow[]): number[] => rows.map((r) => r.startXp);
