const CACHE_NAME = 'ggames-mundial-2026-v18-no-estimated-time-text';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './fase2.js',
  './pwa-install.js',
  './matches.json',
  './squads.json',
  './site.webmanifest',
  './favicon.ico',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './apple-touch-icon.png',
  './android-chrome-192x192.png',
  './android-chrome-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => key === CACHE_NAME ? null : caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Dados dinâmicos/API/Firebase: rede primeiro.
  if (url.pathname.endsWith('.json') || url.hostname.includes('worldcup26.ir') || url.hostname.includes('thesportsdb.com') || url.hostname.includes('api-sports.io') || url.hostname.includes('thesportsdb.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // HTML/CSS/JS: rede primeiro para Safari não ficar preso na versão antiga.
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
