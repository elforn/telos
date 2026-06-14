// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reset as resetStore, getState, boot } from '../store/store.js';

// Minimal reducer — sw-manager tests don't use app state
const reducer = s => s ?? {};

function makeFakeRegistration({ waiting = null } = {}) {
  const listeners = {};
  return {
    waiting,
    installing: null,
    addEventListener(type, cb) { listeners[type] = cb; },
    _fire(type, ...args) { listeners[type]?.(...args); },
    _setInstalling(sw) {
      this.installing = sw;
      listeners['updatefound']?.();
    },
  };
}

function makeFakeSW(initialState = 'installing') {
  const listeners = {};
  let state = initialState;
  return {
    get state() { return state; },
    addEventListener(type, cb) { listeners[type] = cb; },
    _setState(s) { state = s; listeners['statechange']?.(); },
  };
}

function stubServiceWorker(overrides = {}) {
  const swListeners = {};
  const stub = {
    register: vi.fn().mockResolvedValue(makeFakeRegistration()),
    addEventListener(type, cb) { swListeners[type] = cb; },
    removeEventListener(type, cb) { if (swListeners[type] === cb) delete swListeners[type]; },
    controller: {},
    _fire(type) { swListeners[type]?.(); },
    ...overrides,
  };
  Object.defineProperty(navigator, 'serviceWorker', { value: stub, configurable: true });
  return stub;
}

function mountElement(attrs = {}) {
  const el = document.createElement('sw-manager');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return el;
}

beforeEach(async () => {
  resetStore();
  await boot({ dbName: `sw-test-${Math.random()}`, reducer });
  // Reset fetch
  vi.restoreAllMocks();
  // Ensure sw-manager module is loaded
  await import('./sw-manager.js');
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
});

describe('Layer 1 — SW waiting detection', () => {
  it('sets updateAvailable when SW is already waiting at registration', async () => {
    const waitingSW = makeFakeSW('installed');
    const registration = makeFakeRegistration({ waiting: waitingSW });
    stubServiceWorker({ register: vi.fn().mockResolvedValue(registration) });

    mountElement({ 'base-path': '/' });
    await Promise.resolve(); // flush register promise

    expect(getState().updateAvailable).toBe(true);
  });

  it('sets updateAvailable when new SW reaches installed state', async () => {
    const registration = makeFakeRegistration();
    stubServiceWorker({ register: vi.fn().mockResolvedValue(registration) });

    mountElement({ 'base-path': '/' });
    await Promise.resolve(); // flush register

    const sw = makeFakeSW('installing');
    registration._setInstalling(sw);
    sw._setState('installed');

    expect(getState().updateAvailable).toBe(true);
  });

  it('sets updateAvailable when SW is already installing at registration (updatefound missed during boot)', async () => {
    const installingSW = makeFakeSW('installing');
    const registration = makeFakeRegistration();
    registration.installing = installingSW; // updatefound already fired before register().then() ran
    stubServiceWorker({ register: vi.fn().mockResolvedValue(registration) });

    mountElement({ 'base-path': '/' });
    await Promise.resolve(); // flush register promise

    installingSW._setState('installed');

    expect(getState().updateAvailable).toBe(true);
  });

  it('does not set updateAvailable when installing SW state is not installed', async () => {
    const registration = makeFakeRegistration();
    stubServiceWorker({ register: vi.fn().mockResolvedValue(registration) });

    mountElement({ 'base-path': '/' });
    await Promise.resolve();

    const sw = makeFakeSW('installing');
    registration._setInstalling(sw);
    sw._setState('activating'); // not installed

    expect(getState().updateAvailable).toBeUndefined();
  });

  it('reloads on controllerchange when a previous controller existed', () => {
    const swStub = stubServiceWorker({ controller: { scriptURL: 'sw.js' } });
    const reloadSpy = vi.spyOn(location, 'reload').mockImplementation(() => {});

    mountElement({ 'base-path': '/' });
    swStub._fire('controllerchange');

    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('does not reload on controllerchange when there was no previous controller (first install)', () => {
    const swStub = stubServiceWorker({ controller: null });
    const reloadSpy = vi.spyOn(location, 'reload').mockImplementation(() => {});

    mountElement({ 'base-path': '/' });
    swStub._fire('controllerchange');

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('removes controllerchange listener on disconnect', () => {
    const swStub = stubServiceWorker({ controller: { scriptURL: 'sw.js' } });
    const reloadSpy = vi.spyOn(location, 'reload').mockImplementation(() => {});

    const el = mountElement({ 'base-path': '/' });
    el.remove();
    swStub._fire('controllerchange');

    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

describe('Layer 2 — version.json check', () => {
  it('sets updateAvailable when version.json reports a newer version', async () => {
    stubServiceWorker();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '2.0.0' }),
    }));

    mountElement({ 'base-path': '/', 'app-version': '1.0.0' });
    await new Promise(r => setTimeout(r, 0)); // flush fetch

    expect(getState().updateAvailable).toBe(true);
  });

  it('does not set updateAvailable when version matches', async () => {
    stubServiceWorker();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '1.0.0' }),
    }));

    mountElement({ 'base-path': '/', 'app-version': '1.0.0' });
    await new Promise(r => setTimeout(r, 0));

    expect(getState().updateAvailable).toBeUndefined();
  });

  it('does not set updateAvailable when version.json fetch fails', async () => {
    stubServiceWorker();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    mountElement({ 'base-path': '/', 'app-version': '1.0.0' });
    await new Promise(r => setTimeout(r, 0));

    expect(getState().updateAvailable).toBeUndefined();
  });

  it('does not set updateAvailable when version.json returns non-ok', async () => {
    stubServiceWorker();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    mountElement({ 'base-path': '/', 'app-version': '1.0.0' });
    await new Promise(r => setTimeout(r, 0));

    expect(getState().updateAvailable).toBeUndefined();
  });

  it('version.json fetch URL includes a cache-busting query parameter', async () => {
    stubServiceWorker();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '1.0.0' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    mountElement({ 'base-path': '/', 'app-version': '1.0.0' });
    await new Promise(r => setTimeout(r, 0));

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/version\.json\?_=\d+$/);
  });

  it('skips version check when app-version attribute is absent', async () => {
    stubServiceWorker();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    mountElement({ 'base-path': '/' });
    await new Promise(r => setTimeout(r, 0));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
