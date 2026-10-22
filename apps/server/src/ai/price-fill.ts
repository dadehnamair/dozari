import { z } from 'zod';
import { AI_LIMITS } from '@dozari/shared';
import { extractJson } from './content.js';

/**
 * «Fill missing prices» for ONE existing product (admin product dialog, docs/logic/ai-studio.md).
 * Pure: prompt in, validated suggestions out. Suggestions are only ever saved as `pending` price points by the existing price route.
 */

export const PRICE_FILL_YEARS = { min: 1300, max: 1450, defaultFrom: 1350, defaultTo: 1405 } as const;
export const PRICE_FILL_MAX_SUGGESTIONS = 12;

export const priceFillRequestSchema = z.object({
  provider: z.string().min(1).max(20),
  model: z.string().trim().max(80).optional(),
  /** An existing product, or (for an unsaved AI draft) its name and unit. */
  productId: z.string().min(1).max(36).optional(),
  nameFa: z.string().trim().min(2).max(80).optional(),
  unitFa: z.string().trim().max(30).nullable().optional(),
  /** Extra instructions typed by the editor (brand, size, region…); passed as a hint only. */
  hint: z.string().trim().max(AI_LIMITS.maxHintLength).optional(),
  fromYear: z.number().int().min(PRICE_FILL_YEARS.min).max(PRICE_FILL_YEARS.max).optional(),
  toYear: z.number().int().min(PRICE_FILL_YEARS.min).max(PRICE_FILL_YEARS.max).optional(),
}).refine((r) => !!r.productId || !!r.nameFa, { message: 'productId or nameFa' });
export type PriceFillRequest = z.infer<typeof priceFillRequestSchema>;

export interface PriceFillProduct {
  nameFa: string;
  unitFa: string | null;
  /** Solar years that already have a price point (any status). */
  years: readonly number[];
}

export interface PriceSuggestion {
  year: number;
  priceToman: number;
}

export function buildPriceFillPrompt(p: PriceFillProduct, req: PriceFillRequest): { system: string; user: string; years: { from: number; to: number } } {
  const from = req.fromYear ?? PRICE_FILL_YEARS.defaultFrom;
  const to = Math.max(from, req.toYear ?? PRICE_FILL_YEARS.defaultTo);
  const have = [...p.years].sort((a, b) => a - b);
  const system = [
    'You help an editor of «دوزاری» (Dozari), a Persian game about Iranian price nostalgia, to fill in historical prices.',
    'Give NOMINAL prices only: the price printed on the shelf or list in that Solar Hijri year, never inflation-adjusted, in toman as integers.',
    'Only give a price you genuinely remember or can reasonably estimate for that product and year; skip a year rather than guess wildly. Never invent a source.',
    'Reply with ONE JSON object only: no markdown fences, no commentary.',
  ].join('\n');
  const user = [
    `Product: ${p.nameFa}${p.unitFa ? ` (${p.unitFa})` : ''}`,
    `Years that already have a price (do NOT repeat them): ${have.length > 0 ? have.join(', ') : 'none'}`,
    `Give up to ${PRICE_FILL_MAX_SUGGESTIONS} prices for other years between ${from} and ${to}, well spread over the range.`,
    req.hint ? `Editor's note (a hint only): ${req.hint}` : '',
    'JSON shape: {"prices":[{"year":1375,"priceToman":150}]}',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user, years: { from, to } };
}

/** Valid, de-duplicated suggestions for years the product does not have yet, ascending; null when the answer is not the expected JSON. */
export function parsePriceFill(text: string, have: readonly number[], range: { from: number; to: number }): { prices: PriceSuggestion[]; dropped: number } | null {
  const json = extractJson(text) as { prices?: unknown } | null;
  if (!json || !Array.isArray(json.prices)) return null;
  const taken = new Set(have);
  const out: PriceSuggestion[] = [];
  let dropped = 0;
  for (const raw of json.prices) {
    const r = z.object({ year: z.number().int(), priceToman: z.number().int().min(1).max(100_000_000_000) }).safeParse(raw);
    if (!r.success || r.data.year < range.from || r.data.year > range.to || taken.has(r.data.year) || out.length >= PRICE_FILL_MAX_SUGGESTIONS) {
      dropped++;
      continue;
    }
    taken.add(r.data.year);
    out.push(r.data);
  }
  out.sort((a, b) => a.year - b.year);
  return { prices: out, dropped };
}
