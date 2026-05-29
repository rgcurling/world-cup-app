const CACHE = 'kickoffai-v1';
const OFFLINE_URL = '/offline.html';

// Cache the app shell on install
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', OFFLINE_URL])).catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) return; // let API calls pass through

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((r) => r || caches.match(OFFLINE_URL)),
    ),
  );
});

// Push notification received
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'KickoffAI', body: event.data.text(), url: '/' };
  }

  const { title, body, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      data:    { url: url || '/' },
      vibrate: [100, 50, 100],
      requireInteraction: false,
    }),
  );
});

// Notification clicked -- focus existing tab or open new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
