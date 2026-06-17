const CACHE_NAME = 'ggames-mundial-2026-v36-force-ios-app-clear';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // APIs externas: rede direta. Se CORS/403 falhar, devolve resposta JSON vazia válida
  // para a app poder passar para a próxima fonte sem partir.
  const externalHosts = [
    'worldcup26.ir',
    'thesportsdb.com',
    'api-sports.io',
    'football-data.org',
    'highlightly.net',
    'allsportsapi.com',
    'sofascore.com',
    'espn.com'
  ];

  if (externalHosts.some(host => url.hostname.includes(host))) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ events: [], games: [], groups: [], response: [], matches: [], data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  if (request.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      const network = await fetch(request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, network.clone()).catch(() => {});
      return network;
    } catch (error) {
      const cached = await caches.match(request);
      return cached || new Response(null, { status: 204 });
    }
  })());
});
