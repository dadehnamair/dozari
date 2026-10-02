import type { LevelRoad, Unlock } from '@dozari/shared';
import { levelStartXp } from '@dozari/shared';

export type NodeState = 'done' | 'current' | 'locked';

export interface RoadNode {
  level: number;
  state: NodeState;
  /** What this level opens (may be empty). */
  unlocks: Unlock[];
}

/** One node per level from `levelMax` down to 1 (the road is read bottom-up, so the highest level is the first row). */
export function roadNodes(road: Pick<LevelRoad, 'level' | 'levelMax' | 'unlocks'>): RoadNode[] {
  const byLevel = new Map<number, Unlock[]>();
  for (const u of road.unlocks) byLevel.set(u.level, [...(byLevel.get(u.level) ?? []), u]);
  const out: RoadNode[] = [];
  for (let level = road.levelMax; level >= 1; level--) {
    out.push({ level, state: level < road.level ? 'done' : level === road.level ? 'current' : 'locked', unlocks: byLevel.get(level) ?? [] });
  }
  return out;
}

/** How far through the player's current level they are (0..1), for the bar on the locked popup. */
export function levelProgress(road: Pick<LevelRoad, 'xpInLevel' | 'xpForNext'>): number {
  return road.xpForNext === 0 ? 1 : Math.min(1, Math.max(0, road.xpInLevel / road.xpForNext));
}

/** XP still needed to reach `level`, 0 when already there. */
export function xpToReach(road: Pick<LevelRoad, 'xp' | 'curveBase'>, level: number): number {
  return Math.max(0, levelStartXp(level, road.curveBase) - road.xp);
}
