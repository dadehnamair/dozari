import { PRICE_GUESS_MIN_POINTS, PRICE_GUESS_STAIRCASE } from '../config/index.js';

const abs = (n: bigint) => (n < 0n ? -n : n);

/** Absolute distance between a guess and the real price, in rials. */
export const guessDistance = (guess: bigint, actual: bigint): bigint => abs(guess - actual);

/**
 * Solo staircase: points by relative error, `|guess - actual| / actual * 100 <= maxErrorPct`,
 * evaluated in integers (no floats). Throws on a non-positive actual price.
 */
export function staircasePoints(
  guess: bigint,
  actual: bigint,
  tiers: readonly { maxErrorPct: number; points: number }[] = PRICE_GUESS_STAIRCASE,
  minPoints: number = PRICE_GUESS_MIN_POINTS,
): number {
  if (actual <= 0n) throw new Error('staircasePoints: actual price must be positive');
  const err100 = guessDistance(guess, actual) * 100n;
  for (const tier of tiers) {
    if (err100 <= actual * BigInt(tier.maxErrorPct)) return tier.points;
  }
  return minPoints;
}

const DIGITS: Record<string, string> = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

/**
 * Reads what a player typed as a price in TOMAN (Persian/Arabic/ASCII digits, optional `, ، ٬` thousands
 * separators) and returns integer rials (1 toman = 10 rials), or null if it is not a positive whole number.
 */
export function parseTomanInput(text: string): bigint | null {
  const ascii = text.replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d] ?? d).replace(/[,،٬\s]/g, '');
  if (!/^\d+$/.test(ascii)) return null;
  const toman = BigInt(ascii);
  return toman > 0n ? toman * 10n : null;
}
