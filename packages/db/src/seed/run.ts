import { createDb } from '../client.js';
import { products } from '../schema.js';
import { loadSeedKeepsakes, readSeedKeepsakes } from './keepsakes.js';
import { loadSeed, readSeedProducts, readSeedPuzzles } from './load.js';
import { loadSeedLanding, readSeedLanding } from './landing.js';
import { generateSamplePuzzles, loadSeedPuzzles, removeSampleData } from './puzzles.js';

/**
 * `pnpm --filter @dozari/db seed`            products + prices + the curated sample puzzles + generated ones (idempotent)
 * `... seed --check`                         validate the JSON only (products, puzzles, keepsakes)
 * `... seed --no-puzzles`                    products only
 * `... seed --if-empty`                     do nothing when the catalogue already has any product (what the production `seed` service uses)
 * `... seed --keepsakes-only`                 only add the starter keepsakes and their sets (insert-only; works on a live catalogue)
 * `... seed --remove-sample`                 delete everything `sample-*` and the puzzles made from it (run before launch)
 */
const seed = readSeedProducts();
const landingSeed = readSeedLanding();
const puzzleSeed = readSeedPuzzles(seed);
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
  if (process.argv.includes('--if-empty') && (await db.select({ id: products.id }).from(products).limit(1)).length > 0) {
    console.log('catalogue already has products: skipping product seed');
    console.log('landing content added:', await loadSeedLanding(db, landingSeed));
    process.exit(0);
  }
  await loadSeed(db, seed);
  console.log('landing content added:', await loadSeedLanding(db, landingSeed));
  console.log(`seeded ${seed.length} products`);
  const ks = await loadSeedKeepsakes(db, keepsakeSeed);
  console.log(`keepsakes: ${ks.keepsakes} added, ${ks.sets} set(s) added`);
  if (!process.argv.includes('--no-puzzles')) {
    const curated = await loadSeedPuzzles(db, puzzleSeed);
    const generated = await generateSamplePuzzles(db, 20);
    console.log(`puzzles: ${curated} curated + ${generated} generated`);
  }
  process.exit(0);
}
