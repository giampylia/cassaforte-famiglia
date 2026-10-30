const CACHE_NAME = 'q3-fast-v17';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/app.bundle.js?v=17',
  '/app.bundle.css?v=17',
  '/q3.webmanifest?v=8',
  '/q3-icon-192.png?v=8',
  '/q3-icon-512.png?v=8',
  '/q3-icon.jpeg',
  '/logo-associazione-qu3.png?v=15',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  // Network-first per avere sempre l'ultima versione senza rimanere bloccati sulla cache vecchia
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
