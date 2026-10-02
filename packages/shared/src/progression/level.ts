export interface XpRules {
  soloBase: number;
  duelBase: number;
  winBonus: number;
  curveBase: number;
  levelMax: number;
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

export function levelInfo(xp: number, rules: Pick<XpRules, 'curveBase' | 'levelMax'>): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < rules.levelMax && safe >= levelStartXp(level + 1, rules.curveBase)) level++;
  if (level >= rules.levelMax) return { level, xp: safe, xpInLevel: 0, xpForNext: 0 };
  const start = levelStartXp(level, rules.curveBase);
  return { level, xp: safe, xpInLevel: safe - start, xpForNext: levelStartXp(level + 1, rules.curveBase) - start };
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
