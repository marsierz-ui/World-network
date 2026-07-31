// Minimal service worker for installability + a fast app-shell cache.
const CACHE = 'world-network-v2';
// Relative so the same worker functions at / (dev) and /World-network/ (GitHub Pages);
// these resolve against the worker's own URL.
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
const FALLBACK = './index.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // Only handle same-origin GETs; let API/proxy calls pass through to the network.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match(FALLBACK))),
  );
});
