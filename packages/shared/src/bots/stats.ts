import { levelStartXp } from '../progression/level.js';
import type { Rng } from '../game/rng.js';

export interface BotStatsSpec {
  level: number;
  /** Percent of finished games won (clamped 20–85 so a bot never looks unreal). */
  winPercent: number;
  curveBase: number;
  /** Average XP one finished game earned (used to work back to a plausible number of games). */
  avgXpPerGame: number;
}

export interface BotStats {
  xp: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

/** Stats that fit a level: XP inside the level, a believable games total, wins/losses/draws with a few draws. */
export function plausibleStats(spec: BotStatsSpec, rng: Rng): BotStats {
  const lo = levelStartXp(spec.level, spec.curveBase);
  const hi = levelStartXp(spec.level + 1, spec.curveBase);
  const xp = lo + Math.floor(rng() * Math.max(1, hi - lo));
  const games = Math.max(spec.level > 1 ? 3 : 0, Math.round(xp / Math.max(1, spec.avgXpPerGame)));
  const winPct = Math.max(20, Math.min(85, spec.winPercent)) / 100;
  const draws = Math.round(games * 0.03);
  const wins = Math.min(games - draws, Math.round((games - draws) * winPct));
  return { xp, games, wins, losses: games - draws - wins, draws };
}
