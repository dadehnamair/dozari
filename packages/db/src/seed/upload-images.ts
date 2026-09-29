import { createDb } from '../client.js';
import { s3ConfigFromEnv, uploadSeedImages } from './images.js';
import { readSeedProducts } from './load.js';

const { uploaded, missing } = await uploadSeedImages(
  createDb(),
  readSeedProducts(),
  s3ConfigFromEnv(),
);
console.log(`uploaded ${uploaded} images`);
if (missing.length > 0) console.warn(`missing on disk (skipped):\n${missing.join('\n')}`);
process.exit(0);
