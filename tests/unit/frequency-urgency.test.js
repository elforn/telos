import { describe, it, expect } from 'vitest';
import { frequencyUrgency, frequencyUrgencyOf } from '../../app/utils/frequency-urgency.js';

// Reference week: 2026-08-10 is a Monday, 2026-08-16 the following Sunday
// (confirmed against isoWeekKey's own test fixtures in tracking.test.js).
const MON = '2026-08-10';
const TUE = '2026-08-11';
const WED = '2026-08-12';
const THU = '2026-08-13';
const FRI = '2026-08-14';
const SAT = '2026-08-15';
const SUN = '2026-08-16';

function weeklyAny(target, entries = []) {
  return { tracking: { type: 'weekly', target, entries, reminderDays: 'any' } };
}

function scheduled(target, reminderDays, entries = []) {
  return { tracking: { type: 'weekly', target, entries, reminderDays } };
}

function monthly(target, entries = []) {
  return { tracking: { type: 'monthly', target, entries } };
}

describe('frequency-urgency — gating', () => {
  it('is always none/false when inactive, regardless of tracking state', () => {
    const goal = weeklyAny(3, []);
    expect(frequencyUrgency(goal, false, FRI)).toEqual({ bucket: 'none', tomorrow: false });
  });

  it('is none for percentage and decreasing types — reminderDays is weekly/monthly-only', () => {
    expect(frequencyUrgencyOf({ tracking: { type: 'percentage', value: 0 } }, true, FRI)).toBe('none');
    expect(frequencyUrgencyOf({ tracking: { type: 'decreasing', target: 0, entries: [] } }, true, FRI)).toBe('none');
  });

  it('is none for a weekly goal that has never had reminderDays configured (opt-in default)', () => {
    const goal = { tracking: { type: 'weekly', target: 3, entries: [] } }; // no reminderDays key at all
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('none');
  });

  it('is none for a weekly goal with an empty reminderDays array', () => {
    const goal = scheduled(3, [], []);
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('none');
  });
});

describe('frequency-urgency — Nx (times-per-period) mode, weekly', () => {
  it('is quiet with plenty of slack (slack >= 2)', () => {
    // Monday, nothing logged, target 3: 7 days remain, 3 needed -> slack 4.
    expect(frequencyUrgencyOf(weeklyAny(3), true, MON)).toBe('none');
  });

  it('shows the yellow week icon at exactly slack == 1, and flags tomorrow', () => {
    // Thursday, nothing logged, target 3: 4 days remain (Thu-Sun), 3 needed -> slack 1.
    const result = frequencyUrgency(weeklyAny(3), true, THU);
    expect(result.bucket).toBe('week');
    expect(result.tomorrow).toBe(true);
  });

  it('shows the red today icon at slack == 0', () => {
    // Friday, nothing logged, target 3: 3 days remain (Fri-Sun), 3 needed -> slack 0.
    expect(frequencyUrgencyOf(weeklyAny(3), true, FRI)).toBe('today');
  });

  it('stays on the today icon even once slack goes negative — no achievability cutoff', () => {
    // Saturday, nothing logged, target 3: 2 days remain, 3 needed -> slack -1.
    expect(frequencyUrgencyOf(weeklyAny(3), true, SAT)).toBe('today');
    // Sunday, still nothing logged: 1 day remains, 3 needed -> slack -2.
    expect(frequencyUrgencyOf(weeklyAny(3), true, SUN)).toBe('today');
  });

  it('never returns overdue, no matter how far behind', () => {
    expect(frequencyUrgencyOf(weeklyAny(7), true, SUN)).not.toBe('overdue');
  });

  it('goes quiet once the period target is already met, regardless of days left', () => {
    const goal = weeklyAny(3, [MON, TUE, WED]); // 3 logged by Wednesday
    expect(frequencyUrgencyOf(goal, true, WED)).toBe('none');
  });

  it('progress logged earlier in the week loosens the slack, delaying the icon', () => {
    // Friday, 2 already logged (only 1 more needed), 3 days remain -> slack 2.
    const goal = weeklyAny(3, [MON, TUE]);
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('none');
  });
});

