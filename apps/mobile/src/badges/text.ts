import type { SkillTier } from '@dozari/shared';
import { fa } from '../i18n/fa';

export const skillText = (tier: SkillTier): string => fa.badges.skill[tier] ?? '';

/** «سطح ۷ از ۱۰» style progress for a locked badge, capped at the target. */
export function progressText(metric: string, have: number, min: number): string {
  const label = fa.badges.metric[metric] ?? '';
  return fa.badges.progress(label, Math.min(have, min), min);
}
