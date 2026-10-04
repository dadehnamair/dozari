// Turns the designer's wearable SVGs into code:  node scripts/build-wear.mjs [--check]
//   assets/wear/<slot>/<key>.svg (+ <key>.back.svg)  ->  src/components/wearArt.generated.tsx  (react-native-svg art)
//                                                      ->  ../../packages/shared/src/economy/wear-generated.ts  (key -> slot, for the server)
// --check only verifies that the committed files are up to date (CI / pre-push). Art spec: assets/wear/README.md
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWear, SLOTS } from './lib/wearSvg.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets', 'wear');
const outArt = join(root, 'src', 'components', 'wearArt.generated.tsx');
const outSlots = join(root, '..', '..', 'packages', 'shared', 'src', 'economy', 'wear-generated.ts');

const files = [];
for (const slot of SLOTS) {
  const dir = join(assets, slot);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) if (name.endsWith('.svg') && !name.startsWith('_')) files.push({ slot, name, src: readFileSync(join(dir, name), 'utf8') });
}

const out = buildWear(files);
if (out.errors) {
  console.error(out.errors.map((e) => `  ✗ ${e}`).join('\n'));
  process.exit(1);
}
const check = process.argv.includes('--check');
let stale = false;
for (const [file, text] of [[outArt, out.art], [outSlots, out.slots]]) {
  const cur = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (cur === text) continue;
  if (check) { stale = true; console.error(`  ✗ ${file} is out of date: run "pnpm --filter @dozari/mobile wear:build"`); } else writeFileSync(file, text);
}
if (check && stale) process.exit(1);
console.log(`${out.keys.length} wearable(s): ${out.keys.join(', ') || '-'}${check ? ' (up to date)' : ''}`);
