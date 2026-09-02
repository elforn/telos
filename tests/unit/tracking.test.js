import { describe, it, expect } from 'vitest';
import {
  isFrequency, isEntryType, isEntryBased, isDecreasing,
  percentValue, setPercent, logEntry, unlogEntry, isLoggedOn,
  isoWeekKey, monthKey, recentPeriods, periodFractions, recentDots, currentPeriodCount,
  weekDayStates, recentWeekStates,
  PERIOD_WINDOW, DOT_WINDOW, TARGET_LIMITS, DEFAULT_TARGET, FIX_DAY_SPAN,
  DEFAULT_ALLOWANCE_PERIOD, ALLOWANCE_PERIOD_WEEKS, targetLimitsFor,
} from '../../app/utils/tracking.js';

function pct(value) { return { tracking: { type: 'percentage', value } }; }
function weekly(target, entries) { return { tracking: { type: 'weekly', target, entries } }; }
function monthly(target, entries) { return { tracking: { type: 'monthly', target, entries } }; }
function decreasing(target, entries) { return { tracking: { type: 'decreasing', target, entries } }; }

describe('tracking — isFrequency', () => {
  it('is true only for weekly/monthly', () => {
    expect(isFrequency(pct(50))).toBe(false);
    expect(isFrequency(weekly(3, []))).toBe(true);
    expect(isFrequency(monthly(4, []))).toBe(true);
    expect(isFrequency(decreasing(0, []))).toBe(false); // not a frequency type — see isEntryBased below
    expect(isFrequency({})).toBe(false);
    expect(isFrequency(null)).toBe(false);
  });
});

