import { z } from 'zod';

const mark = z.object({ year: z.number().int(), month: z.number().int().nullable(), priceRials: z.string() });

export const lookupRangeSchema = z.object({ count: z.number().int(), first: mark, last: mark, min: mark, max: mark });

/** One row of `GET /lookup/search?q=` (price lookup, D70). */
export const lookupHitSchema = z.object({
  id: z.string(),
  nameFa: z.string(),
  unitFa: z.string().nullable(),
  iconKey: z.string().nullable(),
  category: z.string(),
  range: lookupRangeSchema.nullable(),
});
export const lookupSearchSchema = z.object({ results: z.array(lookupHitSchema) });

/** `GET /lookup/:id?year=&month=`: only approved data; `at` is null when that date has no data (never an estimate). */
export const lookupDetailSchema = z.object({
  product: lookupHitSchema,
  points: z.array(mark.extend({ sourceType: z.string(), confidence: z.number().int() })),
  at: z.object({ year: z.number().int(), month: z.number().int().nullable(), priceRials: z.string() }).nullable(),
});

export type LookupRange = z.infer<typeof lookupRangeSchema>;
export type LookupHit = z.infer<typeof lookupHitSchema>;
export type LookupSearch = z.infer<typeof lookupSearchSchema>;
export type LookupDetail = z.infer<typeof lookupDetailSchema>;
