export interface XpRules {
  soloBase: number;
  duelBase: number;
  winBonus: number;
  curveBase: number;
  levelMax: number;
  /** Per-level start XP from the admin's level table (`starts[0]` is level 1 = 0); when set it replaces the curve and `levelMax` is its length. */
  starts?: readonly number[];
}

export interface LevelInfo {
  level: number;
  xp: number;
  /** XP earned inside the current level and the size of this level; both 0 at the cap. */
  xpInLevel: number;
  xpForNext: number;
}

/** XP at which a level starts: level 1 at 0, level 2 at `base`, level 3 at `4·base` … */
export function levelStartXp(level: number, curveBase: number): number {
  return curveBase * (level - 1) ** 2;
}

/** XP at which `level` starts under these rules: the admin's table when there is one, else the curve. */
export function levelStartAt(level: number, rules: Pick<XpRules, 'curveBase' | 'starts'>): number {
  return rules.starts ? (rules.starts[level - 1] ?? Number.POSITIVE_INFINITY) : levelStartXp(level, rules.curveBase);
}

export function levelInfo(xp: number, rules: Pick<XpRules, 'curveBase' | 'levelMax' | 'starts'>): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  const max = rules.starts ? rules.starts.length : rules.levelMax;
  let level = 1;
  while (level < max && safe >= levelStartAt(level + 1, rules)) level++;
  if (level >= max) return { level, xp: safe, xpInLevel: 0, xpForNext: 0 };
  const start = levelStartAt(level, rules);
  return { level, xp: safe, xpInLevel: safe - start, xpForNext: levelStartAt(level + 1, rules) - start };
}

export interface GameResultForXp {
  mode: 'solo' | 'duel';
  outcome: 'win' | 'loss' | 'draw';
}

/** XP for one finished game; a win adds the bonus in duels (solo has no opponent, a solved puzzle counts as a win there too). */
export function xpForGame(game: GameResultForXp, rules: Pick<XpRules, 'soloBase' | 'duelBase' | 'winBonus'>): number {
  const base = game.mode === 'solo' ? rules.soloBase : rules.duelBase;
  return base + (game.outcome === 'win' ? rules.winBonus : 0);
}
