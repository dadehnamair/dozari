export const SKILL_TIERS = ['novice', 'beginner', 'pro'] as const;
export type SkillTier = (typeof SKILL_TIERS)[number];

export interface SkillRules {
  minGames: number;
  proGames: number;
  proWinPercent: number;
}

/** novice (تازه‌کار) until enough games are finished; pro (حرفه‌ای) with enough games and a high win rate; beginner (مبتدی) between. */
export function skillTier(stats: { games: number; wins: number }, rules: SkillRules): SkillTier {
  if (stats.games < rules.minGames) return 'novice';
  const winPercent = (stats.wins * 100) / stats.games;
  return stats.games >= rules.proGames && winPercent >= rules.proWinPercent ? 'pro' : 'beginner';
}
