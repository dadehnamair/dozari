import { z } from 'zod';

/** Mirrors the `product_category` enum in packages/db (docs/logic/data-model.md §Catalog). */
export const PRODUCT_CATEGORIES = [
  'car',
  'food',
  'snack',
  'drink',
  'digital',
  'electronics',
  'housing',
  'transport',
  'education',
  'entertainment',
  'clothing',
  'hygiene',
  'service',
  'other',
] as const;

export const PRODUCT_STATUSES = ['in_production', 'discontinued', 'changed'] as const;
export const AUDIENCES = ['kids', 'teens', 'adults', 'elderly', 'family'] as const;
export const PRICE_SOURCE_TYPES = [
  'archive_newspaper',
  'official_list',
  'receipt_photo',
  'website',
  'user_memory',
  'other',
] as const;
export const PRICE_STATUSES = ['approved', 'pending', 'rejected'] as const;

/** Solar Hijri year range accepted in seeds. */
export const MIN_SEED_YEAR = 1300;
export const MAX_SEED_YEAR = 1450;

/** Seeds always state the unit explicitly (rule 2): exactly one of `toman` / `rials`. */
const priceAmountShape = {
  toman: z.number().positive().optional(),
  rials: z.number().positive().optional(),
};

export const seedPricePointSchema = z
  .object({
    year: z.number().int().min(MIN_SEED_YEAR).max(MAX_SEED_YEAR),
    month: z.number().int().min(1).max(12).nullable().optional(),
    ...priceAmountShape,
    source_type: z.enum(PRICE_SOURCE_TYPES),
    source_url: z.string().url().optional(),
    source_note: z.string().optional(),
    confidence: z.number().int().min(1).max(3),
    status: z.enum(PRICE_STATUSES).default('approved'),
  })
  .strict()
  .superRefine((p, ctx) => {
    if ((p.toman === undefined) === (p.rials === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'exactly one of `toman` or `rials` is required' });
      return;
    }
    const rials = p.rials ?? (p.toman as number) * 10;
    // Rule 2: integer rials only; sub-rial fractions are rejected instead of rounded.
    if (!Number.isInteger(rials)) {
      ctx.addIssue({ code: 'custom', message: 'price must resolve to an integer number of rials' });
    }
    if (p.source_type === 'user_memory' && p.confidence !== 1) {
      ctx.addIssue({ code: 'custom', message: 'user_memory prices must have confidence 1' });
    }
  });

export const seedImageSchema = z
  .object({
    file: z.string().min(1),
    year_from: z.number().int().nullable().optional(),
    year_to: z.number().int().nullable().optional(),
    is_primary: z.boolean().default(false),
    credit: z.string().optional(),
  })
  .strict();

export const seedProductSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase ascii kebab-case'),
    name_fa: z.string().min(1),
    /** Emoji shown on puzzle tiles until real product photos exist (product content, not UI chrome). */
    icon: z.string().min(1).max(16).optional(),
    brand: z.string().optional(),
    category: z.enum(PRODUCT_CATEGORIES),
    unit_fa: z.string().optional(),
    audience: z.array(z.enum(AUDIENCES)).default([]),
    era_tags: z.array(z.string()).default([]),
    story_fa: z.string().optional(),
    status: z.enum(PRODUCT_STATUSES).default('in_production'),
    images: z.array(seedImageSchema).default([]),
    prices: z.array(seedPricePointSchema).min(1),
  })
  .strict();

export const seedFileSchema = z.array(seedProductSchema);

export type SeedPricePoint = z.infer<typeof seedPricePointSchema>;
export type SeedProduct = z.infer<typeof seedProductSchema>;

/** Resolve a validated seed price to integer rials (1 toman = 10 rials). */
export function seedPriceToRials(p: Pick<SeedPricePoint, 'toman' | 'rials'>): bigint {
  const rials = p.rials ?? (p.toman as number) * 10;
  return BigInt(rials);
}

/** Cross-file checks that a per-product schema can't express. Returns human-readable errors. */
export function checkSeedProducts(products: readonly SeedProduct[]): string[] {
  const errors: string[] = [];
  const slugs = new Set<string>();
  for (const product of products) {
    if (slugs.has(product.slug)) errors.push(`duplicate slug: ${product.slug}`);
    slugs.add(product.slug);

    const keys = new Set<string>();
    for (const p of product.prices) {
      if (p.status !== 'approved') continue;
      const key = `${p.year}-${p.month ?? 'y'}`;
      if (keys.has(key)) errors.push(`${product.slug}: duplicate approved price for ${p.year}/${p.month ?? '-'}`);
      keys.add(key);
    }
  }
  return errors;
}
