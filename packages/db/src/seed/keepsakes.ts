import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSeedKeepsakes, seedKeepsakeFileSchema } from '@dozari/shared';
import type { SeedKeepsakeFile } from '@dozari/shared';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { Db } from '../client.js';
import { keepsakeDefs, keepsakeSets, products } from '../schema.js';
import { knownProductSlugs } from './catalog-index.js';

export const KEEPSAKE_SEED_DIR = join(fileURLToPath(new URL('../../seed/keepsakes', import.meta.url)));

/** Read + validate `seed/keepsakes/*.json` against the catalogue index; throws with every problem listed. */
export function readSeedKeepsakes(dir: string = KEEPSAKE_SEED_DIR): SeedKeepsakeFile[] {
  const files: SeedKeepsakeFile[] = [];
  const problems: string[] = [];
  const names = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  for (const name of names) {
    const parsed = seedKeepsakeFileSchema.safeParse(JSON.parse(readFileSync(join(dir, name), 'utf8')));
    if (!parsed.success) problems.push(...parsed.error.issues.map((i) => `${name}: ${i.path.join('.')}: ${i.message}`));
    else files.push(parsed.data);
  }
  problems.push(...checkSeedKeepsakes(files, knownProductSlugs()));
  if (problems.length > 0) throw new Error(`Invalid keepsake seed:\n${problems.join('\n')}`);
  return files;
}

/**
 * Insert-only and idempotent by title: a set or keepsake that already exists is left alone, so nothing an admin edited (art key, texts, gems) is ever overwritten.
 * Returns how many rows were added.
 */
export async function loadSeedKeepsakes(db: Db, files: readonly SeedKeepsakeFile[] = readSeedKeepsakes()): Promise<{ sets: number; keepsakes: number }> {
  let addedSets = 0;
  let addedKeepsakes = 0;
  const setIds = new Map<string, string>();
  for (const f of files) {
    for (const s of f.sets) {
      const [have] = await db.select({ id: keepsakeSets.id }).from(keepsakeSets).where(eq(keepsakeSets.titleFa, s.title_fa));
      if (have) {
        setIds.set(s.key, have.id);
        continue;
      }
      const id = uuidv7();
      await db.insert(keepsakeSets).values({ id, titleFa: s.title_fa, rewardGems: s.reward_gems, sortOrder: setIds.size });
      setIds.set(s.key, id);
      addedSets += 1;
    }
  }
  const productId = new Map((await db.select({ id: products.id, slug: products.slug }).from(products)).map((p) => [p.slug, p.id] as const));
  let order = 0;
  for (const f of files) {
    for (const k of f.keepsakes) {
      order += 1;
      const [have] = await db.select({ id: keepsakeDefs.id }).from(keepsakeDefs).where(eq(keepsakeDefs.titleFa, k.title_fa));
      if (have) continue;
      await db.insert(keepsakeDefs).values({
        id: uuidv7(),
        productId: k.product_slug ? (productId.get(k.product_slug) ?? null) : null,
        titleFa: k.title_fa,
        storyFa: k.story_fa,
        eraYear: k.era_year,
        rarity: k.rarity,
        pieces: k.pieces,
        setId: k.set ? (setIds.get(k.set) ?? null) : null,
        rewardGems: k.reward_gems,
        sortOrder: order,
      });
      addedKeepsakes += 1;
    }
  }
  return { sets: addedSets, keepsakes: addedKeepsakes };
}
