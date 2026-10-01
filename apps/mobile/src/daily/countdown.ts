import { toPersianDigits } from '@dozari/shared';

/** «۰۵:۱۲:۰۹» until `target` (epoch ms); «۰۰:۰۰:۰۰» once it has passed. */
export function formatCountdown(target: number, now: number): string {
  const total = Math.max(0, Math.floor((target - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return toPersianDigits(`${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`);
}
