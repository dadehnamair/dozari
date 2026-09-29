import { formatPersianNumber } from './persian-digits.js';

/**
 * Converts a nominal integer-rial price (per CLAUDE.md rule 2 — money is always stored as
 * integer rials, BIGINT, never a float) into the human-readable toman string the app displays
 * everywhere. Mirrors the tiering the prototype (`prototype/index.html`'s `fmtT`) already used,
 * promoted here to the real, tested implementation.
 *
 * Nominality is preserved — this only changes units/formatting, never inflation-adjusts (rule 1).
 */
export function rialsToTomanString(priceRials: number | bigint): string {
  const rials = typeof priceRials === 'bigint' ? priceRials : BigInt(Math.round(priceRials));
  if (rials <= 0n) {
    throw new Error('rialsToTomanString: priceRials must be a positive integer number of rials');
  }

  // 1 toman = 10 rials. Some historical prices are sub-toman (e.g. 5 rials), so toman can be
  // fractional — those are shown in rials instead, never as "0.5 تومن".
  const toman = Number(rials) / 10;

  if (toman < 1) return `${formatPersianNumber(Number(rials))} ریال`;
  if (toman < 1_000) return `${formatPersianNumber(toman)} تومن`;
  if (toman < 1_000_000) return `${formatPersianNumber(toman / 1_000, 1)} هزار تومن`;
  if (toman < 1_000_000_000) return `${formatPersianNumber(toman / 1_000_000, 1)} میلیون تومن`;
  return `${formatPersianNumber(toman / 1_000_000_000, 1)} میلیارد تومن`;
}
