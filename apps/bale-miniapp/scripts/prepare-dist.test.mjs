// node --test apps/bale-miniapp/scripts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transformIndex } from './prepare-dist.mjs';

const page = `<head><link rel="manifest" href="/manifest.webmanifest" /><script>
      // PWA glue (D98, D102). x
      var a = 1;
    </script><script src="/_expo/static/js/web/entry-abc.js" defer></script></head><body></body>`;

test('holds the bundle back, adds the SDK and bridge, drops the PWA parts', () => {
  const out = transformIndex(page, 'https://api.example.ir');
  assert.match(out, /data-src="\/_expo\/static\/js\/web\/entry-abc\.js"/);
  assert.doesNotMatch(out, /<script src="\/_expo/);
  assert.match(out, /tapi\.bale\.ai\/miniapp\.js/);
  assert.match(out, /"apiUrl":"https:\/\/api\.example\.ir"/);
  assert.doesNotMatch(out, /manifest|serviceWorker|PWA glue/);
  assert.ok(out.slice(out.indexOf('<script')).startsWith('<script src="https://tapi.bale.ai/miniapp.js">'), 'the Bale SDK must be the first script');
  assert.match(out, /__dozariPwa = \{ install: null/);
});

test('fails loudly when the export does not look as expected', () => {
  assert.throws(() => transformIndex('<head></head>', 'x'), /bundle script/);
  assert.throws(() => transformIndex('<head><script src="/_expo/a.js" defer></script></head>', 'x'), /PWA glue/);
});
