// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordControllerChange, isUpdateLoop, clearLoopMarker, repairInstallation } from './sw-repair.js';

const RELOAD_AT_KEY = 'socle:swReloadAt';

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
});

describe('recordControllerChange', () => {
  it('writes current timestamp to sessionStorage', () => {
    const before = Date.now();
    recordControllerChange();
    const stored = parseInt(sessionStorage.getItem(RELOAD_AT_KEY), 10);
    expect(stored).toBeGreaterThanOrEqual(before);
    expect(stored).toBeLessThanOrEqual(Date.now());
  });
});

describe('isUpdateLoop', () => {
  it('returns true when within SW_LOOP_WINDOW_MS of a reload', () => {
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
    expect(isUpdateLoop()).toBe(true);
  });

  it('returns false when outside the loop window', () => {
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now() - 20_000));
    expect(isUpdateLoop()).toBe(false);
  });

  it('returns false when no marker exists', () => {
    expect(isUpdateLoop()).toBe(false);
  });
});

describe('clearLoopMarker', () => {
  it('removes the sessionStorage key', () => {
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
    clearLoopMarker();
    expect(sessionStorage.getItem(RELOAD_AT_KEY)).toBeNull();
  });
});

describe('repairInstallation', () => {
  function stubCachesAndSW() {
    const mockUnregister = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['cache-v1']),
      delete: vi.fn().mockResolvedValue(true),
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: vi.fn().mockResolvedValue([{ unregister: mockUnregister }]) },
      configurable: true,
    });
    return { replaceSpy: vi.spyOn(location, 'replace').mockImplementation(() => {}), mockUnregister };
  }

  it('aborts when server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { replaceSpy } = stubCachesAndSW();
    await repairInstallation({ basePath: '/' });
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('aborts when server returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { replaceSpy } = stubCachesAndSW();
    await repairInstallation({ basePath: '/' });
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('clears caches, unregisters SW, and replaces location on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const { replaceSpy, mockUnregister } = stubCachesAndSW();
    await repairInstallation({ basePath: '/my-app/' });
    expect(caches.delete).toHaveBeenCalledWith('cache-v1');
    expect(mockUnregister).toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledWith('/my-app/');
  });

  it('skips server check when checkServer is false', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { replaceSpy } = stubCachesAndSW();
    await repairInstallation({ basePath: '/', checkServer: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledWith('/');
  });

  it('calls onBackup before clearing caches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const { replaceSpy } = stubCachesAndSW();
    const callOrder = [];
    const onBackup = vi.fn(() => { callOrder.push('backup'); return Promise.resolve(); });
    caches.keys.mockImplementation(() => { callOrder.push('caches'); return Promise.resolve([]); });
    await repairInstallation({ basePath: '/', onBackup });
    expect(callOrder[0]).toBe('backup');
    expect(callOrder[1]).toBe('caches');
  });

  it('proceeds with repair even if onBackup throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const { replaceSpy } = stubCachesAndSW();
    const onBackup = vi.fn().mockRejectedValue(new Error('backup failed'));
    await repairInstallation({ basePath: '/', onBackup });
    expect(replaceSpy).toHaveBeenCalledWith('/');
  });
});
