const CACHE_NAME = 'cassaforte-famiglia-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-pw.svg',
  '/icons/icon-banca.svg',
  '/icons/icon-infocase.svg',
  '/icons/icon-note.svg',
  '/icons/icon-cassaforte.svg',
  '/icons/icon-messaggio.svg',
  '/icons/icon-plus.svg',
  '/icons/qrcode.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Per le API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Per la pagina principale HTML: Network-First così gli aggiornamenti si vedono all'istante
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Per altri asset statici
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      });
    })
  );
});

// Gestione Notifiche Push
self.addEventListener('push', (event) => {
  let payload = { title: 'Cassaforte di Famiglia', body: 'Nuovo messaggio o aggiornamento registrato.' };
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {}

  const options = {
    body: payload.body,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };

  if (navigator.setAppBadge) {
    navigator.setAppBadge().catch(() => {});
  }

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Gestione Messaggi tra Finestra e Service Worker (Badge & Notifiche)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'UPDATE_BADGE') {
    if (navigator.setAppBadge) {
      if (event.data.count > 0) {
        navigator.setAppBadge(event.data.count).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  } else if (event.data.type === 'SHOW_NOTIF') {
    self.registration.showNotification(event.data.title || 'Cassaforte di Famiglia', {
      body: event.data.body || 'Nuovo messaggio registrato.',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      vibrate: [200, 100, 200]
    });
    if (navigator.setAppBadge && event.data.badge) {
      navigator.setAppBadge(event.data.badge).catch(() => {});
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
