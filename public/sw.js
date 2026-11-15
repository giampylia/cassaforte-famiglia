self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response(
        '<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Riconnessione App Giampy</title></head><body style="background:#061120;color:#fff;font-family:-apple-system,sans-serif;text-align:center;padding:50px 20px;"><div style="font-size:40px;margin-bottom:15px;">🔄</div><h2 style="color:#fae392;margin:0 0 10px;">Riconnessione in corso</h2><p style="color:#94a3b8;font-size:14px;max-width:320px;margin:0 auto 25px;">Il server sta riallineando il collegamento. Tocca il pulsante qui sotto per ricaricare.</p><button onclick="window.location.reload(true)" style="background:linear-gradient(to right, #f5d365, #c69922);color:#061120;border:none;padding:12px 28px;border-radius:16px;font-weight:bold;font-size:15px;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.5);">Ricarica Pagina</button></body></html>',
        { headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
      );
    })
  );
});
