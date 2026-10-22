const CACHE_NAME = 'q3-gold-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest?v=q3gold',
  '/q3-icon.jpeg',
  '/app-icon.jpeg',
  '/assets/aula-rossa.png',
  '/assets/aula-verde.png',
  '/assets/aula-gialla.png',
  '/assets/aula-rocchitta.png',
  '/assets/aula-san-benedetto.png',
  '/assets/aula-ferrini.png',
  '/assets/aula-biblioteca.png',
  '/assets/aula-polifunzionale.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then((res) => res || caches.match('/index.html')))
  );
});
