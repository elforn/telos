import { describe, it, expect } from 'vitest';
import {
  isFrequency, percentValue, setPercent, logEntry, unlogEntry, isLoggedOn,
  isoWeekKey, monthKey, recentPeriods, periodFractions, recentDots, currentPeriodCount,
  PERIOD_WINDOW, TARGET_LIMITS,
} from '../../app/utils/tracking.js';

function pct(value) { return { tracking: { type: 'percentage', value } }; }
function weekly(target, entries) { return { tracking: { type: 'weekly', target, entries } }; }
function monthly(target, entries) { return { tracking: { type: 'monthly', target, entries } }; }

describe('tracking — isFrequency', () => {
  it('is true only for weekly/monthly', () => {
    expect(isFrequency(pct(50))).toBe(false);
    expect(isFrequency(weekly(3, []))).toBe(true);
    expect(isFrequency(monthly(4, []))).toBe(true);
    expect(isFrequency({})).toBe(false);
    expect(isFrequency(null)).toBe(false);
  });
});

describe('tracking — percentValue / setPercent (percentage type)', () => {
  it('reads the stored value', () => {
    expect(percentValue(pct(40))).toBe(40);
    expect(percentValue(pct(0))).toBe(0);
    expect(percentValue(pct(100))).toBe(100);
  });

  it('returns 0 for a goal with no tracking', () => {
    expect(percentValue({})).toBe(0);
    expect(percentValue(null)).toBe(0);
  });

  it('setPercent clamps 0–100 and preserves other fields', () => {
    const goal = { id: 'g1', title: 'X', ...pct(10) };
    expect(setPercent(goal, 150).tracking).toEqual({ type: 'percentage', value: 100 });
    expect(setPercent(goal, -20).tracking).toEqual({ type: 'percentage', value: 0 });
    expect(setPercent(goal, 55).id).toBe('g1');
    expect(setPercent(goal, 55).title).toBe('X');
  });
});

describe('tracking — logEntry / unlogEntry / isLoggedOn', () => {
  it('logEntry adds a date once and is idempotent on repeat', () => {
    const goal = weekly(3, ['2026-08-10']);
    const once = logEntry(goal, '2026-08-11');
    expect(once.tracking.entries).toEqual(['2026-08-10', '2026-08-11']);
    const twice = logEntry(once, '2026-08-11');
    expect(twice).toBe(once); // no-op returns the same reference
  });

  it('logEntry keeps entries sorted regardless of insertion order', () => {
    const goal = weekly(3, ['2026-08-11']);
    const result = logEntry(goal, '2026-08-09');
    expect(result.tracking.entries).toEqual(['2026-08-09', '2026-08-11']);
  });

  it('unlogEntry removes a date and is a no-op when absent', () => {
    const goal = weekly(3, ['2026-08-10', '2026-08-11']);
    const removed = unlogEntry(goal, '2026-08-10');
    expect(removed.tracking.entries).toEqual(['2026-08-11']);
    const noop = unlogEntry(removed, '2026-08-10');
    expect(noop).toBe(removed);
  });

  it('isLoggedOn reflects entry membership', () => {
    const goal = weekly(3, ['2026-08-10']);
    expect(isLoggedOn(goal, '2026-08-10')).toBe(true);
    expect(isLoggedOn(goal, '2026-08-11')).toBe(false);
  });
});

describe('tracking — isoWeekKey / monthKey', () => {
  it('groups dates within the same Mon–Sun week identically', () => {
    // 2026-08-10 is a Monday, 2026-08-16 is the following Sunday.
    expect(isoWeekKey('2026-08-10')).toBe(isoWeekKey('2026-08-16'));
    expect(isoWeekKey('2026-08-09')).not.toBe(isoWeekKey('2026-08-10')); // Sunday, prior week
  });

  it('handles a year boundary correctly (week belongs to the Thursday-containing year)', () => {
    // 2025-12-29 (Mon) .. 2026-01-04 (Sun) is one ISO week; its Thursday (2026-01-01) is in 2026.
    expect(isoWeekKey('2025-12-29')).toBe(isoWeekKey('2026-01-01'));
    expect(isoWeekKey('2025-12-29')).toBe(isoWeekKey('2026-01-04'));
    expect(isoWeekKey('2026-01-01').startsWith('2026-')).toBe(true);
  });

  it('monthKey groups by calendar month', () => {
    expect(monthKey('2026-08-01')).toBe('2026-08');
    expect(monthKey('2026-08-31')).toBe('2026-08');
    expect(monthKey('2026-09-01')).not.toBe(monthKey('2026-08-31'));
  });
});

