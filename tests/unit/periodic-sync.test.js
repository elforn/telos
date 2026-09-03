// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { registerPeriodicSync, unregisterPeriodicSync } from '../../app/utils/periodic-sync.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete navigator.serviceWorker;
  delete navigator.permissions;
});

function stubServiceWorker(registration) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
}

describe('registerPeriodicSync', () => {
  it('does nothing when serviceWorker is unsupported', async () => {
    await expect(registerPeriodicSync()).resolves.toBeUndefined();
  });

  it('does nothing (silently) when periodicSync is not on the registration — Firefox/non-installed', async () => {
    stubServiceWorker({});
    await expect(registerPeriodicSync()).resolves.toBeUndefined();
  });

  it('registers with the expected tag when supported and permission is granted', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    stubServiceWorker({ periodicSync: { register } });
    Object.defineProperty(navigator, 'permissions', {
      value: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
      configurable: true,
    });
    await registerPeriodicSync();
    expect(register).toHaveBeenCalledWith('telos-due-date-check', expect.objectContaining({ minInterval: expect.any(Number) }));
  });

  it('does not register when the periodic-background-sync permission is not granted', async () => {
    const register = vi.fn();
    stubServiceWorker({ periodicSync: { register } });
    Object.defineProperty(navigator, 'permissions', {
      value: { query: vi.fn().mockResolvedValue({ state: 'prompt' }) },
      configurable: true,
    });
    await registerPeriodicSync();
    expect(register).not.toHaveBeenCalled();
  });

  it('swallows a rejected registration rather than throwing — best-effort only', async () => {
    const register = vi.fn().mockRejectedValue(new Error('nope'));
    stubServiceWorker({ periodicSync: { register } });
    Object.defineProperty(navigator, 'permissions', {
      value: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
      configurable: true,
    });
    await expect(registerPeriodicSync()).resolves.toBeUndefined();
  });

  it('proceeds when navigator.permissions itself is unavailable (Firefox lacks this permission name)', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    stubServiceWorker({ periodicSync: { register } });
    // navigator.permissions left undefined entirely
    await expect(registerPeriodicSync()).resolves.toBeUndefined();
    expect(register).toHaveBeenCalled();
  });
});

describe('unregisterPeriodicSync', () => {
  it('does nothing when serviceWorker is unsupported', async () => {
    await expect(unregisterPeriodicSync()).resolves.toBeUndefined();
  });

  it('does nothing when periodicSync is not on the registration', async () => {
    stubServiceWorker({});
    await expect(unregisterPeriodicSync()).resolves.toBeUndefined();
  });

  it('unregisters the expected tag when supported', async () => {
    const unregister = vi.fn().mockResolvedValue(undefined);
    stubServiceWorker({ periodicSync: { unregister } });
    await unregisterPeriodicSync();
    expect(unregister).toHaveBeenCalledWith('telos-due-date-check');
  });

  it('swallows a rejected unregister rather than throwing', async () => {
    const unregister = vi.fn().mockRejectedValue(new Error('nope'));
    stubServiceWorker({ periodicSync: { unregister } });
    await expect(unregisterPeriodicSync()).resolves.toBeUndefined();
  });
});
