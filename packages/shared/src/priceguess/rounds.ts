import { priceAt } from '../puzzle/price.js';
import type { CatalogProduct } from '../puzzle/types.js';
import type { Rng } from '../game/rng.js';
import type { GroupLevel } from '../game/solo.js';

export interface PriceGuessGroup {
  level: GroupLevel;
  productIds: readonly string[];
  /** The year the group's rule refers to, when it has one. */
  ruleYear?: number;
}

export interface PriceGuessRound {
  level: GroupLevel;
  productId: string;
  year: number;
  /** The real nominal price. Never sent to clients before the round is revealed. */
  actualRials: bigint;
}

/** Latest year in which the product has an approved price, or null. */
export function latestPricedYear(product: CatalogProduct): number | null {
  return product.prices.length === 0 ? null : Math.max(...product.prices.map((p) => p.year));
}

/**
 * One round per group, yellow to purple. The asked item is a random product of the group; the year
 * is the group's rule year if it has one, else the product's most recent priced year. Items with no
 * usable price are skipped (another item of the group is drawn); a group with none yields no round.
 */
export function selectRounds(
  groups: readonly PriceGuessGroup[],
  catalog: readonly CatalogProduct[],
  rng: Rng,
): PriceGuessRound[] {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const rounds: PriceGuessRound[] = [];
  for (const group of [...groups].sort((a, b) => a.level - b.level)) {
    const usable: PriceGuessRound[] = [];
    for (const id of group.productIds) {
      const product = byId.get(id);
      if (!product) continue;
      const year = group.ruleYear ?? latestPricedYear(product);
      if (year === null) continue;
      const actual = priceAt(product, year);
      if (actual === null || actual <= 0n) continue;
      usable.push({ level: group.level, productId: id, year, actualRials: actual });
    }
    if (usable.length === 0) continue;
    rounds.push(usable[Math.floor(rng() * usable.length)] as PriceGuessRound);
  }
  return rounds;
}
