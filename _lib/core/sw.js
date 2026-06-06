const CACHE_VERSION = '%%CACHE_VERSION%%';
const ASSETS = %%ASSETS%%;
const BASE_PATH = '%%BASE_PATH%%';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url)))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  // version.json — always network, never cache (update detection depends on freshness)
  if (event.request.url.endsWith('/version.json')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(BASE_PATH).then(r => r ?? fetch(BASE_PATH))
    );
    return;
  }

  // Cache-first with runtime caching: on first fetch, store in cache for offline use
  event.respondWith(
    caches.match(event.request).then(r => {
      if (r) return r;
      return fetch(event.request).then(response => {
        // Only cache same-origin responses with the correct content type.
        // Servers with HTML fallback routing return text/html for unknown paths —
        // caching that as a JS/CSS file would permanently poison the cache.
        const ct = response.headers.get('content-type') ?? '';
        const url = event.request.url;
        const isModule = url.endsWith('.js') || url.endsWith('.mjs');
        const isStyle  = url.endsWith('.css');
        if ((isModule && !ct.includes('javascript') && !ct.includes('ecmascript')) ||
            (isStyle  && !ct.includes('css'))) {
          return new Response('', { status: 503, statusText: 'Wrong content-type' });
        }
        if (response.ok && new URL(url).origin === self.location.origin) {
          const toCache = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, toCache));
        }
        return response;
      }).catch(() => new Response('', { status: 503, statusText: 'Offline' }));
    })
  );
});