describe('frequency-urgency — Nx mode, monthly (always active, no opt-in)', () => {
  const target = 10; // August 2026 has 31 days

  it('applies even though reminderDays was never set — monthly has no picker, it is unconditional', () => {
    const goal = monthly(target, []);
    expect(goal.tracking.reminderDays).toBeUndefined();
    expect(frequencyUrgencyOf(goal, true, '2026-08-01')).toBe('none'); // plenty of slack on day 1
  });

  it('is quiet early in the month', () => {
    // Aug 1: 31 days remain, 10 needed -> slack 21.
    expect(frequencyUrgencyOf(monthly(target), true, '2026-08-01')).toBe('none');
  });

  it('shows yellow at slack == 1', () => {
    // Aug 21: 11 days remain (21st-31st inclusive), 10 needed -> slack 1.
    const result = frequencyUrgency(monthly(target), true, '2026-08-21');
    expect(result.bucket).toBe('week');
    expect(result.tomorrow).toBe(true);
  });

  it('shows red at slack == 0 and stays red past that, never overdue', () => {
    // Aug 22: 10 days remain, 10 needed -> slack 0.
    expect(frequencyUrgencyOf(monthly(target), true, '2026-08-22')).toBe('today');
    // Aug 25: 7 days remain, 10 needed -> slack -3.
    expect(frequencyUrgencyOf(monthly(target), true, '2026-08-25')).toBe('today');
  });

  it('goes quiet once met, even mid-month', () => {
    const entries = Array.from({ length: 10 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    expect(frequencyUrgencyOf(monthly(target, entries), true, '2026-08-15')).toBe('none');
  });
});

describe('frequency-urgency — scheduled-days mode, weekly', () => {
  it('shows the today icon when today itself is scheduled, even with no misses', () => {
    const goal = scheduled(3, ['mon', 'wed', 'fri']);
    expect(frequencyUrgencyOf(goal, true, MON)).toBe('today');
  });

  it('today wins over overdue — shows today even when an earlier scheduled day was missed', () => {
    const goal = scheduled(3, ['mon', 'wed', 'fri']); // Monday missed (no entries)
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('today'); // Friday is itself scheduled
  });

  it('is quiet on an unscheduled day when nothing has been missed yet (on pace)', () => {
    const goal = scheduled(2, ['mon', 'fri'], [MON]); // Monday already done
    expect(frequencyUrgencyOf(goal, true, WED)).toBe('none');
  });

  it('turns full-row overdue the day after a missed scheduled day, if still recoverable', () => {
    // Tuesday, Monday was scheduled and missed (0 entries). 3 needed, 6 days
    // remain from Tuesday -> slack 3, recoverable.
    const goal = scheduled(3, ['mon', 'wed', 'fri']);
    expect(frequencyUrgencyOf(goal, true, TUE)).toBe('overdue');
  });

  it('goes quiet once recovery is mathematically impossible, rather than staying red', () => {
    // Saturday, all three scheduled days (mon/wed/fri) missed, target 3.
    // 2 days remain (sat, sun), 3 needed -> slack -1, unrecoverable.
    const goal = scheduled(3, ['mon', 'wed', 'fri']);
    expect(frequencyUrgencyOf(goal, true, SAT)).toBe('none');
  });

  it('never gives up while even one day of slack remains — the last possible day still warns', () => {
    // Sunday, the only scheduled day (Monday) was missed, target 1.
    // 1 day remains (today only) -> slack 0, exactly recoverable.
    const goal = scheduled(1, ['mon']);
    expect(frequencyUrgencyOf(goal, true, SUN)).toBe('overdue');
  });

  it('flags tomorrow when nothing is missed, today is unscheduled, and tomorrow is scheduled', () => {
    const goal = scheduled(1, ['fri']);
    const result = frequencyUrgency(goal, true, THU);
    expect(result.bucket).toBe('none'); // no row icon for scheduled-days tomorrow — dialog/notifications only
    expect(result.tomorrow).toBe(true);
  });

  it('does not flag tomorrow when today is already claiming today/overdue', () => {
    const missedYesterday = scheduled(2, ['mon', 'tue']); // Monday missed
    const todayResult = frequencyUrgency(missedYesterday, true, TUE); // Tuesday itself scheduled -> today
    expect(todayResult.bucket).toBe('today');
    expect(todayResult.tomorrow).toBe(false);
  });

  it('never shows the yellow week icon for scheduled-days mode, no matter how close tomorrow is', () => {
    const goal = scheduled(1, ['fri']);
    expect(frequencyUrgencyOf(goal, true, THU)).not.toBe('week');
  });
});