describe('tracking — isEntryType / isEntryBased / isDecreasing', () => {
  it('isEntryType is true for weekly, monthly, and decreasing only', () => {
    expect(isEntryType('weekly')).toBe(true);
    expect(isEntryType('monthly')).toBe(true);
    expect(isEntryType('decreasing')).toBe(true);
    expect(isEntryType('percentage')).toBe(false);
    expect(isEntryType(undefined)).toBe(false);
  });

  it('isEntryBased reads the goal\'s tracking type through isEntryType', () => {
    expect(isEntryBased(pct(50))).toBe(false);
    expect(isEntryBased(weekly(3, []))).toBe(true);
    expect(isEntryBased(monthly(4, []))).toBe(true);
    expect(isEntryBased(decreasing(0, []))).toBe(true);
    expect(isEntryBased({})).toBe(false);
    expect(isEntryBased(null)).toBe(false);
  });

  it('isDecreasing is true only for the decreasing type', () => {
    expect(isDecreasing(decreasing(0, []))).toBe(true);
    expect(isDecreasing(weekly(3, []))).toBe(false);
    expect(isDecreasing(pct(50))).toBe(false);
    expect(isDecreasing(null)).toBe(false);
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

  it('setPercent preserves a dormant target/entries from a goal that has previously been weekly/monthly', () => {
    const goal = { id: 'g1', title: 'X', tracking: { type: 'weekly', value: 0, target: 5, entries: ['2026-08-01'] } };
    expect(setPercent(goal, 75).tracking).toEqual({ type: 'percentage', value: 75, target: 5, entries: ['2026-08-01'] });
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
  it('returns PERIOD_WINDOW.weekly keys ending with the current period, oldest first', () => {
    const keys = recentPeriods('weekly', PERIOD_WINDOW.weekly, '2026-08-10');
    expect(keys).toHaveLength(PERIOD_WINDOW.weekly);
    expect(keys[keys.length - 1]).toBe(isoWeekKey('2026-08-10'));
    expect(new Set(keys).size).toBe(PERIOD_WINDOW.weekly); // all distinct
  });

  it('defaults to PERIOD_WINDOW.monthly keys for a monthly goal', () => {
    const keys = recentPeriods('monthly', PERIOD_WINDOW.monthly, '2026-08-10');
    expect(keys).toHaveLength(PERIOD_WINDOW.monthly);
    expect(keys[keys.length - 1]).toBe(monthKey('2026-08-10'));
    expect(new Set(keys).size).toBe(PERIOD_WINDOW.monthly); // all distinct
  });

  it('monthly window spans whole months across a year boundary', () => {
    const keys = recentPeriods('monthly', 3, '2026-01-15');
    expect(keys).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('decreasing shares weekly\'s ISO-week buckets, not monthly\'s (regression guard: an unlisted type used to silently fall into the monthly branch)', () => {
    const decreasingKeys = recentPeriods('decreasing', PERIOD_WINDOW.decreasing, '2026-08-10');
    const weeklyKeys = recentPeriods('weekly', PERIOD_WINDOW.weekly, '2026-08-10');
    expect(decreasingKeys).toEqual(weeklyKeys);
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
    expect(fractions).toHaveLength(PERIOD_WINDOW.weekly);
  });

  it('a monthly goal produces PERIOD_WINDOW.monthly fractions', () => {
    const goal = monthly(4, []);
    const fractions = periodFractions(goal.tracking, '2026-08-10');
    expect(fractions).toHaveLength(PERIOD_WINDOW.monthly);
  });

  it('decreasing: no slips in a week scores that period a full 1', () => {
    const goal = decreasing(0, []);
    const fractions = periodFractions(goal.tracking, '2026-08-10');
    expect(fractions.every(f => f === 1)).toBe(true);
  });

  it('decreasing: slips within the allowance still score 1 — the allowance is free, not discounted', () => {
    const goal = decreasing(2, ['2026-08-10', '2026-08-11']); // 2 slips this week, allowance 2
    const fractions = periodFractions(goal.tracking, '2026-08-11');
    expect(fractions[fractions.length - 1]).toBe(1);
  });

  it('decreasing: a slip past the allowance is weighed against (7 - allowance), not a flat 7', () => {
    // periodFractions always uses the closed-week formula (PERIOD_FRACTION.decreasing)
    // regardless of which period is "current" — the elapsed-day correction for a
    // still-open week is applied separately, only inside decreasingWeightedAverage
    // (see the percentValue describe block below), not here.
    const goal = decreasing(1, ['2026-08-10', '2026-08-11', '2026-08-12']); // 3 slips, allowance 1 → 2 costly
    const fractions = periodFractions(goal.tracking, '2026-08-12');
    expect(fractions[fractions.length - 1]).toBeCloseTo(1 - 2 / (7 - 1), 10);
  });

  it('decreasing: a week fully outside the allowance never scores below 0 (clamped, not negative)', () => {
    const goal = decreasing(0, ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16']); // all 7 days
    const fractions = periodFractions(goal.tracking, '2026-08-16');
    expect(fractions[fractions.length - 1]).toBe(0);
  });
});

describe('tracking — recentDots UI classification', () => {
  it('classifies met / partial / missed and flags the current period (oldest period has data, so nothing is trimmed)', () => {
    // DOT_WINDOW.weekly (3) is narrower than PERIOD_WINDOW.weekly (6) — an
    // entry in the oldest of the 3 *displayed* weeks (2026-07-27..08-02)
    // keeps the leading-trim (see below) from kicking in, so this can still
    // assert on the full 3-dot window.
    const goal = weekly(2, ['2026-07-28', '2026-08-10', '2026-08-11']); // oldest displayed week + this week, fully met
    const dots = recentDots(goal, '2026-08-10');
    expect(dots).toHaveLength(DOT_WINDOW.weekly);
    expect(dots[dots.length - 1]).toMatchObject({ state: 'met', current: true, fraction: 1 });
    expect(dots[0].current).toBe(false);
    expect(dots[0].state).not.toBe('missed'); // the trim anchor itself
    expect(dots[1].state).toBe('missed'); // the middle period, no entries, not part of the leading run
  });

  it('a mid-target period classifies as partial', () => {
    const goal = weekly(4, ['2026-08-10']);
    const dots = recentDots(goal, '2026-08-10');
    expect(dots[dots.length - 1].state).toBe('partial');
  });

  it('a monthly goal produces DOT_WINDOW.monthly dots (3) when the oldest is non-empty', () => {
    const goal = monthly(4, ['2026-06-15', '2026-08-10']); // oldest of the 3 shown (Jun) + current
    const dots = recentDots(goal, '2026-08-10');
    expect(dots).toHaveLength(DOT_WINDOW.monthly);
  });
});

describe('tracking — recentDots trims a leading missed streak (display only — see CLAUDE.md)', () => {
  const TODAY = '2026-08-10'; // Monday — the 3-month display window is Jun..Aug, oldest first
  const MONTHS_OLDEST_FIRST = ['2026-06-15', '2026-07-15', '2026-08-15'];

  // pattern: 3 chars, oldest → current (left to right), 'x' = an entry
  // exists that period, 'o' = none. Case carries no meaning for the entries
  // themselves (only the last position is ever "current") — kept purely so
  // the patterns read identically to how they were specified.
  function goalFor(pattern) {
    const entries = [];
    for (let i = 0; i < 3; i++) {
      if (pattern[i].toLowerCase() === 'x') entries.push(MONTHS_OLDEST_FIRST[i]);
    }
    return monthly(1, entries);
  }

  it.each([
    ['xoX', 3], // oldest has data — nothing trimmed, all 3 shown
    ['oxX', 2], // trims the leading miss, shows xX
    ['ooX', 1], // nothing but the current period has data — shows just it
    ['ooO', 1], // nothing at all has data — collapses to the current period alone
    ['xxX', 3], // oldest has data — nothing trimmed
  ])('%s → %i dots after trim', (pattern, expectedLength) => {
    const dots = recentDots(goalFor(pattern), TODAY);
    expect(dots).toHaveLength(expectedLength);
    expect(dots[dots.length - 1].current).toBe(true);
  });

  it('an entry inside the scored window but outside the (now narrower) display window still changes percentValue, even though recentDots never shows it', () => {
    // May is the 4th-oldest of PERIOD_WINDOW.monthly's 4 scored months
    // (May/Jun/Jul/Aug) but falls entirely outside DOT_WINDOW.monthly's 3
    // displayed months (Jun/Jul/Aug) — the inverse of the old (pre-shrink)
    // relationship, where display was wider than what counted.
    const withMayEntry    = monthly(1, ['2026-05-15', '2026-08-15']);
    const withoutMayEntry = monthly(1, ['2026-08-15']);
    expect(percentValue(withMayEntry, TODAY)).not.toBe(percentValue(withoutMayEntry, TODAY));
    // recentDots only ever walks Jun/Jul/Aug — May isn't part of that walk
    // at all, so both goals produce the identical (trimmed-to-just-current)
    // display regardless of the May entry.
    expect(recentDots(withMayEntry, TODAY)).toHaveLength(1);
    expect(recentDots(withoutMayEntry, TODAY)).toHaveLength(1);
  });
});

describe('tracking — weighted average (percentValue for frequency types, pinned to a fixed "today")', () => {
  const TODAY = '2026-08-10'; // a Monday — the start of its own ISO week

  it('current-period-only weekly goal scores above the flat (unweighted) average', () => {
    const goal = weekly(2, ['2026-08-10', '2026-08-11']); // current week: 2/2 = met, nothing else
    const value = percentValue(goal, TODAY);
    const flatAverage = Math.round((1 / PERIOD_WINDOW.weekly) * 100);
    expect(value).toBeGreaterThan(flatAverage);
    expect(value).toBeLessThan(100);
  });

  it('all periods in the window met returns exactly 100 (weekly)', () => {
    const entries = [];
    for (let i = 0; i < PERIOD_WINDOW.weekly; i++) {
      const d = new Date(2026, 7, 10 - i * 7); // one entry per week, walking back from TODAY
      entries.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    expect(percentValue(weekly(1, entries), TODAY)).toBe(100);
  });

  it('all periods in the window met returns exactly 100 (monthly)', () => {
    const entries = [];
    for (let i = 0; i < PERIOD_WINDOW.monthly; i++) {
      const d = new Date(2026, 7 - i, 10); // one entry per month, walking back from TODAY
      entries.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    expect(percentValue(monthly(1, entries), TODAY)).toBe(100);
  });

  it('a flawless brand-new monthly goal (only the current month met) is well short of 100', () => {
    // The regression this session's PERIOD_WINDOW split exists to soften: a
    // goal with history only in the current period still can't show 100%
    // (the other periods in the window are genuinely unmet), but a shorter
    // monthly window means it climbs there much faster than a 6-month one.
    const value = percentValue(monthly(1, [TODAY]), TODAY);
    expect(value).toBeCloseTo(Math.round((PERIOD_WINDOW.monthly / ((PERIOD_WINDOW.monthly * (PERIOD_WINDOW.monthly + 1)) / 2)) * 100), 0);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(100);
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

describe('tracking — percentValue (decreasing), pinned to a fixed "today"', () => {
  const TODAY = '2026-08-10'; // Monday — same convention as the frequency weighted-average suite above

  function sevenDaysFrom(mondayIso) {
    const [y, m, d] = mondayIso.split('-').map(Number);
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(y, m - 1, d + i);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    });
  }
  function mondayMinusWeeks(mondayIso, weeksAgo) {
    const [y, m, d] = mondayIso.split('-').map(Number);
    const dt = new Date(y, m - 1, d - weeksAgo * 7);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  function mondayOf(dateIso) {
    const [y, m, d] = dateIso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); // Mon=0..Sun=6
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  it('no slips at all returns 100', () => {
    expect(percentValue(decreasing(0, []), TODAY)).toBe(100);
  });

  it('a fully-slipped week 5 weeks ago costs far less than the same fully-slipped week right now (the doubling recency curve)', () => {
    // Evaluated on the Sunday of the current week (fully elapsed) specifically
    // so the elapsed-day correction (see the describe block further below) is
    // a no-op here — this isolates the recency curve on its own, the same
    // clean comparison as the original version of this test.
    const SUNDAY = '2026-08-16'; // the Sunday ending TODAY's own ISO week
    const currentMonday = mondayOf(SUNDAY);
    const oldBadWeek = decreasing(0, sevenDaysFrom(mondayMinusWeeks(currentMonday, 5))); // oldest of the 6 tracked weeks
    const recentBadWeek = decreasing(0, sevenDaysFrom(currentMonday)); // current week, all 7 days already elapsed
    const oldScore = percentValue(oldBadWeek, SUNDAY);
    const recentScore = percentValue(recentBadWeek, SUNDAY);
    // weights are 1,2,4,8,16,32 (sum 63): a bad oldest week costs 1/63 ≈ 98,
    // a bad current week costs 32/63 ≈ 49 — not just "some" difference.
    expect(oldScore).toBe(98);
    expect(recentScore).toBe(49);
    expect(oldScore).toBeGreaterThan(recentScore);
  });

  it('slips within the allowance never cost anything, only the excess does', () => {
    const goal = decreasing(2, ['2026-08-10', '2026-08-11']); // 2 slips this week, allowance 2 → free
    expect(percentValue(goal, TODAY)).toBe(100);
  });

  it('the allowance applies per week, not once across the whole 6-week window', () => {
    const entries = [];
    for (let weeksAgo = 0; weeksAgo <= 5; weeksAgo++) {
      const week = sevenDaysFrom(mondayMinusWeeks(TODAY, weeksAgo));
      entries.push(week[0], week[1]); // 2 slips every week — 12 total across the window
    }
    expect(percentValue(decreasing(2, entries), TODAY)).toBe(100); // allowance 2/week absorbs all of them
  });

  it('a slip fully outside the 6-week window contributes nothing — recovers to 100 once it ages out', () => {
    expect(percentValue(decreasing(0, ['2026-01-05']), TODAY)).toBe(100);
  });

  it('weekly/monthly percentValue is unaffected by the decreasing-only recency curve (scope regression guard)', () => {
    // Same shape of test as the existing frequency recency-weighting test above,
    // re-run here to confirm decreasingWeightedAverage is never reached for
    // weekly/monthly — their shared linear weightedAverage is untouched.
    const oldMet = weekly(1, ['2026-07-08']);
    const recentMet = weekly(1, [TODAY]);
    expect(percentValue(recentMet, TODAY)).toBeGreaterThan(percentValue(oldMet, TODAY));
    expect(percentValue(oldMet, TODAY)).toBeGreaterThan(0);
  });
});

describe('tracking — percentValue (decreasing): current-week elapsed-day correction', () => {
  // Mon..Sun of the week containing TODAY above. Every scenario here shares
  // the same 5-fully-failed-prior-weeks base (worked through numerically
  // with the product owner before implementing) so the current week's
  // day-by-day behavior can be checked in isolation from the recency curve
  // covered by the describe block above.
  const DAYS = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'];

  function priorFiveWeeksFailed() {
    const entries = [];
    for (let weeksAgo = 1; weeksAgo <= 5; weeksAgo++) {
      const d = new Date(2026, 7, 10 - weeksAgo * 7);
      for (let i = 0; i < 7; i++) {
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
        entries.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`);
      }
    }
    return entries;
  }

  it('failing every day this week too never raises the score — flat at the floor, not a mid-week bump', () => {
    // Without this correction, the growing weight of the current week can
    // briefly out-run a worsening fraction and make the score climb for the
    // first few days despite continued failure — this is the regression
    // guard for that. See decreasingWeightedAverage's comment for the math.
    const base = priorFiveWeeksFailed();
    for (let day = 0; day < 7; day++) {
      const entries = [...base, ...DAYS.slice(0, day + 1)];
      expect(percentValue(decreasing(0, entries), DAYS[day])).toBe(0);
    }
  });

  it('a clean current week climbs smoothly across the week, never jumping straight to the fully-elapsed value', () => {
    const entries = priorFiveWeeksFailed();
    const scores = DAYS.map(day => percentValue(decreasing(0, entries), day));
    expect(scores).toEqual([13, 23, 31, 37, 42, 47, 51]); // Monday -> Sunday
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
  });

  it('a single Monday slip drops the score immediately, then recovers every clean day after, converging to the standard formula by Sunday', () => {
    const entries = [...priorFiveWeeksFailed(), DAYS[0]]; // only Monday ever slips
    const scores = DAYS.map(day => percentValue(decreasing(0, entries), day));
    expect(scores[0]).toBe(0); // Monday's own slip
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]); // recovers every day after
    // By Sunday the week is fully elapsed (elapsedDays=7), so the correction
    // is a no-op and this matches exactly what PERIOD_FRACTION.decreasing
    // alone would give a closed "1 slip this week" period: weights
    // 1,2,4,8,16,32 (sum 63), current week fraction 6/7 -> (6/7*32)/63 ≈ 43.5%.
    expect(scores[scores.length - 1]).toBe(44);
  });

  it('a new slip mid-week causes a visible drop, never a rise, even in the middle of an otherwise-clean recovery', () => {
    const base = priorFiveWeeksFailed();
    const wedScore = percentValue(decreasing(0, base), DAYS[2]); // clean through Wednesday
    const thuScore = percentValue(decreasing(0, [...base, DAYS[3]]), DAYS[3]); // slips Thursday
    expect(thuScore).toBeLessThan(wedScore);
  });
});

describe('tracking — percentValue (decreasing): allowancePeriod', () => {
  const currentMonday = '2026-08-10'; // matches TODAY in the describe blocks above
  const SUNDAY = '2026-08-16'; // fully-elapsed current week, avoids the elapsed-day correction

  function sevenDaysFrom(mondayIso) {
    const [y, m, d] = mondayIso.split('-').map(Number);
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(y, m - 1, d + i);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    });
  }
  function mondayMinusWeeks(mondayIso, weeksAgo) {
    const [y, m, d] = mondayIso.split('-').map(Number);
    const dt = new Date(y, m - 1, d - weeksAgo * 7);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  function decreasingWithPeriod(target, entries, allowancePeriod) {
    return { tracking: { type: 'decreasing', target, entries, allowancePeriod } };
  }

  it('DEFAULT_ALLOWANCE_PERIOD is "week"; ALLOWANCE_PERIOD_WEEKS maps week/4weeks to 1/4 weeks', () => {
    expect(DEFAULT_ALLOWANCE_PERIOD).toBe('week');
    expect(ALLOWANCE_PERIOD_WEEKS).toEqual({ week: 1, '4weeks': 4 });
  });

  it('a goal with no allowancePeriod scores identically to one with allowancePeriod explicitly "week" — absence defaults to the original per-week behaviour', () => {
    const entries = [0, 1, 2, 3, 4, 5].map(w => sevenDaysFrom(mondayMinusWeeks(currentMonday, w))[0]);
    const noPeriod = percentValue(decreasing(1, entries), SUNDAY);
    const explicitWeek = percentValue(decreasingWithPeriod(1, entries, 'week'), SUNDAY);
    expect(noPeriod).toBe(explicitWeek);
  });

  it('"week" mode still resets the allowance every single week (unchanged behaviour): a full allowance spent one week is free again the next', () => {
    const blockStartWeek = sevenDaysFrom(mondayMinusWeeks(currentMonday, 3));
    const currentWeek = sevenDaysFrom(currentMonday);
    // 2 slips (the whole allowance) in an earlier week, 1 more slip in the
    // current week — under "week" mode the allowance refills every week, so
    // neither week goes over and the score is untouched.
    const entries = [blockStartWeek[0], blockStartWeek[1], currentWeek[0]];
    expect(percentValue(decreasingWithPeriod(2, entries, 'week'), SUNDAY)).toBe(100);
  });

  it('"4weeks" mode pools the same allowance across the block instead of refilling weekly — the same entries that scored 100 under "week" now cost once the shared budget is spent', () => {
    const blockStartWeek = sevenDaysFrom(mondayMinusWeeks(currentMonday, 3)); // oldest week of the current 4-week block
    const currentWeek = sevenDaysFrom(currentMonday); // newest week of the same block
    const entries = [blockStartWeek[0], blockStartWeek[1], currentWeek[0]]; // allowance (2) fully spent early in the block, then one more slip later in it
    expect(percentValue(decreasingWithPeriod(2, entries, 'week'), SUNDAY)).toBe(100); // unaffected control
    expect(percentValue(decreasingWithPeriod(2, entries, '4weeks'), SUNDAY)).toBe(98); // the block-pooled cost of the 3rd slip
  });

  it('"4weeks" mode with no slips at all still scores 100 — an empty budget has nothing to spend', () => {
    expect(percentValue(decreasingWithPeriod(2, [], '4weeks'), SUNDAY)).toBe(100);
  });
});

describe('tracking — weekDayStates / recentWeekStates', () => {
  const TODAY = '2026-08-10'; // Monday

  it('always returns the 7 days of the week, Monday first, in chronological order', () => {
    const days = weekDayStates(decreasing(0, []), TODAY, 0);
    expect(days).toHaveLength(7);
    expect(days.map(d => d.iso)).toEqual([
      '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16',
    ]);
  });

  it('no entries -> every day is clean', () => {
    const days = weekDayStates(decreasing(1, []), TODAY, 0);
    expect(days.every(d => d.state === 'clean')).toBe(true);
  });

  it('ranks slips chronologically against the allowance: first N within, the rest over', () => {
    const goal = decreasing(2, ['2026-08-10', '2026-08-12', '2026-08-14']); // Mon, Wed, Fri
    const days = weekDayStates(goal, TODAY, 0);
    expect(days.find(d => d.iso === '2026-08-10').state).toBe('within'); // 1st slip
    expect(days.find(d => d.iso === '2026-08-12').state).toBe('within'); // 2nd slip
    expect(days.find(d => d.iso === '2026-08-14').state).toBe('over');   // 3rd slip, past allowance
    expect(days.find(d => d.iso === '2026-08-11').state).toBe('clean');
  });

  it('backfilling an earlier slip re-ranks a later one from within to over (allowance is spent chronologically)', () => {
    const before = decreasing(2, ['2026-08-12', '2026-08-14']); // Wed, Fri — both within (allowance 2)
    const beforeDays = weekDayStates(before, TODAY, 0);
    expect(beforeDays.find(d => d.iso === '2026-08-14').state).toBe('within');

    const backfilled = decreasing(2, ['2026-08-11', '2026-08-12', '2026-08-14']); // add Tue, earlier than both
    const afterDays = weekDayStates(backfilled, TODAY, 0);
    expect(afterDays.find(d => d.iso === '2026-08-11').state).toBe('within'); // now 1st
    expect(afterDays.find(d => d.iso === '2026-08-12').state).toBe('within'); // now 2nd
    expect(afterDays.find(d => d.iso === '2026-08-14').state).toBe('over');   // bumped to 3rd
  });

  it('flags today and future days within the current week', () => {
    const days = weekDayStates(decreasing(0, []), TODAY, 0);
    expect(days.find(d => d.iso === TODAY).today).toBe(true);
    expect(days.find(d => d.iso === '2026-08-16').future).toBe(true); // Sunday, after TODAY (Monday)
    expect(days.find(d => d.iso === TODAY).future).toBe(false);
  });

  it('is correct when todayIso itself is a Sunday (still buckets into the same Mon–Sun week)', () => {
    const sunday = weekDayStates(decreasing(0, []), '2026-08-16', 0);
    const monday = weekDayStates(decreasing(0, []), '2026-08-10', 0);
    expect(sunday.map(d => d.iso)).toEqual(monday.map(d => d.iso));
  });

  it('a week before the goal existed (no entries) comes back all-clean, not a placeholder state', () => {
    const days = weekDayStates(decreasing(0, []), TODAY, 5); // oldest of the 6 tracked weeks
    expect(days.every(d => d.state === 'clean')).toBe(true);
  });

  it('recentWeekStates returns DOT_WINDOW.decreasing weeks (display), oldest first, last one matching weeksAgo=0', () => {
    const goal = decreasing(0, ['2026-08-12']); // a slip in the current week only
    const weeks = recentWeekStates(goal, TODAY);
    expect(weeks).toHaveLength(DOT_WINDOW.decreasing);
    expect(weeks[weeks.length - 1]).toEqual(weekDayStates(goal, TODAY, 0));
    expect(weeks[0]).toEqual(weekDayStates(goal, TODAY, DOT_WINDOW.decreasing - 1));
    // only the current week has the slip — every history week is clean
    expect(weeks.slice(0, -1).every(week => week.every(d => d.state === 'clean'))).toBe(true);
  });

  it('the score still reads the full PERIOD_WINDOW.decreasing (6 weeks) even though the display only shows DOT_WINDOW.decreasing (3)', () => {
    expect(DOT_WINDOW.decreasing).toBeLessThan(PERIOD_WINDOW.decreasing);
  });

  describe('allowancePeriod "4weeks" — the pooled budget carries into later weeks of the same block', () => {
    function decreasingWithPeriod(target, entries, allowancePeriod) {
      return { tracking: { type: 'decreasing', target, entries, allowancePeriod } };
    }

    it('"week" mode (explicit) is unaffected by an earlier week — allowance resets every week, same as the default above', () => {
      const priorWeekFullyOver = ['2026-08-03', '2026-08-04', '2026-08-05']; // 3 slips, 3 weeksAgo... no, 1 week before TODAY
      const goal = decreasingWithPeriod(2, [...priorWeekFullyOver, '2026-08-10'], 'week'); // + 1 slip in current week
      const days = weekDayStates(goal, TODAY, 0);
      expect(days.find(d => d.iso === '2026-08-10').state).toBe('within'); // fresh allowance this week
    });

    it('"4weeks" mode: an allowance fully spent in the block\'s first week carries forward — the same slip that would be "within" alone is now "over"', () => {
      // Block spans weeksAgo 0..3 (this week is the block's 4th/newest week).
      // Spend the whole allowance (2) in the block-start week (weeksAgo 3).
      const blockStartWeek = ['2026-07-20', '2026-07-21']; // Mon+Tue, 3 weeks before TODAY (2026-08-10)
      const goal = decreasingWithPeriod(2, [...blockStartWeek, TODAY], '4weeks'); // 1 more slip this week
      const currentWeekDays = weekDayStates(goal, TODAY, 0);
      expect(currentWeekDays.find(d => d.iso === TODAY).state).toBe('over');

      // Control: the identical entries under "week" mode leave the current week untouched.
      const controlGoal = decreasingWithPeriod(2, [...blockStartWeek, TODAY], 'week');
      expect(weekDayStates(controlGoal, TODAY, 0).find(d => d.iso === TODAY).state).toBe('within');
    });

    it('"4weeks" mode: the block-start week itself still ranks its own slips fresh (no earlier week to carry from)', () => {
      const goal = decreasingWithPeriod(2, ['2026-07-20', '2026-07-21', '2026-07-22'], '4weeks'); // 3 slips, block-start week
      const days = weekDayStates(goal, TODAY, 3); // weeksAgo=3 is the block-start week for TODAY's block
      expect(days.find(d => d.iso === '2026-07-20').state).toBe('within');
      expect(days.find(d => d.iso === '2026-07-21').state).toBe('within');
      expect(days.find(d => d.iso === '2026-07-22').state).toBe('over');
    });

    it('"4weeks" mode: a slip in an older, different block does not leak into the current block\'s carry', () => {
      const olderBlockSlips = ['2026-07-13', '2026-07-14']; // weeksAgo=4, the block *before* the current one
      const goal = decreasingWithPeriod(2, [...olderBlockSlips, TODAY], '4weeks');
      expect(weekDayStates(goal, TODAY, 0).find(d => d.iso === TODAY).state).toBe('within'); // unaffected — different block
    });
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

describe('tracking — TARGET_LIMITS / targetLimitsFor', () => {
  it('exposes the exact clamp ranges goal-dialog\'s stepper relies on — decreasing is keyed by allowancePeriod, not a flat pair', () => {
    expect(TARGET_LIMITS).toEqual({
      weekly: [1, 7],
      monthly: [1, 31],
      decreasing: { week: [0, 6], '4weeks': [0, 27] },
    });
  });

  it('targetLimitsFor returns weekly/monthly\'s plain pair unchanged, ignoring allowancePeriod', () => {
    expect(targetLimitsFor('weekly')).toEqual([1, 7]);
    expect(targetLimitsFor('monthly', '4weeks')).toEqual([1, 31]); // allowancePeriod is meaningless here, ignored
  });

  it('targetLimitsFor("decreasing") resolves to [0, 6] for "week" (default) and [0, 27] for "4weeks"', () => {
    expect(targetLimitsFor('decreasing')).toEqual([0, 6]); // no allowancePeriod passed -> DEFAULT_ALLOWANCE_PERIOD ("week")
    expect(targetLimitsFor('decreasing', 'week')).toEqual([0, 6]);
    expect(targetLimitsFor('decreasing', '4weeks')).toEqual([0, 27]); // one day below the full 28-day block
  });
});

describe('tracking — decreasing constants', () => {
  it('DEFAULT_TARGET.decreasing is 0 (strict — no free slips unless configured)', () => {
    expect(DEFAULT_TARGET.decreasing).toBe(0);
  });

  it('PERIOD_WINDOW.decreasing is 6, matching weekly\'s window', () => {
    expect(PERIOD_WINDOW.decreasing).toBe(6);
  });

  it('FIX_DAY_SPAN.decreasing is 42 (7 × 6 weeks), matching weekly\'s span', () => {
    expect(FIX_DAY_SPAN.decreasing).toBe(42);
    expect(FIX_DAY_SPAN.decreasing).toBe(FIX_DAY_SPAN.weekly);
  });

  it('FIX_DAY_SPAN.monthly is 180 (6 months) — independent of both PERIOD_WINDOW.monthly (4, the score) and DOT_WINDOW.monthly (3, the display)', () => {
    expect(FIX_DAY_SPAN.monthly).toBe(180);
    expect(FIX_DAY_SPAN.monthly).toBeGreaterThan(30 * PERIOD_WINDOW.monthly); // reaches further than what's still scored
    expect(FIX_DAY_SPAN.monthly).toBeGreaterThan(30 * DOT_WINDOW.monthly); // reaches further than what's currently shown
  });
});
