// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDayChangeTracker, onDayChange } from '../../app/utils/day-change-watcher.js';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('createDayChangeTracker', () => {
  it('reports false on the very first call — it only seeds the baseline', () => {
    vi.setSystemTime(new Date(2026, 7, 10));
    const dayChanged = createDayChangeTracker();
    expect(dayChanged()).toBe(false);
  });

  it('reports false on repeated calls within the same day', () => {
    vi.setSystemTime(new Date(2026, 7, 10, 9, 0));
    const dayChanged = createDayChangeTracker();
    dayChanged();
    vi.setSystemTime(new Date(2026, 7, 10, 15, 0)); // later the same day
    expect(dayChanged()).toBe(false);
  });

  it('reports true exactly once when the day has moved on, then false again until it moves on again', () => {
    vi.setSystemTime(new Date(2026, 7, 10));
    const dayChanged = createDayChangeTracker();
    dayChanged(); // seed

    vi.setSystemTime(new Date(2026, 7, 11));
    expect(dayChanged()).toBe(true);
    expect(dayChanged()).toBe(false); // already reported, new baseline is now the 11th

    vi.setSystemTime(new Date(2026, 7, 12));
    expect(dayChanged()).toBe(true);
  });

  it('two independent trackers keep independent baselines', () => {
    vi.setSystemTime(new Date(2026, 7, 10));
    const a = createDayChangeTracker();
    a(); // a's baseline: the 10th

    vi.setSystemTime(new Date(2026, 7, 11));
    const b = createDayChangeTracker(); // b's baseline: the 11th (seeded fresh)
    expect(a()).toBe(true); // moved on relative to a's baseline
    expect(b()).toBe(false); // not moved on relative to b's own, later baseline
  });
});

describe('onDayChange', () => {
  function fakeElement() {
    const listeners = [];
    return {
      listen(target, type, handler) {
        listeners.push({ target, type, handler });
        target.addEventListener(type, handler);
      },
      _fire(type) {
        listeners.filter(l => l.type === type).forEach(l => l.handler());
      },
    };
  }

  function setVisibility(state) {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  }

  it('registers via el.listen(document, "visibilitychange", ...) — lifecycle-managed, not a raw addEventListener', () => {
    vi.setSystemTime(new Date(2026, 7, 10));
    const el = fakeElement();
    const spy = vi.spyOn(el, 'listen');
    onDayChange(el, () => {});
    expect(spy).toHaveBeenCalledWith(document, 'visibilitychange', expect.any(Function));
  });

  it('does not call back when the tab becomes visible but the day has not changed', () => {
    vi.setSystemTime(new Date(2026, 7, 10));
    const el = fakeElement();
    const onChange = vi.fn();
    onDayChange(el, onChange);
    setVisibility('visible');
    el._fire('visibilitychange');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call back when the day changes while still hidden', () => {
    vi.setSystemTime(new Date(2026, 7, 10));
    const el = fakeElement();
    const onChange = vi.fn();
    onDayChange(el, onChange);
    vi.setSystemTime(new Date(2026, 7, 11));
    setVisibility('hidden');
    el._fire('visibilitychange');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls back exactly once when the tab becomes visible on a new calendar day', () => {
    vi.setSystemTime(new Date(2026, 7, 10));
    const el = fakeElement();
    const onChange = vi.fn();
    onDayChange(el, onChange);

    vi.setSystemTime(new Date(2026, 7, 11));
    setVisibility('visible');
    el._fire('visibilitychange');
    expect(onChange).toHaveBeenCalledTimes(1);

    // Firing again on the same (now current) day doesn't call back again.
    el._fire('visibilitychange');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
