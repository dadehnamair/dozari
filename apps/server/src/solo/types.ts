import type { GroupLevel } from '@dozari/shared';

/** A puzzle as the server holds it: the full solution plus the texts revealed on solving. */
export interface ServedPuzzle {
  id: string;
  groups: readonly {
    level: GroupLevel;
    productIds: readonly string[];
    titleFa: string;
    explanationFa: string;
    /** Year the group's rule refers to, for the chart marker. */
    ruleYear?: number;
  }[];
  /** Everything a card shows. No prices during play (docs/logic/puzzle-generation.md §Board). */
  items: Readonly<Record<string, { nameFa: string; unitFa: string | null }>>;
}

/** I/O boundary: where playable puzzles come from. */
export interface PricePointRow {
  year: number;
  month: number | null;
  priceRials: bigint;
}

export interface PuzzleSource {
  /** Approved price points per product, for the result chart. */
  pricesFor(productIds: readonly string[]): Promise<Record<string, PricePointRow[]>>;
  /** A random approved puzzle, or null when none exist. */
  pickRandom(): Promise<ServedPuzzle | null>;
}

/** What a client may see (the shared wire contract). */
export type { SoloView } from '@dozari/shared';
