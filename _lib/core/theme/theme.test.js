// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initTheme, setTheme, getTheme, onThemeChange, reset } from './theme.js';

const _ls = (() => {
  let store = {};
  return {
    getItem:    k     => store[k] ?? null,
    setItem:    (k,v) => { store[k] = String(v); },
    removeItem: k     => { delete store[k]; },
    clear:      ()    => { store = {}; },
  };
})();

function mockMatchMedia(matches) {
  const listeners = new Set();
  const mq = {
    matches,
    addEventListener: (_, cb) => listeners.add(cb),
    _trigger: m => { mq.matches = m; listeners.forEach(cb => cb({ matches: m })); },
  };
  vi.stubGlobal('matchMedia', () => mq);
  return mq;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', _ls);
  _ls.clear();
  reset();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => vi.unstubAllGlobals());

describe('getTheme', () => {
  it('returns system when no preference stored', () => {
    expect(getTheme()).toBe('system');
  });

  it('returns stored value', () => {
    _ls.setItem('theme', 'dark');
    expect(getTheme()).toBe('dark');
  });
});

describe('initTheme', () => {
  it('sets light when OS is light and no override', () => {
    mockMatchMedia(false);
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sets dark when OS is dark and no override', () => {
    mockMatchMedia(true);
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('respects stored light override when OS is dark', () => {
    _ls.setItem('theme', 'light');
    mockMatchMedia(true);
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('respects stored dark override when OS is light', () => {
    _ls.setItem('theme', 'dark');
    mockMatchMedia(false);
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('is a no-op on second call', () => {
    mockMatchMedia(false);
    initTheme();
    setTheme('dark');
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('setTheme', () => {
  it('switches to dark', () => {
    mockMatchMedia(false);
    initTheme();
    setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(getTheme()).toBe('dark');
  });

  it('switches to light', () => {
    mockMatchMedia(true);
    initTheme();
    setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(getTheme()).toBe('light');
  });

  it('switches back to system and follows OS', () => {
    mockMatchMedia(false);
    initTheme();
    setTheme('dark');
    setTheme('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(getTheme()).toBe('system');
  });

  it('throws on invalid value', () => {
    expect(() => setTheme('rainbow')).toThrow('Invalid theme: rainbow');
  });
});

describe('OS preference change', () => {
  it('updates data-theme when in system mode', () => {
    const mq = mockMatchMedia(false);
    initTheme();
    mq._trigger(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignores OS change when theme is manually set to light', () => {
    const mq = mockMatchMedia(false);
    initTheme();
    setTheme('light');
    mq._trigger(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('ignores OS change when theme is manually set to dark', () => {
    const mq = mockMatchMedia(true);
    initTheme();
    setTheme('dark');
    mq._trigger(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('onThemeChange', () => {
  it('fires callback with stored value on setTheme', () => {
    mockMatchMedia(false);
    initTheme();
    const cb = vi.fn();
    onThemeChange(cb);
    setTheme('dark');
    expect(cb).toHaveBeenCalledWith('dark');
  });

  it('fires callback with system when OS changes in system mode', () => {
    const mq = mockMatchMedia(false);
    initTheme();
    const cb = vi.fn();
    onThemeChange(cb);
    mq._trigger(true);
    expect(cb).toHaveBeenCalledWith('system');
  });

  it('unsubscribe stops further callbacks', () => {
    mockMatchMedia(false);
    initTheme();
    const cb = vi.fn();
    const unsub = onThemeChange(cb);
    unsub();
    setTheme('dark');
    expect(cb).not.toHaveBeenCalled();
  });

  it('multiple listeners all fire', () => {
    mockMatchMedia(false);
    initTheme();
    const a = vi.fn();
    const b = vi.fn();
    onThemeChange(a);
    onThemeChange(b);
    setTheme('dark');
    expect(a).toHaveBeenCalledWith('dark');
    expect(b).toHaveBeenCalledWith('dark');
  });
});
