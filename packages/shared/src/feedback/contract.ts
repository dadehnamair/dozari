import { z } from 'zod';
import { PRODUCT_CATEGORIES } from '../schemas/index.js';

/** Why a player reports another player (profile) or a chat message; the label lives in `fa.report`. */
export const REPORT_CATEGORIES = ['abuse', 'spam', 'cheating', 'bad_name', 'other'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const reportInputSchema = z.object({
  targetId: z.string().uuid(),
  category: z.enum(REPORT_CATEGORIES),
  details: z.string().trim().max(500).default(''),
});
export type ReportInput = z.infer<typeof reportInputSchema>;

/** `item`: a product the catalog lacks; `price_point`: a price for a product it has; `price_report`: «this price is wrong» (with an optional better price). */
export const SUBMISSION_KINDS = ['item', 'price_point', 'price_report'] as const;
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number];
export const SUBMISSION_STATUSES = ['pending', 'ready_for_review', 'approved', 'rejected'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export const SOURCE_TYPES = ['website', 'user_memory', 'other'] as const;

/** Year as typed: 4-digit Solar Hijri as is; two digits «۷۵» → 1375 for 40–99, 1400+ for 00–39 (docs/logic/ugc.md). */
export function expandYear(n: number): number | null {
  if (!Number.isInteger(n) || n < 0) return null;
  if (n >= 1300 && n <= 1499) return n;
  if (n >= 40 && n <= 99) return 1300 + n;
  if (n >= 0 && n <= 39) return 1400 + n;
  return null;
}

export const submissionInputSchema = z
  .object({
    kind: z.enum(SUBMISSION_KINDS),
    productId: z.string().uuid().optional(),
    nameFa: z.string().trim().min(2).max(80).optional(),
    category: z.enum(PRODUCT_CATEGORIES as unknown as [string, ...string[]]).optional(),
    unitFa: z.string().trim().max(60).optional(),
    year: z.number().int().min(1300).max(1499).optional(),
    /** Whole number in `unit`; the server stores rials (rule 2). */
    price: z.number().int().positive().max(10_000_000_000_000).optional(),
    unit: z.enum(['toman', 'rial']).default('toman'),
    sourceType: z.enum(SOURCE_TYPES).default('user_memory'),
    sourceText: z.string().trim().max(300).default(''),
    note: z.string().trim().max(500).default(''),
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, path: string) => ok || ctx.addIssue({ code: 'custom', path: [path], message: 'required' });
    if (v.kind === 'item') {
      need(!!v.nameFa, 'nameFa');
      need(!!v.category, 'category');
      need(v.year !== undefined, 'year');
      need(v.price !== undefined, 'price');
    } else if (v.kind === 'price_point') {
      need(!!v.productId, 'productId');
      need(v.year !== undefined, 'year');
      need(v.price !== undefined, 'price');
    } else {
      need(!!v.productId, 'productId');
      need(v.price !== undefined || v.note.length >= 3, 'note');
    }
  });
export type SubmissionInput = z.infer<typeof submissionInputSchema>;

/** One card of the voting feed (the submitter is never shown). */
export const feedCardSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(SUBMISSION_KINDS),
  nameFa: z.string(),
  year: z.number().int().nullable(),
  priceRials: z.number().int().nullable(),
  sourceType: z.enum(SOURCE_TYPES),
  sourceText: z.string(),
  note: z.string(),
});
export type FeedCard = z.infer<typeof feedCardSchema>;

/** Rials of a typed price. */
export const toRials = (price: number, unit: 'toman' | 'rial'): number => (unit === 'toman' ? price * 10 : price);
