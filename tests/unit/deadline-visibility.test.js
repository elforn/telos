import { describe, it, expect, vi, afterEach } from 'vitest';
import { yearDeadlinesVisible, listDeadlinesVisible } from '../../app/utils/deadline-visibility.js';

describe('yearDeadlinesVisible', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('defaults true for the current year when nothing is stored', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    expect(yearDeadlinesVisible(undefined, 2026)).toBe(true);
    expect(yearDeadlinesVisible({}, '2026')).toBe(true);
  });

  it('defaults false for a non-current year when nothing is stored', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    expect(yearDeadlinesVisible(undefined, 2025)).toBe(false);
    expect(yearDeadlinesVisible({}, '2027')).toBe(false);
  });

  it('an explicit stored value overrides the default in both directions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    expect(yearDeadlinesVisible({ '2026': false }, 2026)).toBe(false);
    expect(yearDeadlinesVisible({ '2025': true }, 2025)).toBe(true);
  });

  it('accepts both string and number year keys interchangeably', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    expect(yearDeadlinesVisible({ '2025': true }, '2025')).toBe(true);
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
