import { createDb } from '../client.js';
import { products } from '../schema.js';
import { loadSeed, readSeedProducts, readSeedPuzzles } from './load.js';
import { loadSeedLanding, readSeedLanding } from './landing.js';
import { generateSamplePuzzles, loadSeedPuzzles, removeSampleData } from './puzzles.js';

/**
 * `pnpm --filter @dozari/db seed`            products + prices + the curated sample puzzles + generated ones (idempotent)
 * `... seed --check`                         validate the JSON only
 * `... seed --no-puzzles`                    products only
 * `... seed --if-empty`                     do nothing when the catalogue already has any product (what the production `seed` service uses)
 * `... seed --landing-only`                 blog posts + cast + FAQ of the landing site only (insert-only; never overwrites admin edits)
 * `... seed --remove-sample`                 delete everything `sample-*` and the puzzles made from it (run before launch)
 */
const seed = readSeedProducts();
const landingSeed = readSeedLanding();
const puzzleSeed = readSeedPuzzles(seed);
if (process.argv.includes('--check')) {
  console.log(`seed ok: ${seed.length} products, ${puzzleSeed.length} curated puzzles, ${landingSeed.posts.length} posts, ${landingSeed.cast.length} cast, ${landingSeed.faq.length} faq`);
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
  if (!process.argv.includes('--no-puzzles')) {
    const curated = await loadSeedPuzzles(db, puzzleSeed);
    const generated = await generateSamplePuzzles(db, 20);
    console.log(`puzzles: ${curated} curated + ${generated} generated`);
  }
  process.exit(0);
}
