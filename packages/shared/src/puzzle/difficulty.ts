/**
 * How hard a generated puzzle should be for a player of a given level (docs/logic/puzzle-generation.md §Generator by player level).
 * Pure data + one lookup: the generator reads the profile, so "which rules, how wide the bands, how many red herrings" is tuned here only.
 */
import type { Level } from './validate.js';

/** Rule kinds the generator can instantiate (everything except `curated`). */
export type GenKind =
  | 'price_band_at_year'
  | 'same_price_at_year'
  | 'first_crossed'
  | 'multiplier_between'
  | 'cheaper_than_ref'
  | 'era_icon'
  | 'category_price_rank';

export const GEN_KINDS = [
  'price_band_at_year',
  'same_price_at_year',
  'first_crossed',
  'multiplier_between',
  'cheaper_than_ref',
  'era_icon',
  'category_price_rank',
] as const satisfies readonly GenKind[];

export type KindWeights = Partial<Record<GenKind, number>>;

export interface GenerationProfile {
  /** 0 = first puzzles of a new player .. 4 = veteran; matches the five default puzzle tiers. */
  stage: 0 | 1 | 2 | 3 | 4;
  /** Multiplies every price band / tolerance / year window: > 1 = looser (easier), < 1 = tighter (harder). */
  scale: number;
  /** Cross-group near misses the puzzle must have (more red herrings = harder). */
  minNearMisses: number;
  /** Relative chance of each rule kind per group level (yellow 0 .. purple 3). */
  weights: Record<Level, KindWeights>;
}

/** Player level where each stage starts (stage 0 begins at level 1). Mirrors `DEFAULT_PUZZLE_TIERS`. */
export const STAGE_STARTS = [1, 4, 9, 16, 26] as const;

const PROFILES: readonly GenerationProfile[] = [
  {
    stage: 0,
    scale: 1.15,
    minNearMisses: 2,
    weights: {
      0: { era_icon: 5, price_band_at_year: 3, category_price_rank: 1 },
      1: { price_band_at_year: 4, era_icon: 2, cheaper_than_ref: 2, category_price_rank: 3 },
      2: { price_band_at_year: 4, cheaper_than_ref: 3, category_price_rank: 3, same_price_at_year: 2 },
      3: { price_band_at_year: 4, same_price_at_year: 3, cheaper_than_ref: 2 },
    },
  },
  {
    stage: 1,
    scale: 1.08,
    minNearMisses: 2,
    weights: {
      0: { era_icon: 4, price_band_at_year: 3, category_price_rank: 2 },
      1: { price_band_at_year: 3, same_price_at_year: 2, cheaper_than_ref: 2, category_price_rank: 3, era_icon: 1 },
      2: { price_band_at_year: 3, same_price_at_year: 3, cheaper_than_ref: 2, category_price_rank: 2, first_crossed: 2 },
      3: { multiplier_between: 3, same_price_at_year: 3, first_crossed: 3, price_band_at_year: 2 },
    },
  },
  {
    stage: 2,
    scale: 1,
    minNearMisses: 2,
    weights: {
      0: { era_icon: 3, price_band_at_year: 3, category_price_rank: 2, cheaper_than_ref: 1 },
      1: { price_band_at_year: 3, same_price_at_year: 3, cheaper_than_ref: 2, category_price_rank: 2, first_crossed: 2 },
      2: { same_price_at_year: 3, first_crossed: 3, cheaper_than_ref: 2, category_price_rank: 2, multiplier_between: 2, price_band_at_year: 2 },
      3: { multiplier_between: 4, first_crossed: 3, same_price_at_year: 3, price_band_at_year: 2 },
    },
  },
  {
    stage: 3,
    scale: 0.8,
    minNearMisses: 3,
    weights: {
      0: { era_icon: 2, price_band_at_year: 3, category_price_rank: 2, cheaper_than_ref: 2 },
      1: { same_price_at_year: 3, first_crossed: 3, cheaper_than_ref: 2, category_price_rank: 2, price_band_at_year: 2, multiplier_between: 1 },
      2: { first_crossed: 3, multiplier_between: 3, same_price_at_year: 3, cheaper_than_ref: 2, category_price_rank: 1 },
      3: { multiplier_between: 4, first_crossed: 4, same_price_at_year: 3 },
    },
  },
  {
    stage: 4,
    scale: 0.65,
    minNearMisses: 3,
    weights: {
      0: { price_band_at_year: 3, era_icon: 1, category_price_rank: 2, cheaper_than_ref: 2, same_price_at_year: 1 },
      1: { same_price_at_year: 3, first_crossed: 3, multiplier_between: 2, cheaper_than_ref: 2, category_price_rank: 1 },
      2: { first_crossed: 4, multiplier_between: 3, same_price_at_year: 3, cheaper_than_ref: 1 },
      3: { multiplier_between: 4, first_crossed: 4, same_price_at_year: 3 },
    },
  },
];

/** The generation profile for a player of `playerLevel` (levels below 1 count as 1). */
export function profileForLevel(playerLevel: number): GenerationProfile {
  let stage = 0;
  for (let i = 0; i < STAGE_STARTS.length; i++) if (playerLevel >= (STAGE_STARTS[i] as number)) stage = i;
  return PROFILES[stage] as GenerationProfile;
}

/** A representative player level for a tier range, so a tier can drive the generator: the middle of a closed range, else min + 5. */
export function representativeLevel(minLevel: number, maxLevel: number | null): number {
  return maxLevel === null ? minLevel + 5 : Math.floor((minLevel + maxLevel) / 2);
}
