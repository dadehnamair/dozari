/**
 * Pure catalog/puzzle types for the rule evaluators and validator (docs/logic/puzzle-generation.md).
 * The catalog handed to this module must contain APPROVED price points only; callers (server /
 * generator) filter before building it, so nothing here ever sees pending or rejected data.
 */

export interface CatalogPricePoint {
  year: number;
  month: number | null;
  /** Nominal integer rials (rule 2). */
  priceRials: bigint;
}

import type { AgeTrack } from '../config/ageTracks.js';

export interface CatalogProduct {
  id: string;
  category: string;
  /** Lowest age track the item is meant for (D198); missing = adult. */
  ageTrack?: AgeTrack;
  eraTags: readonly string[];
  prices: readonly CatalogPricePoint[];
}

export type Catalog = readonly CatalogProduct[];

/** `unknown` = the data needed to decide is missing (never silently treated as yes or no). */
export type Tri = 'yes' | 'no' | 'unknown';

export interface RuleContext {
  catalog: Catalog;
  byId: ReadonlyMap<string, CatalogProduct>;
}

export function makeRuleContext(catalog: Catalog): RuleContext {
  return { catalog, byId: new Map(catalog.map((p) => [p.id, p])) };
}
