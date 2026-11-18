const CACHE_NAME = 'geset-pwa-auto-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
];
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(ASSETS);
      await Promise.allSettled(
        EXTERNAL_ASSETS.map((url) =>
          fetch(url, { mode: 'cors' }).then((res) => {
            if (res && res.ok) return cache.put(url, res);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isQrLib = EXTERNAL_ASSETS.includes(e.request.url);

  if (!isSameOrigin && !isQrLib) return;

  if (isQrLib) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(e.request).then((cached) => {
          if (cached) return cached;
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});