describe('tracking — recentPeriods window', () => {
  it('returns PERIOD_WINDOW keys ending with the current period, oldest first', () => {
    const keys = recentPeriods('weekly', PERIOD_WINDOW, '2026-08-10');
    expect(keys).toHaveLength(PERIOD_WINDOW);
    expect(keys[keys.length - 1]).toBe(isoWeekKey('2026-08-10'));
    expect(new Set(keys).size).toBe(PERIOD_WINDOW); // all distinct
  });

  it('monthly window spans whole months across a year boundary', () => {
    const keys = recentPeriods('monthly', 3, '2026-01-15');
    expect(keys).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('tracking — periodFractions', () => {
  it('caps each period at 1 even with more entries than target', () => {
    const goal = weekly(2, ['2026-08-10', '2026-08-11', '2026-08-12']); // 3 entries in one week, target 2
    const fractions = periodFractions(goal.tracking, '2026-08-12');
    expect(fractions[fractions.length - 1]).toBe(1);
  });

  it('computes a partial fraction for an under-target period', () => {
    const goal = weekly(4, ['2026-08-10']); // 1 of 4 this week
    const fractions = periodFractions(goal.tracking, '2026-08-10');
    expect(fractions[fractions.length - 1]).toBe(0.25);
  });

  it('empty entries produce an all-zero window', () => {
    const goal = weekly(3, []);
    const fractions = periodFractions(goal.tracking, '2026-08-10');
    expect(fractions.every(f => f === 0)).toBe(true);
    expect(fractions).toHaveLength(PERIOD_WINDOW);
  });
});

describe('tracking — recentDots UI classification', () => {
  it('classifies met / partial / missed and flags the current period', () => {
    const goal = weekly(2, ['2026-08-10', '2026-08-11']); // this week (Mon 10 .. ) fully met
    const dots = recentDots(goal, '2026-08-10');
    expect(dots).toHaveLength(PERIOD_WINDOW);
    expect(dots[dots.length - 1]).toMatchObject({ state: 'met', current: true, fraction: 1 });
    expect(dots[0].current).toBe(false);
    expect(dots[0].state).toBe('missed'); // no entries in older periods
  });

  it('a mid-target period classifies as partial', () => {
    const goal = weekly(4, ['2026-08-10']);
    const dots = recentDots(goal, '2026-08-10');
    expect(dots[dots.length - 1].state).toBe('partial');
  });
});

describe('tracking — weighted average (percentValue for frequency types, pinned to a fixed "today")', () => {
  const TODAY = '2026-08-10'; // a Monday — the start of its own ISO week

  it('current-period-only weekly goal scores above the flat (unweighted) average', () => {
    const goal = weekly(2, ['2026-08-10', '2026-08-11']); // current week: 2/2 = met, nothing else
    const value = percentValue(goal, TODAY);
    const flatAverage = Math.round((1 / PERIOD_WINDOW) * 100);
    expect(value).toBeGreaterThan(flatAverage);
    expect(value).toBeLessThan(100);
  });

  it('all periods in the window met returns exactly 100', () => {
    const entries = [];
    for (let i = 0; i < PERIOD_WINDOW; i++) {
      const d = new Date(2026, 7, 10 - i * 7); // one entry per week, walking back from TODAY
      entries.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    expect(percentValue(weekly(1, entries), TODAY)).toBe(100);
  });

  it('no entries at all returns 0', () => {
    expect(percentValue(weekly(3, []), TODAY)).toBe(0);
    expect(percentValue(monthly(4, []), TODAY)).toBe(0);
  });

  it('recent periods count more than older ones (recency weighting)', () => {
    // Same achievement — exactly one fully-met period, still inside the six-
    // period window — placed at opposite ends. The recent placement must score
    // higher. TODAY - 5 weeks (35 days) lands in the window's oldest period.
    const oldMet    = weekly(1, ['2026-07-08']); // the oldest period in the window relative to TODAY
    const recentMet = weekly(1, [TODAY]);        // TODAY's own (current) period
    const oldScore    = percentValue(oldMet, TODAY);
    const recentScore = percentValue(recentMet, TODAY);
    expect(oldScore).toBeGreaterThan(0); // confirms it landed inside the window at all
    expect(recentScore).toBeGreaterThan(oldScore);
  });
});

describe('tracking — currentPeriodCount', () => {
  const TODAY = '2026-08-10';

  it('counts raw entries in the current period, uncapped by target', () => {
    const tr = weekly(2, ['2026-08-10', '2026-08-11', '2026-08-12']).tracking; // 3 entries, target 2
    expect(currentPeriodCount(tr, TODAY)).toBe(3);
  });

  it('ignores entries from other periods', () => {
    const tr = weekly(3, ['2026-07-08', '2026-08-10']).tracking; // one old, one this week
    expect(currentPeriodCount(tr, TODAY)).toBe(1);
  });

  it('is 0 when nothing logged this period', () => {
    expect(currentPeriodCount(weekly(3, []).tracking, TODAY)).toBe(0);
  });
});
