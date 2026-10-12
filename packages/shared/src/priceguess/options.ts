import type { Rng } from '../game/rng.js';
import { shuffled } from '../game/rng.js';

/** How many choices a price question offers (one right, the rest decoys). */
export const PRICE_OPTION_COUNT = 4;

/** Decoy price as a fraction of the real one: some lower, some higher, so the real price is not always the middle one. */
const LOW: readonly (readonly [bigint, bigint])[] = [[1n, 3n], [1n, 2n], [2n, 3n], [4n, 5n]];
const HIGH: readonly (readonly [bigint, bigint])[] = [[5n, 4n], [3n, 2n], [2n, 1n], [5n, 2n]];

const TEN = 10n;

/** The coarsest power of ten (in rials, at least 10 = one toman) that divides `n`, but never so coarse that the price loses its last two digits. */
function roundingUnit(n: bigint): bigint {
  let unit = TEN;
  while (n % (unit * TEN) === 0n && n / (unit * TEN) >= 10n) unit *= TEN;
  return unit;
}

/**
 * The four choices of a price question, ascending: the real price and three decoys. Decoys are the real price times a plausible
 * factor, rounded to the same "roundness" as the real price so the right answer never stands out by its digits. All are positive,
 * whole tomans and distinct. Pure given the rng. A real price too small to tell apart gets decoys one step apart.
 */
export function buildPriceOptions(actualRials: bigint, rng: Rng, count: number = PRICE_OPTION_COUNT): bigint[] {
  if (actualRials <= 0n) throw new RangeError('buildPriceOptions: the price must be positive');
  const unit = roundingUnit(actualRials);
  const seen = new Set<bigint>([actualRials]);
  const options: bigint[] = [actualRials];
  const add = (v: bigint): boolean => {
    const rounded = ((v + unit / 2n) / unit) * unit;
    if (rounded <= 0n || seen.has(rounded)) return false;
    seen.add(rounded);
    options.push(rounded);
    return true;
  };
  const pickFrom = (pool: readonly (readonly [bigint, bigint])[]) => {
    for (const [num, den] of shuffled(pool, rng)) if (add((actualRials * num) / den)) return;
  };
  pickFrom(LOW);
  pickFrom(HIGH);
  for (const [num, den] of shuffled([...LOW, ...HIGH], rng)) {
    if (options.length >= count) break;
    add((actualRials * num) / den);
  }
  // Tiny prices collapse onto each other: step away from the real price until there are enough distinct choices.
  for (let step = 1n; options.length < count && step < 1000n; step++) {
    add(actualRials + step * unit);
    if (options.length < count) add(actualRials > step * unit ? actualRials - step * unit : actualRials + (step + 1000n) * unit);
  }
  return options.slice(0, count).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
