import type { TournamentDetail } from '@dozari/shared';
import { roundName, toPersianDigits } from '@dozari/shared';
import { formatCountdown } from '../daily/countdown';
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

const UNITS = [['month', 30 * 86_400], ['week', 7 * 86_400], ['day', 86_400], ['hour', 3600]] as const;

/** «۱ ماه و ۲ هفته» for a far start (the two largest units), «۰۵:۱۲:۰۹» once it is under a day away. */
export function startsInText(target: number, now: number): string {
  let left = Math.max(0, Math.floor((target - now) / 1000));
  if (left < 86_400) return formatCountdown(target, now);
  const parts: string[] = [];
  for (const [unit, secs] of UNITS) {
    const q = Math.floor(left / secs);
    left -= q * secs;
    if (q > 0 && parts.length < 2) parts.push(`${toPersianDigits(String(q))} ${fa.tournament.units[unit]}`);
  }
  return parts.join(fa.tournament.unitsJoin);
}
