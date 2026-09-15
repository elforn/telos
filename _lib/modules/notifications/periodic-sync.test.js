// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isPeriodicSyncSupported, PeriodicSync } from './periodic-sync.js';

function stubServiceWorker(registration) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete navigator.serviceWorker;
  delete window.PeriodicSyncManager;
});

describe('isPeriodicSyncSupported', () => {
  it('is false without serviceWorker support', () => {
    expect(isPeriodicSyncSupported()).toBe(false);
  });

  it('is false with serviceWorker but no PeriodicSyncManager', () => {
    stubServiceWorker({});
    expect(isPeriodicSyncSupported()).toBe(false);
  });

  it('is true when both are present', () => {
    stubServiceWorker({});
    window.PeriodicSyncManager = function () {};
    expect(isPeriodicSyncSupported()).toBe(true);
  });
});

describe('PeriodicSync.register', () => {
  it('no-ops when serviceWorker is unsupported', async () => {
    await expect(PeriodicSync('tag').register()).resolves.toBeUndefined();
  });

  it('no-ops when the registration has no periodicSync', async () => {
    stubServiceWorker({});
    await expect(PeriodicSync('tag').register()).resolves.toBeUndefined();
  });

  it('no-ops when the permission is not granted', async () => {
    const register = vi.fn();
    stubServiceWorker({ periodicSync: { register } });
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: { ready: Promise.resolve({ periodicSync: { register } }) },
      permissions: { query: vi.fn().mockResolvedValue({ state: 'prompt' }) },
    });
    await PeriodicSync('tag').register();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers with the given tag and minInterval when permission is granted', async () => {
    const register = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ periodicSync: { register } }) },
      permissions: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
    });
    await PeriodicSync('my-tag', { minIntervalMs: 1000 }).register();
    expect(register).toHaveBeenCalledWith('my-tag', { minInterval: 1000 });
  });

  it('swallows a registration failure', async () => {
    const register = vi.fn().mockRejectedValue(new Error('nope'));
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ periodicSync: { register } }) },
      permissions: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
    });
    await expect(PeriodicSync('tag').register()).resolves.toBeUndefined();
  });
});

describe('PeriodicSync.unregister', () => {
  it('no-ops when serviceWorker is unsupported', async () => {
    await expect(PeriodicSync('tag').unregister()).resolves.toBeUndefined();
  });

  it('unregisters the given tag', async () => {
    const unregister = vi.fn();
    stubServiceWorker({ periodicSync: { unregister } });
    await PeriodicSync('my-tag').unregister();
    expect(unregister).toHaveBeenCalledWith('my-tag');
  });

  it('swallows an unregister failure', async () => {
    const unregister = vi.fn().mockRejectedValue(new Error('nope'));
    stubServiceWorker({ periodicSync: { unregister } });
    await expect(PeriodicSync('tag').unregister()).resolves.toBeUndefined();
  });
});
