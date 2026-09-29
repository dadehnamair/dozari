import { createDb } from '../client.js';
import { loadSeed, readSeedProducts } from './load.js';

const seed = readSeedProducts();
if (process.argv.includes('--check')) {
  console.log(`seed ok: ${seed.length} products`);
} else {
  await loadSeed(createDb(), seed);
  console.log(`seeded ${seed.length} products`);
  process.exit(0);
}
