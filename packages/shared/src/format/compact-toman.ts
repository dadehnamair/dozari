import { formatPersianNumber } from './persian-digits.js';

/**
 * Short axis/tooltip label for a nominal rial price, in toman (1 toman = 10 rials):
 * «۱۰۰ تومن»، «۱٫۲ هزار»، «۳ میلیون»، «۱٫۵ میلیارد». Sub-toman prices fall back to rials.
 * Display only: never adjusts for inflation (rule 1).
 */
export function compactTomanLabel(priceRials: bigint): string {
  if (priceRials <= 0n) throw new Error('compactTomanLabel: priceRials must be positive');
  if (priceRials < 10n) return `${formatPersianNumber(Number(priceRials))} ریال`;
  const toman = Number(priceRials) / 10;
  if (toman < 1_000) return `${formatPersianNumber(toman, 1)} تومن`;
  if (toman < 1_000_000) return `${formatPersianNumber(toman / 1_000, 1)} هزار`;
  if (toman < 1_000_000_000) return `${formatPersianNumber(toman / 1_000_000, 1)} میلیون`;
  return `${formatPersianNumber(toman / 1_000_000_000, 1)} میلیارد`;
}
