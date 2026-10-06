// Turns the game's web export (apps/mobile/dist) into the mini-app page: loads Bale's SDK and our bridge first, holds the
// game bundle back until the bridge has logged the player in, and drops the PWA parts (service worker, manifest) that make no
// sense inside a messenger's web view. Usage: node prepare-dist.mjs <dist dir> <api url>
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BALE_SDK = 'https://tapi.bale.ai/miniapp.js';

/** Pure: the mini-app version of the exported index.html. */
export function transformIndex(html, apiUrl) {
  let scripts = 0;
  const held = html.replace(/<script\s+src="(\/_expo\/[^"]+)"[^>]*><\/script>/g, (_m, src) => {
    scripts++;
    return `<script type="application/x-dozari-held" data-src="${src}"></script>`;
  });
  if (!scripts) throw new Error('prepare-dist: no /_expo/ bundle script found in index.html');

  // The PWA block (service worker + install prompt) becomes an inert stub the game's own pwa module can read.
  const pwa = /<script>\s*\/\/ PWA glue[\s\S]*?<\/script>/;
  if (!pwa.test(held)) throw new Error('prepare-dist: PWA glue block not found in index.html');
  const stubbed = held.replace(pwa, '<script>window.__dozariPwa = { install: null, waiting: null };</script>');

  // Bale's docs: the SDK script goes before every other script, at the very start of <head>.
  const sdk = `<script src="${BALE_SDK}"></script>`;
  const bridge = `<script>window.__MINIAPP__ = ${JSON.stringify({ apiUrl })};</script>\n    <script src="/miniapp-bridge.js"></script>\n`;
  return stubbed
    .replace(/<link rel="manifest"[^>]*>\s*/, '')
    .replace('<head>', `<head>\n    ${sdk}`)
    .replace('</head>', `    ${bridge}  </head>`);
}

/** A service worker that removes itself, in case the same origin ever served the PWA one. */
export const KILL_SW = "self.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', () => {\n  self.registration.unregister();\n  caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));\n});\n";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dist, apiUrl] = process.argv.slice(2);
  if (!dist || !apiUrl) throw new Error('usage: node prepare-dist.mjs <dist dir> <api url>');
  const here = dirname(fileURLToPath(import.meta.url));
  writeFileSync(join(dist, 'index.html'), transformIndex(readFileSync(join(dist, 'index.html'), 'utf8'), apiUrl));
  copyFileSync(join(here, '..', 'miniapp-bridge.js'), join(dist, 'miniapp-bridge.js'));
  writeFileSync(join(dist, 'sw.js'), KILL_SW);
  console.log(`prepare-dist: mini-app page written to ${dist} (api ${apiUrl})`);
}
