import { z } from 'zod';
import { priceAt } from '../puzzle/price.js';
import type { CatalogProduct } from '../puzzle/types.js';
import type { Rng } from '../game/rng.js';

/**
 * Price-only mode (docs/logic/price-guess-round.md §Price-only mode): a short game made only of price questions, no puzzle.
 * Each round asks the price of one product in one year; the products are distinct and the years vary.
 */
export interface PriceOnlyRound {
  productId: string;
  year: number;
  /** The real nominal price. Never sent to clients before that round is answered. */
  actualRials: bigint;
}

/** Years in which the product has a usable price, oldest first. */
function pricedYears(product: CatalogProduct): number[] {
  const years = [...new Set(product.prices.map((p) => p.year))].sort((a, b) => a - b);
  return years.filter((y) => (priceAt(product, y) ?? 0n) > 0n);
}

/** `count` rounds over distinct products (fewer when the catalog is small), each at a random priced year. Pure given the rng. */
export function selectPriceOnlyRounds(catalog: readonly CatalogProduct[], count: number, rng: Rng): PriceOnlyRound[] {
  const pool = catalog.filter((p) => pricedYears(p).length > 0);
  const rounds: PriceOnlyRound[] = [];
  const left = [...pool];
  while (rounds.length < count && left.length > 0) {
    const product = left.splice(Math.floor(rng() * left.length), 1)[0]!;
    const years = pricedYears(product);
    const year = years[Math.floor(rng() * years.length)]!;
    rounds.push({ productId: product.id, year, actualRials: priceAt(product, year)! });
  }
  return rounds;
}

const rialsString = z.string().regex(/^\d+$/);

export const priceOnlyRoundSchema = z.object({
  index: z.number().int().nonnegative(),
  productId: z.string(),
  nameFa: z.string(),
  unitFa: z.string().nullable(),
  iconKey: z.string().nullable().default(null),
  /** Solar Hijri year the price is asked for. */
  year: z.number().int(),
});

export const priceOnlyResultSchema = z.object({
  index: z.number().int().nonnegative(),
  guessRials: rialsString,
  actualRials: rialsString,
  points: z.number().int().positive(),
});

/** The whole game as the player sees it: the questions (no prices) and the answers given so far with the revealed real price. */
export const priceOnlyViewSchema = z.object({
  sessionId: z.string(),
  rounds: z.array(priceOnlyRoundSchema),
  results: z.array(priceOnlyResultSchema),
  done: z.boolean(),
  /** Best possible total, for «۱۲ از ۲۵». */
  maxPoints: z.number().int().nonnegative(),
});

export type PriceOnlyRoundView = z.infer<typeof priceOnlyRoundSchema>;
export type PriceOnlyResult = z.infer<typeof priceOnlyResultSchema>;
export type PriceOnlyView = z.infer<typeof priceOnlyViewSchema>;
