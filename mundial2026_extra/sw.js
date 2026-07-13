const APP_SHELL_CACHE = 'giria-1x-shell-v1';
const APP_SHELL_FILES = [
  './1x.html',
  './1x.webmanifest',
  './profile.html',
  './config.js',
  './menu-component.js',
  './core/top-bar-component.js',
  './core/firebase.js',
  './core/pwa/register-pwa.js',
  './core/pwa/push-config.js',
  './profile/profile-notifications.js',
  './profile/profile-notifications.css',
  './assets/logos/favicon.ico',
  './assets/logos/favicon-16x16.png',
  './assets/logos/favicon-32x32.png',
  './assets/logos/apple-touch-icon.png',
  './assets/logos/apple-touch-icon-glass.png',
  './assets/logos/icons/icon-192x192.png',
  './assets/logos/icons/icon-512x512.png',
  './assets/logos/icons-maskable/maskable-192x192.png',
  './assets/logos/icons-maskable/maskable-512x512.png'
];

async function cacheAppShell() {
  const cache = await caches.open(APP_SHELL_CACHE);
  await cache.addAll(APP_SHELL_FILES);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    cacheAppShell().then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== APP_SHELL_CACHE) {
            return caches.delete(key);
          }

          return Promise.resolve();
        })
      )
    ).then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    refreshCacheInBackground(
      fetch(request).then((response) => {
        if (response.ok) {
          return cache.put(request, response.clone());
        }

        return Promise.resolve();
      }).catch(() => Promise.resolve())
    );

    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    return Response.error();
  }
}

function refreshCacheInBackground(promise) {
  promise.catch(() => Promise.resolve());
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        return cache.match('./1x.html');
      })
    );
    return;
  }

  if (!isSameOrigin) {
    return;
  }

  if (['script', 'style', 'image'].includes(event.request.destination)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request))
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};

  try {
    payload = event.data.json();
  } catch (error) {
    payload = {
      title: 'Giria Games',
      body: event.data.text()
    };
  }

  const title = payload.title || 'Giria Games';
  const options = {
    body: payload.body || 'Tens uma nova notificação.',
    icon: payload.icon || './assets/logos/icons/icon-192x192.png',
    badge: payload.badge || './assets/logos/icons/icon-192x192.png',
    tag: payload.tag || 'giria-market-notification',
    data: {
      url: payload.url || './market.html'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || './market.html';

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of windowClients) {
      if ('focus' in client) {
        client.navigate(targetUrl);
        return client.focus();
      }
    }

    if (clients.openWindow) {
      return clients.openWindow(targetUrl);
    }

    return undefined;
  })());
});
