const CACHE_VERSION = '%%CACHE_VERSION%%';
const ASSETS = %%ASSETS%%;
const BASE_PATH = '%%BASE_PATH%%';
const SHARE_TARGET_PATH = BASE_PATH + 'share-target';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => Promise.allSettled(ASSETS.map(url => cache.add(url))).then(() => cache))
      .then(cache => cache.match(BASE_PATH))
      .then(async resp => {
        if (!resp) return; // offline at install time — partial cache, allow through
        const text = await resp.text();
        const mainJs = ASSETS.find(a => /main\.[a-f0-9]+\.js$/.test(a));
        if (mainJs && !text.includes(mainJs)) {
          await caches.delete(CACHE_VERSION);
          throw new Error(`SW install aborted: stale index.html (expected ${mainJs})`);
        }
      })
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
  if (new URL(event.request.url).pathname.endsWith('/version.json')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Share Target — POST handler: store fields + files into share-inbox cache, then redirect home.
  // MUST come before the mode === 'navigate' check: a real OS share-sheet invocation is a
  // top-level navigation (mode === 'navigate'), so the navigate branch would win first otherwise,
  // serve the cached homepage, and silently discard the share payload.
  // The app's manifest.json must declare share_target with method: 'POST',
  // enctype: 'multipart/form-data', and params: { title, text, url, files: [{ name: 'files', ... }] }.
  // The 'files' param name must match fd.getAll('files') below.
  if (event.request.method === 'POST' && new URL(event.request.url).pathname === SHARE_TARGET_PATH) {
    event.respondWith((async () => {
      const fd = await event.request.formData();
      const title = fd.get('title') ?? '';
      const text  = fd.get('text')  ?? '';
      const sharedUrl = fd.get('url') ?? '';
      const rawFiles = fd.getAll('files');
      const cache = await caches.open('share-inbox');
      const filesIndex = [];
      for (let i = 0; i < rawFiles.length; i++) {
        const file = rawFiles[i];
        const key = 'file-' + i;
        await cache.put(key, new Response(await file.arrayBuffer(), {
          headers: { 'content-type': file.type || 'application/octet-stream', 'x-file-name': file.name },
        }));
        filesIndex.push({ name: file.name, type: file.type, key });
      }
      await cache.put('pending', new Response(
        JSON.stringify({ title, text, url: sharedUrl, files: filesIndex }),
        { headers: { 'content-type': 'application/json' } },
      ));
      return Response.redirect(BASE_PATH, 303);
    })());
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
