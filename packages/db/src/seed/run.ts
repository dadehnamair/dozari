import { createDb } from '../client.js';
import { products } from '../schema.js';
import { loadSeedKeepsakes, readSeedKeepsakes } from './keepsakes.js';
import { knownProductSlugs } from './catalog-index.js';
import { loadSeed, readSeedProducts, readSeedPuzzles } from './load.js';
import { loadSeedLanding, readSeedLanding } from './landing.js';
import { generateSamplePuzzles, loadSeedPuzzles, removeSampleData } from './puzzles.js';

/**
 * The catalogue belongs to the database (edited in the admin panel): products are seeded only into an EMPTY catalogue (fresh install) or
 * with an explicit `--products`, and even then insert-only. Puzzles and keepsakes only point at products by slug.
 * `pnpm --filter @dozari/db seed`            landing content + keepsakes + curated and generated puzzles (+ products when the catalogue is empty)
 * `... seed --check`                         validate the JSON only (products, puzzles, keepsakes)
 * `... seed --products`                      also add dev seed products that are missing (never changes an existing one)
 * `... seed --no-puzzles`                    skip puzzles
 * `... seed --if-empty`                      on a catalogue that already has products: only landing content, keepsakes and curated puzzles (what the production `seed` service uses)
 * `... seed --keepsakes-only`                 only add the starter keepsakes and their sets (insert-only; works on a live catalogue)
 * `... seed --remove-sample`                 delete everything `sample-*` and the puzzles made from it (run before launch)
 */
const seed = readSeedProducts();
const landingSeed = readSeedLanding();
const puzzleSeed = readSeedPuzzles(knownProductSlugs());
const keepsakeSeed = readSeedKeepsakes();
if (process.argv.includes('--check')) {
  console.log(`seed ok: ${seed.length} products, ${puzzleSeed.length} curated puzzles, ${keepsakeSeed.reduce((n, f) => n + f.keepsakes.length, 0)} keepsakes`);
} else if (process.argv.includes('--keepsakes-only')) {
  const out = await loadSeedKeepsakes(createDb(), keepsakeSeed);
  console.log(`keepsakes: ${out.keepsakes} added, ${out.sets} set(s) added (existing ones are left alone)`);
  process.exit(0);
} else if (process.argv.includes('--remove-sample')) {
  const out = await removeSampleData(createDb());
  console.log(`removed ${out.puzzles} sample puzzle(s) and ${out.products} sample product(s)`);
  process.exit(0);
} else {
  const db = createDb();
  if (process.argv.includes('--landing-only')) {
    console.log('landing content added:', await loadSeedLanding(db, landingSeed));
    process.exit(0);
  }
  const emptyCatalog = (await db.select({ id: products.id }).from(products).limit(1)).length === 0;
  if (process.argv.includes('--if-empty') && !emptyCatalog) {
    console.log('catalogue already has products: products are not touched');
    console.log('landing content added:', await loadSeedLanding(db, landingSeed));
    const ks = await loadSeedKeepsakes(db, keepsakeSeed);
    console.log(`keepsakes: ${ks.keepsakes} added, ${ks.sets} set(s) added`);
    const out = await loadSeedPuzzles(db, puzzleSeed);
    console.log(`puzzles: ${out.made} curated added, ${out.skipped} skipped (products not in the catalogue)`);
    process.exit(0);
  }
  if (emptyCatalog || process.argv.includes('--products')) {
    await loadSeed(db, seed);
    console.log(`products: ${seed.length} from the seed files checked (insert-only)`);
  }
  console.log('landing content added:', await loadSeedLanding(db, landingSeed));
  const ks = await loadSeedKeepsakes(db, keepsakeSeed);
  console.log(`keepsakes: ${ks.keepsakes} added, ${ks.sets} set(s) added`);
  if (!process.argv.includes('--no-puzzles')) {
    const curated = await loadSeedPuzzles(db, puzzleSeed);
    const generated = await generateSamplePuzzles(db, 20);
    console.log(`puzzles: ${curated.made} curated + ${generated} generated (${curated.skipped} curated skipped: products not in the catalogue)`);
  }
  process.exit(0);
}
