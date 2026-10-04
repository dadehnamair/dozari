import type { TournamentDetail } from '@dozari/shared';
import { roundName, toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';

/** «فینال» / «نیمه‌نهایی» / «یک‌چهارم نهایی» / «دور ۱» for a bracket round. */
export function roundLabel(round: number, size: number): string {
  const r = roundName(round, size);
  return r.name === 'round' ? fa.tournament.round(r.n) : fa.tournament.roundNames[r.name] ?? '';
}

export function blockedText(b: TournamentDetail['blocked'], d: Pick<TournamentDetail, 'minLevel' | 'entryCoins'> & { entryGems?: number }): string | null {
  if (b === null) return null;
  if (b === 'LEVEL') return fa.tournament.needLevel(d.minLevel);
  if (b === 'COINS') return fa.tournament.needCoins(d.entryCoins);
  if (b === 'GEMS') return fa.tournament.needGems(d.entryGems ?? 0);
  return fa.tournament.blocked[b] ?? null;
}

export const placeLabel = (place: number): string => fa.tournament.places[place] ?? toPersianDigits(String(place));
