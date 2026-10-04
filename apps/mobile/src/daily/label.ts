import type { DailyStatus } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';

/** The Home button's text for today's puzzle: what it is, and what a solve is worth or has done. */
export function dailyPuzzleLabel(s: DailyStatus): string {
  const t = fa.dailyPuzzle;
  const name = s.themeTitleFa ? `${t.title} · ${s.themeTitleFa}` : t.title;
  if (s.state === 'won') return `${name} · ${t.won}`;
  if (s.state === 'lost') return `${name} · ${t.lost}`;
  if (s.state === 'playing') return `${name} · ${t.playing}`;
  return `${name} · ${toPersianDigits(String(s.rewardCoins))} ${t.coins}`;
}
