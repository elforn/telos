import { describe, it, expect, vi, afterEach } from 'vitest';
import { yearDeadlinesLevel, listDeadlinesVisible } from '../../app/utils/deadline-visibility.js';

describe('yearDeadlinesLevel', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('defaults \'full\' for the current year when nothing is stored', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    expect(yearDeadlinesLevel(undefined, 2026)).toBe('full');
    expect(yearDeadlinesLevel({}, '2026')).toBe('full');
  });

  it('defaults \'off\' for a non-current year when nothing is stored', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    expect(yearDeadlinesLevel(undefined, 2025)).toBe('off');
    expect(yearDeadlinesLevel({}, '2027')).toBe('off');
  });

  it('an explicit stored value overrides the default in any direction, including \'warn\'', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    expect(yearDeadlinesLevel({ '2026': 'off' }, 2026)).toBe('off');
    expect(yearDeadlinesLevel({ '2025': 'full' }, 2025)).toBe('full');
    expect(yearDeadlinesLevel({ '2025': 'warn' }, 2025)).toBe('warn');
    expect(yearDeadlinesLevel({ '2026': 'warn' }, 2026)).toBe('warn');
  });

  it('accepts both string and number year keys interchangeably', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    expect(yearDeadlinesLevel({ '2025': 'full' }, '2025')).toBe('full');
  });

  it('falls back to the year default when a stored value is not one of the three valid levels, e.g. a stale boolean from before this setting existed — no migration, by design', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    // A non-current year explicitly turned on under the old boolean scheme
    // (true) is NOT preserved as 'full' — it falls through to the plain
    // per-year default ('off' for a non-current year) since `true` isn't a
    // recognized level. Deliberate: the app has no installed base to
    // migrate for, so a stale value is simply treated as absent.
    expect(yearDeadlinesLevel({ '2025': true }, 2025)).toBe('off');
    expect(yearDeadlinesLevel({ '2026': false }, 2026)).toBe('full');
  });
});

describe('listDeadlinesVisible', () => {
  it('defaults true when nothing is stored', () => {
    expect(listDeadlinesVisible(undefined, 'l1')).toBe(true);
    expect(listDeadlinesVisible({}, 'l1')).toBe(true);
  });

  it('an explicit false overrides the default', () => {
    expect(listDeadlinesVisible({ l1: false }, 'l1')).toBe(false);
  });

  it('an explicit true is unaffected (already the default)', () => {
    expect(listDeadlinesVisible({ l1: true }, 'l1')).toBe(true);
  });

  it('one list\'s stored value does not affect another list', () => {
    expect(listDeadlinesVisible({ l1: false }, 'l2')).toBe(true);
  });
});
