/*
 * OVYRA service worker.
 *
 * Privacy rule: never cache authenticated pages, API responses or anything
 * that could contain mail data. The only cached resources are the static
 * offline fallback and app icons. Everything else goes straight to the
 * network.
 */
const CACHE = 'ovyra-static-v2'; // bump when precached assets change
const PRECACHE = ['/offline.html', '/offline.css', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Network only; show the static offline page if the network fails.
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
