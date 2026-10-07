import { z } from 'zod';
import { KEEPSAKE_RARITIES } from '../config/economy.js';

/** `packages/db/seed/keepsakes/*.json`: the starter sets and keepsakes (texts written by us; the art comes later from the designer). */
export const seedKeepsakeSetSchema = z.object({ key: z.string().min(2).max(60), title_fa: z.string().min(2).max(120), reward_gems: z.number().int().min(0).max(10_000) });
export const seedKeepsakeSchema = z.object({
  key: z.string().min(2).max(60),
  /** Slug of the catalog product it is made from (checked against the product seed). */
  product_slug: z.string().nullable(),
  set: z.string().nullable(),
  title_fa: z.string().min(2).max(120),
  story_fa: z.string().min(10).max(2000),
  era_year: z.number().int().min(1300).max(1500).nullable(),
  rarity: z.enum(KEEPSAKE_RARITIES),
  pieces: z.number().int().min(1).max(12),
  reward_gems: z.number().int().min(0).max(1000),
  /** The designer's art (`yadegar-1` … `yadegar-8`, drawn by the app from `assets/keepsake`); absent = the placeholder frame. */
  art_key: z.string().min(2).max(60).nullable().optional(),
});
export const seedKeepsakeFileSchema = z.object({ sets: z.array(seedKeepsakeSetSchema), keepsakes: z.array(seedKeepsakeSchema), /** Titles of earlier starter keepsakes that this file replaces: they are switched off (never deleted, so owned pieces stay). */ retire_titles: z.array(z.string()).optional() });
export type SeedKeepsakeFile = z.infer<typeof seedKeepsakeFileSchema>;

/** Cross-checks the schema cannot do: unique keys and titles, known sets, known products. Returns the problems found. */
export function checkSeedKeepsakes(files: readonly SeedKeepsakeFile[], productSlugs: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const setKeys = new Set<string>();
  const keys = new Set<string>();
  const titles = new Set<string>();
  for (const f of files) {
    for (const s of f.sets) {
      if (setKeys.has(s.key)) problems.push(`duplicate set key ${s.key}`);
      setKeys.add(s.key);
    }
  }
  for (const f of files) {
    for (const k of f.keepsakes) {
      if (keys.has(k.key)) problems.push(`duplicate keepsake key ${k.key}`);
      keys.add(k.key);
      if (titles.has(k.title_fa)) problems.push(`duplicate keepsake title ${k.title_fa}`);
      titles.add(k.title_fa);
      if (k.set !== null && !setKeys.has(k.set)) problems.push(`${k.key}: unknown set ${k.set}`);
      if (k.product_slug !== null && !productSlugs.has(k.product_slug)) problems.push(`${k.key}: unknown product ${k.product_slug}`);
    }
  }
  return problems;
}
