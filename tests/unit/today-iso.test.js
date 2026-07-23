import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayISO } from '../../app/utils/today-iso.js';

afterEach(() => { vi.useRealTimers(); });

describe('todayISO', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses the local calendar date, not the UTC one', () => {
    // 2026-03-01T00:30:00 in UTC+2 is still 2026-02-28 in UTC — toISOString()
    // would report the wrong day; todayISO() must report the local day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 28, 23, 30)); // local Feb 28, 23:30
    expect(todayISO()).toBe('2026-02-28');
  });

  it('zero-pads single-digit months and days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5)); // local Jan 5
    expect(todayISO()).toBe('2026-01-05');
  });
});
