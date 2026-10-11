import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSeedProducts } from './load.js';

/**
 * The products already living in the database (a phpMyAdmin export: id, slug, name). The catalogue is owned by the database and
 * edited in the admin panel, so the seed never writes it; puzzles and keepsakes only point at these slugs, and this list lets
 * `seed --check` and the tests validate those pointers without a database. Never loaded as products.
 */
export const CATALOG_INDEX_FILE = join(fileURLToPath(new URL('../../seed/catalog-index.json', import.meta.url)));

export interface CatalogIndexEntry {
  id: string;
  slug: string;
  name_fa: string;
}

export const readCatalogIndex = (file: string = CATALOG_INDEX_FILE): CatalogIndexEntry[] => JSON.parse(readFileSync(file, 'utf8')) as CatalogIndexEntry[];

/** Slugs a puzzle or keepsake may point at: the catalogue index plus any product the dev seed files define. */
export const knownProductSlugs = (): Set<string> => new Set([...readCatalogIndex().map((p) => p.slug), ...readSeedProducts().map((p) => p.slug)]);
