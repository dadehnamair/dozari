// Finishes the web export for the PWA (D102): stamps `dist/sw.js` with a build version and the list of files to
// precache, so the installed app opens offline and every release replaces the old cache. Run after
// `expo export -p web` (the `build:web` script does both).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
/** Files the app never needs offline (source maps, metadata) or that must not cache themselves. */
const SKIP = [/\.map$/, /^sw\.js$/, /^metadata\.json$/, /(^|\/)\.[^/]*$/];
/** Precaching very large files (videos, raw art) would make the first visit heavy; they load on demand instead. */
const MAX_BYTES = 2_000_000;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const files = walk(dist)
  .map((full) => ({ full, rel: relative(dist, full).split(sep).join('/') }))
  .filter(({ rel, full }) => !SKIP.some((re) => re.test(rel)) && statSync(full).size <= MAX_BYTES)
  .sort((a, b) => a.rel.localeCompare(b.rel));

const hash = createHash('sha256');
for (const f of files) hash.update(f.rel).update(readFileSync(f.full));
const version = hash.digest('hex').slice(0, 12);
const precache = files.map((f) => '/' + f.rel.replace(/(^|\/)index\.html$/, '$1'));

const swPath = join(dist, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
const out = sw
  .replace(/^const VERSION = .*;$/m, `const VERSION = ${JSON.stringify(version)};`)
  .replace(/^const PRECACHE = .*;$/m, `const PRECACHE = ${JSON.stringify(precache)};`);
if (out === sw) throw new Error('pwa-build: VERSION / PRECACHE lines not found in dist/sw.js');
writeFileSync(swPath, out);
console.log(`pwa-build: sw.js version ${version}, ${precache.length} files precached`);
