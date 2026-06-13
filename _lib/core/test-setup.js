import 'fake-indexeddb/auto';

// happy-dom does not expose localStorage as globalThis.localStorage.
// Provide a minimal fake so components that call getTheme() or getLocale()
// can mount in unit tests without crashing. Tests that need isolation
// (theme.test.js, strings.test.js) override this with vi.stubGlobal per test.
if (typeof localStorage === 'undefined') {
  const _store = {};
  global.localStorage = {
    getItem:    k     => _store[k] ?? null,
    setItem:    (k,v) => { _store[k] = String(v); },
    removeItem: k     => { delete _store[k]; },
    clear:      ()    => { Object.keys(_store).forEach(k => delete _store[k]); },
  };
}
