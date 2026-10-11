import { z } from 'zod';

const year = z.number().int().min(1300).max(1450);
/** Integer rials. JSON-safe up to 2^53, far above any real price. */
const rials = z.number().int().nonnegative();

export const priceBandAtYearSchema = z.object({
  kind: z.literal('price_band_at_year'),
  year,
  min: rials,
  max: rials,
});

export const samePriceAtYearSchema = z.object({
  kind: z.literal('same_price_at_year'),
  year,
  target: rials.refine((n) => n > 0, 'target must be positive'),
  tolerancePct: z.number().int().min(0).max(100),
});

export const firstCrossedSchema = z.object({
  kind: z.literal('first_crossed'),
  threshold: rials,
  fromYear: year,
  toYear: year,
});

export const multiplierBetweenSchema = z.object({
  kind: z.literal('multiplier_between'),
  yearA: year,
  yearB: year,
  minX: z.number().int().positive(),
  maxX: z.number().int().positive(),
});

export const cheaperThanRefSchema = z.object({
  kind: z.literal('cheaper_than_ref'),
  year,
  refProductId: z.string().min(1),
});

export const eraIconSchema = z.object({
  kind: z.literal('era_icon'),
  eraTag: z.string().min(1),
});

export const categoryPriceRankSchema = z.object({
  kind: z.literal('category_price_rank'),
  year,
  category: z.string().min(1),
  /** Product must be among the `rank` cheapest of its category in `year` (1 = the single cheapest). */
  rank: z.number().int().positive(),
});

export const themeTagSchema = z.object({
  kind: z.literal('theme_tag'),
  /** Theme key (see `themes.ts`); a product matches when it carries the tag `theme:<key>`. */
  theme: z.string().min(1).max(40),
});

export const curatedSchema = z.object({
  kind: z.literal('curated'),
  note: z.string(),
});

export const ruleSchema = z
  .discriminatedUnion('kind', [
    priceBandAtYearSchema,
    samePriceAtYearSchema,
    firstCrossedSchema,
    multiplierBetweenSchema,
    cheaperThanRefSchema,
    eraIconSchema,
    categoryPriceRankSchema,
    themeTagSchema,
    curatedSchema,
  ])
  .superRefine((r, ctx) => {
    if (r.kind === 'price_band_at_year' && r.min > r.max) {
      ctx.addIssue({ code: 'custom', message: 'min must be <= max' });
    }
    if (r.kind === 'first_crossed' && r.fromYear > r.toYear) {
      ctx.addIssue({ code: 'custom', message: 'fromYear must be <= toYear' });
    }
    if (r.kind === 'multiplier_between' && r.minX > r.maxX) {
      ctx.addIssue({ code: 'custom', message: 'minX must be <= maxX' });
    }
  });

export type Rule = z.infer<typeof ruleSchema>;
export type RuleKind = Rule['kind'];

/** All rule kinds, in spec order. Mirrored by the `rule_kind` enums in packages/db. */
export const RULE_KINDS = [
  'price_band_at_year',
  'same_price_at_year',
  'first_crossed',
  'multiplier_between',
  'cheaper_than_ref',
  'era_icon',
  'category_price_rank',
  'theme_tag',
  'curated',
] as const satisfies readonly RuleKind[];
