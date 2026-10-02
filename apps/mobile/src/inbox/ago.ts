import { fa } from '../i18n/fa';

const MIN = 60_000;

/** Short Persian age of a message («۲ دقیقه», «دیروز» …) as in screen-notifications. */
export function agoText(at: number, now: number): string {
  const a = fa.inbox.ago;
  const d = Math.max(0, now - at);
  if (d < MIN) return a.now;
  if (d < 60 * MIN) return a.minutes(Math.floor(d / MIN));
  if (d < 24 * 60 * MIN) return a.hours(Math.floor(d / (60 * MIN)));
  const days = Math.floor(d / (24 * 60 * MIN));
  return days === 1 ? a.yesterday : a.days(days);
}
