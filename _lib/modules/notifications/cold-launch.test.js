// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { consumeColdLaunchParam, onColdLaunchMessage } from './cold-launch.js';

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
  delete navigator.serviceWorker;
});

describe('consumeColdLaunchParam', () => {
  it('returns false and leaves the URL alone when the param is absent', () => {
    window.history.replaceState(null, '', '/?foo=1');
    expect(consumeColdLaunchParam('notif')).toBe(false);
    expect(location.search).toBe('?foo=1');
  });

  it('returns true and strips the param when present', () => {
    window.history.replaceState(null, '', '/?notif=1&foo=2');
    expect(consumeColdLaunchParam('notif')).toBe(true);
    expect(location.search).toBe('?foo=2');
  });

  it('is a one-shot — calling it again after consuming returns false', () => {
    window.history.replaceState(null, '', '/?notif=1');
    expect(consumeColdLaunchParam('notif')).toBe(true);
    expect(consumeColdLaunchParam('notif')).toBe(false);
  });
});

describe('onColdLaunchMessage', () => {
  it('no-ops when serviceWorker is unsupported', () => {
    delete navigator.serviceWorker;
    expect(() => onColdLaunchMessage('open', () => {})).not.toThrow();
  });

  it('invokes the callback only for the matching message type', () => {
    const listeners = {};
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { addEventListener: (type, cb) => { listeners[type] = cb; } },
      configurable: true,
    });
    const callback = vi.fn();
    onColdLaunchMessage('my-app:open', callback);

    listeners.message({ data: { type: 'other' } });
    expect(callback).not.toHaveBeenCalled();

    listeners.message({ data: { type: 'my-app:open' } });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
