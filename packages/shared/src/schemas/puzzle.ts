import { z } from 'zod';
import { MAX_SEED_YEAR, MIN_SEED_YEAR } from './catalog.js';

/** Rule kinds that have a seed shape so far (docs/logic/puzzle-generation.md §Rule types). */
export const SEED_RULE_KINDS = [
  'era_icon',
  'price_band_at_year',
  'same_price_at_year',
  'first_crossed',
  'multiplier_between',
] as const;

const year = z.number().int().min(MIN_SEED_YEAR).max(MAX_SEED_YEAR);
const toman = z.number().positive();

/** Seeds state the unit explicitly (rule 2); the loader stores rials. */
export const seedRuleSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('era_icon'), era_tag: z.string().min(1) }).strict(),
    z
      .object({ kind: z.literal('price_band_at_year'), year, min_toman: toman, max_toman: toman })
      .strict(),
    z
      .object({
        kind: z.literal('same_price_at_year'),
        year,
        target_toman: toman,
        tolerance_pct: z.number().int().min(1).max(100),
      })
      .strict(),
    z
      .object({
        kind: z.literal('first_crossed'),
        threshold_toman: toman,
        from_year: year,
        to_year: year,
      })
      .strict(),
    z
      .object({
        kind: z.literal('multiplier_between'),
        year_a: year,
        year_b: year,
        min_multiplier: z.number().positive(),
      })
      .strict(),
  ])
  .superRefine((r, ctx) => {
    const bad = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (r.kind === 'price_band_at_year' && r.min_toman > r.max_toman)
      bad('min_toman must be <= max_toman');
    if (r.kind === 'first_crossed' && r.from_year > r.to_year) bad('from_year must be <= to_year');
    if (r.kind === 'multiplier_between' && r.year_a >= r.year_b)
      bad('year_a must be before year_b');
  });

export const PUZZLE_SOURCES = ['generated', 'curated', 'ugc'] as const;
export const PUZZLE_STATUSES = ['draft', 'approved', 'retired'] as const;

export const seedPuzzleGroupSchema = z
  .object({
    level: z.number().int().min(0).max(3),
    title_fa: z.string().min(1),
    explanation_fa: z.string().min(1),
    rule: seedRuleSchema,
    /** Product slugs. */
    items: z.array(z.string()).length(4),
  })
  .strict();

export const seedPuzzleSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase ascii kebab-case'),
    source: z.enum(PUZZLE_SOURCES).default('curated'),
    status: z.enum(PUZZLE_STATUSES).default('draft'),
    groups: z.array(seedPuzzleGroupSchema).length(4),
  })
  .strict();

export const seedPuzzleFileSchema = z.array(seedPuzzleSchema);

export type SeedRule = z.infer<typeof seedRuleSchema>;
export type SeedPuzzle = z.infer<typeof seedPuzzleSchema>;

/**
 * Structural checks (puzzle-generation.md §Validation 1) plus slug references into the catalog.
 * Rule evaluation / uniqueness (checks 2–4) belong to `validatePuzzle` (Phase 2) and are not
 * duplicated here. Returns human-readable errors.
 */
export function checkSeedPuzzles(
  puzzles: readonly SeedPuzzle[],
  productSlugs: ReadonlySet<string>,
): string[] {
  const errors: string[] = [];
  const slugs = new Set<string>();
  for (const pz of puzzles) {
    if (slugs.has(pz.slug)) errors.push(`duplicate puzzle slug: ${pz.slug}`);
    slugs.add(pz.slug);

    const levels = pz.groups.map((g) => g.level).sort();
    if (levels.join() !== '0,1,2,3') errors.push(`${pz.slug}: levels must be exactly 0,1,2,3`);

    const items = pz.groups.flatMap((g) => g.items);
    if (new Set(items).size !== 16) errors.push(`${pz.slug}: needs 16 distinct products`);
    for (const item of items) {
      if (!productSlugs.has(item)) errors.push(`${pz.slug}: unknown product slug ${item}`);
    }
  }
  return errors;
}
