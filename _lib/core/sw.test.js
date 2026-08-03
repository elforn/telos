// Tests the sw.js fetch event handler using vm.runInNewContext to simulate a SW environment.
// This lets us construct FetchEvents with mode: 'navigate' — something fetch() can never produce —
// which is the exact mode that OS share-sheet invocations use. See CHANGELOG 0.15.6 for the
// bug that made this distinction matter.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runInNewContext } from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swSource = readFileSync(join(__dirname, 'sw.js'), 'utf8');

// Node's Response.redirect requires absolute URLs; browsers accept relative paths.
// This shim normalises the BASE_PATH redirect without changing the SW source.
class TestResponse extends Response {}
TestResponse.redirect = (url, status) =>
  Response.redirect(url.startsWith('http') ? url : `https://test.local${url}`, status);

function loadSW(basePath = '/') {
  const source = swSource
    .replace("'%%CACHE_VERSION%%'", "'test-v1'")
    .replace('%%ASSETS%%', JSON.stringify([basePath, basePath + 'main.abc123.js']))
    .replace("'%%BASE_PATH%%'", JSON.stringify(basePath));

  const listeners = new Map();
  const cacheStores = new Map();

  function openCache(name) {
    if (!cacheStores.has(name)) cacheStores.set(name, new Map());
    const store = cacheStores.get(name);
    return Promise.resolve({
      put:    (key, resp) => { store.set(String(key), resp); return Promise.resolve(); },
      match:  (key) => Promise.resolve(store.get(String(key))),
      delete: (key) => { store.delete(String(key)); return Promise.resolve(true); },
      add:    (url) => { store.set(url, new Response('')); return Promise.resolve(); },
    });
  }

  runInNewContext(source, {
    self: {
      addEventListener: (type, fn) => listeners.set(type, fn),
      location: { origin: 'https://test.local' },
      clients: { claim: () => Promise.resolve() },
      skipWaiting: () => Promise.resolve(),
    },
    caches: {
      open: openCache,
      match: (req) => {
        const key = typeof req === 'string' ? req : req.url;
        for (const store of cacheStores.values()) {
          const val = store.get(key);
          if (val !== undefined) return Promise.resolve(val);
        }
        return Promise.resolve(undefined);
      },
      keys:   () => Promise.resolve([...cacheStores.keys()]),
      delete: (name) => { cacheStores.delete(name); return Promise.resolve(true); },
    },
    fetch:    () => Promise.resolve(new Response('network')),
    Response: TestResponse,
    URL,
    Promise,
  });

  return {
    dispatch: (event) => {
      const handler = listeners.get('fetch');
      if (!handler) throw new Error('No fetch listener registered');
      handler(event);
    },
    cacheStores,
  };
}

// Minimal FetchEvent stand-in. `formData` is the object returned by request.formData() —
// pass a mockFormData() result or null for no-file requests.
function makeFetchEvent({ url, method = 'GET', mode = 'cors', formData = null }) {
  let responsePromise = null;
  return {
    request: {
      url,
      method,
      mode,
      formData: () => Promise.resolve(formData ?? { get: () => null, getAll: () => [] }),
    },
    respondWith: (p) => { responsePromise = p; },
    waitUntil:   () => {},
    get response() { return responsePromise; },
  };
}

// Plain object that satisfies fd.get() / fd.getAll() as the SW handler calls them.
function mockFormData({ title = '', text = '', url = '', files = [] } = {}) {
  return {
    get:    (key) => ({ title, text, url }[key] ?? null),
    getAll: (key) => (key === 'files' ? files : []),
  };
}

describe('sw.js fetch handler — Share Target', () => {
  it('navigate-mode POST writes title/text/url to share-inbox and returns 303', async () => {
    const { dispatch, cacheStores } = loadSW('/');
    const event = makeFetchEvent({
      url: 'https://test.local/share-target',
      method: 'POST',
      mode: 'navigate',   // ← what a real OS share-sheet invocation produces
      formData: mockFormData({ title: 'My title', text: 'hello', url: 'https://example.com' }),
    });
    dispatch(event);
    const resp = await event.response;
    expect(resp.status).toBe(303);
    const inbox = cacheStores.get('share-inbox');
    expect(inbox).toBeDefined();
    const pending = await inbox.get('pending').json();
    expect(pending).toMatchObject({
      title: 'My title',
      text: 'hello',
      url: 'https://example.com',
      files: [],
    });
  });

  it('navigate-mode POST with a file attachment caches the file entry', async () => {
    const { dispatch, cacheStores } = loadSW('/');
    const mockFile = {
      name: 'export.txt',
      type: 'text/plain',
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode('file content').buffer),
    };
    const event = makeFetchEvent({
      url: 'https://test.local/share-target',
      method: 'POST',
      mode: 'navigate',
      formData: mockFormData({ files: [mockFile] }),
    });
    dispatch(event);
    const resp = await event.response;
    expect(resp.status).toBe(303);
    const inbox = cacheStores.get('share-inbox');
    const pending = await inbox.get('pending').json();
    expect(pending.files).toHaveLength(1);
    expect(pending.files[0]).toMatchObject({ name: 'export.txt', type: 'text/plain', key: 'file-0' });
    expect(inbox.get('file-0')).toBeDefined();
  });

  it('cors-mode POST (in-page fetch) also writes to share-inbox — regression guard', async () => {
    const { dispatch, cacheStores } = loadSW('/');
    const event = makeFetchEvent({
      url: 'https://test.local/share-target',
      method: 'POST',
      mode: 'cors',   // what an in-page fetch() produces — the path covered by existing Telos e2e
      formData: mockFormData({ title: 'T', text: 'body' }),
    });
    dispatch(event);
    const resp = await event.response;
    expect(resp.status).toBe(303);
    const pending = await cacheStores.get('share-inbox').get('pending').json();
    expect(pending.title).toBe('T');
  });

  it('GET navigate does NOT write to share-inbox', async () => {
    const { dispatch, cacheStores } = loadSW('/');
    const event = makeFetchEvent({ url: 'https://test.local/', method: 'GET', mode: 'navigate' });
    dispatch(event);
    await event.response;
    expect(cacheStores.has('share-inbox')).toBe(false);
  });

  it('works with a non-root BASE_PATH', async () => {
    const { dispatch, cacheStores } = loadSW('/myapp/');
    const event = makeFetchEvent({
      url: 'https://test.local/myapp/share-target',
      method: 'POST',
      mode: 'navigate',
      formData: mockFormData({ text: 'subpath share' }),
    });
    dispatch(event);
    const resp = await event.response;
    expect(resp.status).toBe(303);
    const pending = await cacheStores.get('share-inbox').get('pending').json();
    expect(pending.text).toBe('subpath share');
  });
});
