const APP_SHELL_CACHE = 'gGames-shell-v7';
const APP_SHELL_FILES = [
  './index.html',
  './1x.html',
  './1x.webmanifest',
  './assets/logos/manifest.webmanifest',
  './profile.html',
  './rankings.html',
  './rankings/rankings.js',
  './rankings/rankings.css',
  './myteam.html',
  './myteam/myteam.js',
  './myteam/myteam.css',
  './config.js',
  './menu-component.js',
  './core/top-bar-component.js',
  './core/firebase.js',
  './core/pwa/register-pwa.js',
  './core/pwa/loading-watchdog.js',
  './core/pwa/push-config.js',
  './js/page-content-guard.js',
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

async function serveNavigation(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cachedPage = await cache.match(request);

  if (cachedPage) {
    refreshCacheInBackground(
      fetch(request).then((response) => {
        if (response.ok) {
          return cache.put(request, response.clone());
        }

        return Promise.resolve();
      })
    );

    return cachedPage;
  }

  return fetch(request).catch(async () => {
    const offlinePage = await cache.match(request);

    if (offlinePage) {
      return offlinePage;
    }

    return new Response('Página indisponível sem ligação à Internet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname)) {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (event.request.mode === 'navigate') {
    /*
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        const cachedPage = await cache.match(event.request);

        if (cachedPage) {
          return cachedPage;
        }

        return new Response('Página indisponível sem ligação à Internet.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
    );
    */
    event.respondWith(serveNavigation(event.request));
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
    caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request)).catch((error) => {
      console.warn('Service worker fetch failed:', error);
      return Response.error();
    })
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
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: new URL(payload.url || './market.html', self.location.origin).href
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || new URL('./market.html', self.location.origin).href;

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
