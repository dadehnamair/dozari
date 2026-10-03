import { createDb } from '../client.js';
import { loadPuzzleSeed, loadSeed, readSeedProducts, readSeedPuzzles } from './load.js';

const seed = readSeedProducts();
const puzzleSeed = readSeedPuzzles(seed);
if (process.argv.includes('--check')) {
  console.log(`seed ok: ${seed.length} products, ${puzzleSeed.length} puzzles`);
} else {
  const db = createDb();
  await loadSeed(db, seed);
  await loadPuzzleSeed(db, puzzleSeed);
  console.log(`seeded ${seed.length} products, ${puzzleSeed.length} puzzles`);
  process.exit(0);
}
