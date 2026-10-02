/* Dozari PWA service worker (D98, D102). Keeps the app shell available offline; never caches API calls (another
 * origin, and the game is server-authoritative). `scripts/pwa-build.mjs` rewrites the two lines below in the web
 * export: VERSION becomes a hash of the build and PRECACHE lists every file of it (bundle, fonts, images), so an
 * installed app opens offline right after its first visit. In development they stay as they are.
 * Hashed bundles under /_expo/static are immutable, so cache-first is safe for them; pages and everything else go
 * network-first so a new release shows up on the next load.
 * A new version waits until the app says so (message `skip-waiting`), so a running match is never reloaded under
 * the player; the very first install activates at once. */
const VERSION = 'dev';
const PRECACHE = [];

const CACHE = 'dozari-' + VERSION;
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await c.addAll(SHELL);
      // One missing file must not fail the install; the network fills the gap later.
      await Promise.all(PRECACHE.filter((p) => !SHELL.includes(p)).map((p) => c.add(p).catch(() => undefined)));
      // Nothing to protect on the first install: take over straight away.
      if (!self.registration.active) await self.skipWaiting();
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dozari-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const put = (req, res) => caches.open(CACHE).then((c) => c.put(req, res));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;
  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) void put(req, res.clone());
            return res;
          }),
      ),
    );
    return;
  }
  const key = req.mode === 'navigate' ? '/' : req;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || SHELL.includes(url.pathname) || PRECACHE.includes(url.pathname))) void put(key, res.clone());
        return res;
      })
      .catch(() => caches.match(key).then((hit) => hit || Response.error())),
  );
});
