import type { LevelRoad, Unlock } from '@dozari/shared';
import { levelStartXp } from '@dozari/shared';

export type NodeState = 'done' | 'current' | 'locked';

export interface RoadNode {
  level: number;
  state: NodeState;
  /** What this level opens (may be empty). */
  unlocks: Unlock[];
  /** The coin reward of this level, when it has one. */
  reward: { coins: number; claimed: boolean } | null;
}

/** One node per level from `levelMax` down to 1 (the road is read bottom-up, so the highest level is the first row). */
export function roadNodes(road: Pick<LevelRoad, 'level' | 'levelMax' | 'unlocks'> & Partial<Pick<LevelRoad, 'rewards'>>): RoadNode[] {
  const rewardOf = new Map((road.rewards ?? []).map((r) => [r.level, { coins: r.coins, claimed: r.claimed }]));
  const byLevel = new Map<number, Unlock[]>();
  for (const u of road.unlocks) byLevel.set(u.level, [...(byLevel.get(u.level) ?? []), u]);
  const out: RoadNode[] = [];
  for (let level = road.levelMax; level >= 1; level--) {
    out.push({ level, state: level < road.level ? 'done' : level === road.level ? 'current' : 'locked', unlocks: byLevel.get(level) ?? [], reward: rewardOf.get(level) ?? null });
  }
  return out;
}

/** How far through the player's current level they are (0..1), for the bar on the locked popup. */
export function levelProgress(road: Pick<LevelRoad, 'xpInLevel' | 'xpForNext'>): number {
  return road.xpForNext === 0 ? 1 : Math.min(1, Math.max(0, road.xpInLevel / road.xpForNext));
}

/** XP still needed to reach `level`, 0 when already there. */
export function xpToReach(road: Pick<LevelRoad, 'xp' | 'curveBase' | 'starts'>, level: number): number {
  return Math.max(0, (road.starts?.[level - 1] ?? levelStartXp(level, road.curveBase)) - road.xp);
}

/** Coins of the rewards the player has reached and not yet taken. */
export function claimableCoins(road: Pick<LevelRoad, 'level' | 'rewards'>): number {
  return road.rewards.filter((r) => !r.claimed && r.level <= road.level).reduce((n, r) => n + r.coins, 0);
}
