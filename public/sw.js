const CACHE_NAME = 'famylia-v6';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-key.svg',
  '/icons/icon-bank.svg',
  '/icons/icon-home.svg',
  '/icons/icon-cassaforte.svg',
  '/icons/icon-note.svg',
  '/icons/icon-chat.svg'
];

// 1. Installazione SW & Cache immediata dei file dell'app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 2. Attivazione & Pulizia vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Strategia di Rete con Fallback Cache (Network First per dati freschi, Cache se offline)
self.addEventListener('fetch', (event) => {
  // Ignora le chiamate API o metodi diversi da GET
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Se la risposta è valida, aggiorna la cache in background
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Se offline o errore di rete, servi dalla cache locale
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se la pagina richiesta non è in cache, torna la home
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// 4. Gestione Notifiche Push (quando arrivano messaggi da altri familiari)
self.addEventListener('push', (event) => {
  let payload = { title: 'Famylia', body: 'Nuovo messaggio o aggiornamento registrato.' };
  
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      { action: 'open', title: 'Apri Famylia' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Famylia', options)
  );
});

// 5. Click sulla Notifica: porta l'app in primo piano
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
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

// 6. Comunicazione con la pagina per notifiche locali immediate
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
    self.registration.showNotification(event.data.title || 'Famylia', {
      body: event.data.body,
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      vibrate: [200, 100, 200]
    });
    if (navigator.setAppBadge && event.data.badge) {
      navigator.setAppBadge(event.data.badge).catch(() => {});
    }
  }
});
