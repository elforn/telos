import { describe, it, expect } from 'vitest';
import { frequencyUrgencyOf, frequencyRowUrgencyOf, frequencyMissedDetail } from '../../app/utils/frequency-urgency.js';

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

function decreasing(target, entries = [], allowancePeriod) {
  return { tracking: { type: 'decreasing', target, entries, allowancePeriod } };
}

describe('frequency-urgency — gating', () => {
  it('is none when inactive, regardless of tracking state', () => {
    const goal = weeklyAny(3, []);
    expect(frequencyUrgencyOf(goal, false, FRI)).toBe('none');
    expect(frequencyRowUrgencyOf(goal, false, FRI)).toBe('none');
  });

  it('is none for percentage — reminderDays/pace concepts don\'t apply at all', () => {
    expect(frequencyUrgencyOf({ tracking: { type: 'percentage', value: 0 } }, true, FRI)).toBe('none');
  });

  it('decreasing is always none on the dialog — an Avoid goal has no due-today/tomorrow concept, only the row carries its failure state (see below)', () => {
    expect(frequencyUrgencyOf(decreasing(0, []), true, FRI)).toBe('none');
    expect(frequencyUrgencyOf(decreasing(1, [MON, TUE, WED]), true, FRI)).toBe('none'); // even well over allowance
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

describe('frequency-urgency — decreasing ("Avoid") goals: row-only failure marker', () => {
  it('is none on the row when within the allowance', () => {
    const goal = decreasing(2, [MON, TUE]); // exactly at the allowance
    expect(frequencyRowUrgencyOf(goal, true, WED)).toBe('none');
  });

  it('is overdue (full-row-red) on the row once the allowance is exceeded', () => {
    const goal = decreasing(2, [MON, TUE, WED]); // 3rd slip past the allowance of 2
    expect(frequencyRowUrgencyOf(goal, true, WED)).toBe('overdue');
  });

  it('stays overdue for the rest of the week even on a day with no new slip — never clears until the period resets', () => {
    const goal = decreasing(1, [MON, TUE]); // over as of Tuesday
    expect(frequencyRowUrgencyOf(goal, true, FRI)).toBe('overdue'); // Friday, nothing logged that day
  });

  it('never appears on the dialog, no matter how far over the allowance — this is a row-only, retrospective marker', () => {
    const overGoal = decreasing(1, [MON, TUE, WED, THU]);
    expect(frequencyUrgencyOf(overGoal, true, THU)).toBe('none');
    expect(frequencyRowUrgencyOf(overGoal, true, THU)).toBe('overdue'); // control — confirms the row did detect it
  });

  it('respects allowancePeriod "4weeks" pooling, exactly like isOverAllowance/weekDayStates', () => {
    const blockStartWeek = ['2026-07-20', '2026-07-21']; // Mon+Tue, 3 weeks before MON, block-start week
    const goal = decreasing(2, [...blockStartWeek, MON], '4weeks'); // 1 more slip this week -> 3rd of the pooled block
    expect(frequencyRowUrgencyOf(goal, true, MON)).toBe('overdue');
    const control = decreasing(2, [...blockStartWeek, MON], 'week'); // same entries, "week" mode resets — unaffected
    expect(frequencyRowUrgencyOf(control, true, MON)).toBe('none');
  });
});

describe('frequency-urgency — Nx (times-per-period) mode, weekly — dialog-facing', () => {
  it('is quiet with plenty of slack (slack >= 2) — never shows week, unlike monthly', () => {
    // Monday, nothing logged, target 3: 7 days remain, 3 needed -> slack 4.
    // Weekly has no 'week' tier at all (see nxBucketWeekly's own doc) — a
    // week is too short a period for a third tier below "act tomorrow" to
    // mean anything, so any slack looser than 1 is simply quiet.
    expect(frequencyUrgencyOf(weeklyAny(3), true, MON)).toBe('none');
    expect(frequencyUrgencyOf(weeklyAny(1), true, MON)).not.toBe('week'); // even at low target, still no week tier
  });

  it('shows the orange tomorrow icon at exactly slack == 1', () => {
    // Thursday, nothing logged, target 3: 4 days remain (Thu-Sun), 3 needed -> slack 1.
    expect(frequencyUrgencyOf(weeklyAny(3), true, THU)).toBe('tomorrow');
  });

  it('shows overdue (not a milder today) at slack == 0, unlogged — Any mode has no "nothing missed yet" state to protect', () => {
    // Friday, nothing logged, target 3: 3 days remain (Fri-Sun), 3 needed -> slack 0.
    // Any mode's tightest possible target (6, since 7 routes to the
    // every-day path) means slack can never hit <=0 on day 1 of a fresh
    // period — so this state always represents some accumulated shortfall,
    // never a first-time "your task for today" moment. 'overdue' is the
    // honest label, matching scheduled-days' own collapse.
    expect(frequencyUrgencyOf(weeklyAny(3), true, FRI)).toBe('overdue');
  });

  it('stays on overdue even once slack goes further negative — never goes silent, never overdue used to mean anything looser', () => {
    // Saturday, nothing logged, target 3: 2 days remain, 3 needed -> slack -1.
    expect(frequencyUrgencyOf(weeklyAny(3), true, SAT)).toBe('overdue');
    // Sunday, still nothing logged: 1 day remains, 3 needed -> slack -2.
    expect(frequencyUrgencyOf(weeklyAny(3), true, SUN)).toBe('overdue');
  });

  it('downgrades to tomorrow once today is logged, even with permanently negative slack — the dialog always clears/downgrades on logging', () => {
    // 6x/week, nothing logged all week: Wednesday has 5 days left and
    // needs 6 -> slack -1, deep enough that logging one entry can't bring
    // slack back above 0 on its own.
    expect(frequencyUrgencyOf(weeklyAny(6), true, WED)).toBe('overdue');
    // Logging today's entry still visibly acknowledges it, for the dialog
    // — never stuck on 'overdue' once today's own obligation is met, even
    // though the miss remains unrecoverable (see the row-facing describe
    // block below for how the row treats this exact same scenario
    // differently).
    const loggedToday = weeklyAny(6, [WED]);
    expect(frequencyUrgencyOf(loggedToday, true, WED)).toBe('tomorrow');
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

describe('frequency-urgency — Nx mode, monthly (always active, no opt-in) — dialog-facing', () => {
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

  it('shows the orange tomorrow icon at slack == 1', () => {
    // Aug 21: 11 days remain (21st-31st inclusive), 10 needed -> slack 1.
    expect(frequencyUrgencyOf(monthly(target), true, '2026-08-21')).toBe('tomorrow');
  });

  it('shows the yellow week icon across the whole 2-7 slack range — a tier weekly never gets', () => {
    // Aug 15: 17 days remain, 10 needed -> slack 7 (the loose boundary).
    expect(frequencyUrgencyOf(monthly(target), true, '2026-08-15')).toBe('week');
    // Aug 20: 12 days remain, 10 needed -> slack 2 (the tight boundary).
    expect(frequencyUrgencyOf(monthly(target), true, '2026-08-20')).toBe('week');
  });

  it('is quiet once slack exceeds 7, not just once it exceeds 1', () => {
    // Aug 14: 18 days remain, 10 needed -> slack 8.
    expect(frequencyUrgencyOf(monthly(target), true, '2026-08-14')).toBe('none');
  });

  it('shows overdue at slack == 0, unlogged, kept consistent with weekly\'s own collapse', () => {
    // Aug 22: 10 days remain, 10 needed -> slack 0.
    expect(frequencyUrgencyOf(monthly(target), true, '2026-08-22')).toBe('overdue');
    // Aug 25: 7 days remain, 10 needed -> slack -3.
    expect(frequencyUrgencyOf(monthly(target), true, '2026-08-25')).toBe('overdue');
  });

  it('goes quiet once met, even mid-month', () => {
    const entries = Array.from({ length: 10 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    expect(frequencyUrgencyOf(monthly(target, entries), true, '2026-08-15')).toBe('none');
  });
});

describe('frequency-urgency — scheduled-days mode, weekly — dialog-facing', () => {
  it('shows the today icon when today itself is scheduled and there is no earlier debt', () => {
    const goal = scheduled(3, ['mon', 'wed', 'fri']);
    expect(frequencyUrgencyOf(goal, true, MON)).toBe('today');
  });

  it('overdue now takes precedence over today once an earlier scheduled day was missed', () => {
    // Monday missed; checking Friday, which is itself also scheduled and
    // unlogged. Today's own normal task no longer masks the earlier debt —
    // the miss is the more urgent story, so 'overdue' wins even though
    // Friday's own slot is simultaneously outstanding too.
    const goal = scheduled(3, ['mon', 'wed', 'fri']); // Monday missed (no entries)
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('overdue');
  });

  it('clears the today icon once today\'s own entry is logged, even though the period target is not fully met yet', () => {
    const goal = scheduled(3, ['mon', 'wed', 'fri'], [MON]); // logged today (Monday)
    expect(frequencyUrgencyOf(goal, true, MON)).toBe('none');
  });

  it('clears a later scheduled day\'s icon once the period target was already met earlier in the week', () => {
    // Target hit by Wednesday (3 entries), Friday is also scheduled but
    // there's nothing left to do this period.
    const goal = scheduled(3, ['mon', 'wed', 'fri'], [MON, TUE, WED]);
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('none');
  });

  it('downgrades to tomorrow, not overdue, once today\'s own entry is logged — even when it doesn\'t fully cover an earlier miss', () => {
    // Monday and Wednesday (both scheduled) missed; only today (Friday,
    // also scheduled) has an entry. That covers one of the two misses, but
    // not both — still behind. But there's nothing more the user can do
    // *today*, so the dialog points forward instead of sounding the full alarm.
    const goal = scheduled(3, ['mon', 'wed', 'fri'], [FRI]);
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('tomorrow');
  });

  it('is quiet on an unscheduled day when nothing has been missed yet (on pace)', () => {
    const goal = scheduled(2, ['mon', 'fri'], [MON]); // Monday already done
    expect(frequencyUrgencyOf(goal, true, WED)).toBe('none');
  });

  it('turns overdue the day after a missed scheduled day, regardless of recoverability — the dialog no longer distinguishes', () => {
    // Tuesday, Monday was scheduled and missed (0 entries). Recoverable or
    // not, the dialog's answer is the same now: 'overdue', full stop.
    const goal = scheduled(3, ['mon', 'wed', 'fri']);
    expect(frequencyUrgencyOf(goal, true, TUE)).toBe('overdue');
  });

  it('stays overdue even once recovery is mathematically impossible — recoverability no longer decides the dialog\'s answer at all', () => {
    // Saturday, all three scheduled days (mon/wed/fri) missed, target 3.
    // 2 days remain (sat, sun), 3 needed -> unrecoverable. The dialog used
    // to downgrade this to a milder 'today'; it no longer distinguishes —
    // don't hint at recoverability, keep one simple rule ("behind and
    // unlogged today = overdue"), and stay fully actionable (still clears
    // on logging, see the next test).
    const goal = scheduled(3, ['mon', 'wed', 'fri']);
    expect(frequencyUrgencyOf(goal, true, SAT)).toBe('overdue');
  });

  it('never gives up while even one day of slack remains — the last possible day still warns', () => {
    // Sunday, the only scheduled day (Monday) was missed, target 1.
    const goal = scheduled(1, ['mon']);
    expect(frequencyUrgencyOf(goal, true, SUN)).toBe('overdue');
  });

  it('logging a catch-up entry on an unscheduled day still clears the dialog to tomorrow, whether or not the miss is recoverable', () => {
    // Mon-Thu scheduled, target 4, all four missed. By Friday (unscheduled),
    // unlogged -> overdue (behind, full stop). Logged -> tomorrow (nothing
    // more actionable today) — the dialog treats this identically to a
    // recoverable miss; only the row (see below) distinguishes.
    const missed = scheduled(4, ['mon', 'tue', 'wed', 'thu']);
    expect(frequencyUrgencyOf(missed, true, FRI)).toBe('overdue');
    const caughtUpOnFriday = scheduled(4, ['mon', 'tue', 'wed', 'thu'], [FRI]);
    expect(frequencyUrgencyOf(caughtUpOnFriday, true, FRI)).toBe('tomorrow');
  });

  it('the full Friday/Saturday matrix for a fully-missed Mon-Thu week stays actionable throughout, for the dialog', () => {
    const base = ['mon', 'tue', 'wed', 'thu'];
    expect(frequencyUrgencyOf(scheduled(4, base, []), true, FRI)).toBe('overdue');
    expect(frequencyUrgencyOf(scheduled(4, base, [FRI]), true, FRI)).toBe('tomorrow');
    expect(frequencyUrgencyOf(scheduled(4, base, []), true, SAT)).toBe('overdue'); // no Friday entry
    expect(frequencyUrgencyOf(scheduled(4, base, [FRI]), true, SAT)).toBe('overdue'); // Friday logged, Saturday not yet
    expect(frequencyUrgencyOf(scheduled(4, base, [FRI, SAT]), true, SAT)).toBe('tomorrow'); // Saturday logged too
  });

  it('still reaches overdue on an unscheduled day when the miss was already recoverable beforehand', () => {
    // Mon-Thu scheduled, target 4, only Monday missed (Tue/Wed/Thu logged).
    const goal = scheduled(4, ['mon', 'tue', 'wed', 'thu'], [TUE, WED, THU]);
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('overdue');
  });

  it('shows the orange tomorrow icon when nothing is missed, today is unscheduled, and tomorrow is scheduled', () => {
    const goal = scheduled(1, ['fri']);
    expect(frequencyUrgencyOf(goal, true, THU)).toBe('tomorrow');
  });

  it('overdue takes precedence over today\'s own masking once an earlier miss exists, even on a day that is itself scheduled', () => {
    const missedYesterday = scheduled(2, ['mon', 'tue']); // Monday missed
    expect(frequencyUrgencyOf(missedYesterday, true, TUE)).toBe('overdue'); // Tuesday itself scheduled, but Monday's debt wins
  });

  it('shows no row icon when tomorrow is not a scheduled day either', () => {
    const goal = scheduled(1, ['fri']);
    expect(frequencyUrgencyOf(goal, true, WED)).toBe('none'); // Thursday (tomorrow) isn't scheduled
  });

  it('suppresses the tomorrow preview once the period target is already met, even if tomorrow is scheduled', () => {
    const met = scheduled(4, ['mon', 'tue', 'wed', 'thu'], [MON, TUE, WED, THU]);
    expect(frequencyUrgencyOf(met, true, THU)).toBe('none');
    expect(frequencyUrgencyOf(met, true, FRI)).toBe('none');
    expect(frequencyUrgencyOf(met, true, SAT)).toBe('none');
  });

  it('still previews on Sunday even once met — Sunday\'s "tomorrow" is next week starting fresh, not a leftover', () => {
    const met = scheduled(4, ['mon', 'tue', 'wed', 'thu'], [MON, TUE, WED, THU]);
    expect(frequencyUrgencyOf(met, true, SUN)).toBe('tomorrow'); // next Monday is scheduled
  });

  it('Sunday stays quiet if met and next Monday is not actually scheduled', () => {
    const met = scheduled(2, ['tue', 'thu'], [TUE, THU]);
    expect(frequencyUrgencyOf(met, true, SUN)).toBe('none'); // Monday isn't in this goal's schedule
  });
});

const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

describe('frequency-urgency — "every day" unification (Any at target 7 == all 7 specific days) — dialog-facing', () => {
  it('computes identically for Any/7x and all-7-specific-days, given the same entries', () => {
    const entries = [SAT]; // missed Mon-Fri, logged Saturday
    const any7 = weeklyAny(7, entries);
    const allDays = scheduled(7, ALL_DAYS, entries);
    expect(frequencyUrgencyOf(any7, true, SAT)).toBe(frequencyUrgencyOf(allDays, true, SAT));
    expect(frequencyRowUrgencyOf(any7, true, SAT)).toBe(frequencyRowUrgencyOf(allDays, true, SAT));
  });

  it('a single missed day cascades to overdue on every subsequent day, since every day counts toward the debt at 7x', () => {
    // Every day is scheduled at target 7, so missing even one day means
    // every later day (until caught up or the period resets) has an
    // earlier-debt to answer for — 'overdue' takes precedence over the
    // plain today-wins state from that point on, same as any other
    // schedule now that overdue precedence isn't limited to unscheduled days.
    const goal = weeklyAny(7); // Monday (the only prior day) missed
    expect(frequencyUrgencyOf(goal, true, TUE)).toBe('overdue');
  });

  it('downgrades today to the gentle tomorrow icon once logged, when nothing was missed yet', () => {
    const goal = weeklyAny(7, [MON]);
    expect(frequencyUrgencyOf(goal, true, MON)).toBe('tomorrow');
  });

  it('downgrades to tomorrow (dialog) even once recovery is mathematically impossible', () => {
    // Saturday, missed Mon-Fri, but today itself is logged: unrecoverable
    // this period, but the dialog still clears it forward since nothing
    // more is actionable today.
    const goal = weeklyAny(7, [SAT]);
    expect(frequencyUrgencyOf(goal, true, SAT)).toBe('tomorrow');
  });
});

describe('frequency-urgency — row-facing (frequencyRowUrgencyOf): sticky once unrecoverable', () => {
  it('matches the dialog exactly while nothing has been logged today, for both recoverable and unrecoverable misses', () => {
    // Recoverable (Tuesday, one day behind, still fixable): both agree overdue.
    const recoverable = scheduled(3, ['mon', 'wed', 'fri']);
    expect(frequencyRowUrgencyOf(recoverable, true, TUE)).toBe('overdue');
    // Unrecoverable (Saturday, all three scheduled days missed): both still agree overdue.
    const unrecoverable = scheduled(3, ['mon', 'wed', 'fri']);
    expect(frequencyRowUrgencyOf(unrecoverable, true, SAT)).toBe('overdue');
  });

  it('matches the dialog\'s downgrade when a recoverable miss is logged today (nx weekly)', () => {
    // Friday, target 3, nothing logged: slack 0, recoverable (3 days left, 3 needed).
    const goal = weeklyAny(3, [FRI]);
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('tomorrow');
    expect(frequencyRowUrgencyOf(goal, true, FRI)).toBe('tomorrow'); // recoverable — row agrees with dialog
  });

  it('diverges from the dialog once logged today but the miss is unrecoverable (nx weekly) — row latches to overdue', () => {
    // 6x/week, nothing logged all week, checked Wednesday: slack -1.
    // Logging Wednesday brings count to 1, remainingNeed to 5, but only 4
    // opportunity days remain after today (Thu-Sun) -> still short by 1 ->
    // unrecoverable. Dialog clears it to 'tomorrow'; the row stays 'overdue'.
    const goal = weeklyAny(6, [WED]);
    expect(frequencyUrgencyOf(goal, true, WED)).toBe('tomorrow');
    expect(frequencyRowUrgencyOf(goal, true, WED)).toBe('overdue');
  });

  it('diverges from the dialog once logged today but the miss is unrecoverable (nx monthly)', () => {
    // August 2026, target 10. Aug 25 has 7 days left; logging only Aug 25
    // leaves 9 still needed with only 6 opportunity days left after today
    // -> unrecoverable.
    const goal = monthly(10, ['2026-08-25']);
    expect(frequencyUrgencyOf(goal, true, '2026-08-25')).toBe('tomorrow');
    expect(frequencyRowUrgencyOf(goal, true, '2026-08-25')).toBe('overdue');
  });

  it('diverges from the dialog once logged today but the miss is unrecoverable (scheduled-days)', () => {
    // Mon-Thu scheduled, target 4, all four missed. Logging only Friday
    // (unscheduled) leaves 3 still needed with only 2 opportunity days
    // left (Sat, Sun) -> unrecoverable.
    const goal = scheduled(4, ['mon', 'tue', 'wed', 'thu'], [FRI]);
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('tomorrow');
    expect(frequencyRowUrgencyOf(goal, true, FRI)).toBe('overdue');
  });

  it('a logged day clearing the *historical* debt count is not enough on its own — the remaining days must still fit the remaining need', () => {
    // Fri/Sat/Sun scheduled, target 3, Friday missed. Logging only Saturday
    // clears the narrow "nothing missed before today" check (1 entry >= 1
    // day-before-today), but still leaves 2 needed with only Sunday (1 day)
    // left -> genuinely unrecoverable despite looking "on pace" by that
    // narrower measure. The dialog still clears forward to 'tomorrow'
    // (nothing more actionable today); the row must NOT clear at all —
    // this was the actual bug: it used to fall through to 'none' before
    // ever reaching the recoverability check.
    const goal = scheduled(3, ['fri', 'sat', 'sun'], [SAT]);
    expect(frequencyUrgencyOf(goal, true, SAT)).toBe('tomorrow');
    expect(frequencyRowUrgencyOf(goal, true, SAT)).toBe('overdue');
  });

  it('agrees with the dialog when logged today and the miss IS still recoverable (scheduled-days) — clears to no icon', () => {
    // MF (Mon/Fri) schedule, target 2, Monday missed. Logging Tuesday (an
    // unscheduled catch-up day) fully covers the one miss -> back on pace
    // -> both dialog and row clear all the way to 'none', not just 'tomorrow'.
    const goal = scheduled(2, ['mon', 'fri'], [TUE]);
    expect(frequencyUrgencyOf(goal, true, TUE)).toBe('none');
    expect(frequencyRowUrgencyOf(goal, true, TUE)).toBe('none');
  });

  it('diverges at 7x/every-day too: dialog clears to tomorrow, row stays latched to overdue', () => {
    const goal = weeklyAny(7, [SAT]); // missed Mon-Fri, only Saturday logged
    expect(frequencyUrgencyOf(goal, true, SAT)).toBe('tomorrow');
    expect(frequencyRowUrgencyOf(goal, true, SAT)).toBe('overdue');
  });

  it('day-ahead previews (tomorrow, from an on-pace or met goal) are identical on both row and dialog — recoverability never applies there', () => {
    const goal = scheduled(1, ['fri']);
    expect(frequencyUrgencyOf(goal, true, THU)).toBe('tomorrow');
    expect(frequencyRowUrgencyOf(goal, true, THU)).toBe('tomorrow');
  });

  it('is none when inactive or unconfigured, same as the dialog', () => {
    expect(frequencyRowUrgencyOf({ tracking: { type: 'percentage', value: 0 } }, true, FRI)).toBe('none');
    expect(frequencyRowUrgencyOf({ tracking: { type: 'weekly', target: 3, entries: [] } }, true, FRI)).toBe('none');
  });
});

describe('frequency-urgency — frequencyMissedDetail (Upcoming dialog "why" commentary)', () => {
  it('is null when inactive or unconfigured', () => {
    expect(frequencyMissedDetail(weeklyAny(3, []), false, FRI)).toBeNull();
    expect(frequencyMissedDetail({ tracking: { type: 'percentage', value: 0 } }, true, FRI)).toBeNull();
  });

  it('is null while on pace / met, even if remainingNeed > 0', () => {
    expect(frequencyMissedDetail(weeklyAny(3, []), true, MON)).toBeNull(); // plenty of slack
    expect(frequencyMissedDetail(weeklyAny(3, [MON, TUE, WED]), true, WED)).toBeNull(); // met
  });

  it('is null for a plain day-ahead preview (slack == 1) — nothing has actually been missed yet', () => {
    expect(frequencyMissedDetail(weeklyAny(3, []), true, THU)).toBeNull(); // slack 1
  });

  it('Any mode: returns a plain count once genuinely behind (slack <= 0)', () => {
    expect(frequencyMissedDetail(weeklyAny(3, []), true, FRI)).toEqual({ kind: 'count', count: 3 });
  });

  it('monthly: returns a plain count once genuinely behind', () => {
    const target = 10;
    expect(frequencyMissedDetail(monthly(target, []), true, '2026-08-22')).toEqual({ kind: 'count', count: 10 }); // slack 0
    expect(frequencyMissedDetail(monthly(target, []), true, '2026-08-21')).toBeNull(); // slack 1, day-ahead only
  });

  function statesByDay(detail) {
    return Object.fromEntries(detail.days.map(d => [d.wd, d.state]));
  }

  it('scheduled-days: returns the full week\'s states (missed/pending/blank), not just a count', () => {
    const goal = scheduled(3, ['mon', 'wed', 'fri'], []); // all three missed so far
    const detail = frequencyMissedDetail(goal, true, FRI);
    expect(detail.kind).toBe('days');
    expect(statesByDay(detail)).toEqual({
      mon: 'missed', tue: 'blank', wed: 'missed', thu: 'blank',
      fri: 'pending', // Friday itself isn't "before today" — scheduled but not yet due
      sat: 'blank', sun: 'blank',
    });
  });

  it('scheduled-days: a literal per-date check — an unscheduled-day entry that keeps the aggregate "on pace" doesn\'t erase a specific missed date, and marks its own day "unscheduled"', () => {
    // Mon missed, but an entry on Tuesday (unscheduled) keeps the bucket's
    // own aggregate check satisfied — frequencyUrgencyOf would call this
    // on pace, but the specific Monday slot is still empty, and Tuesday's
    // own out-of-schedule entry gets its own distinct state.
    const goal = scheduled(2, ['mon', 'fri'], [TUE]);
    expect(frequencyUrgencyOf(goal, true, WED)).toBe('none'); // aggregate check: on pace
    const detail = frequencyMissedDetail(goal, true, WED);
    expect(statesByDay(detail)).toEqual({
      mon: 'missed', tue: 'unscheduled', wed: 'blank', thu: 'blank', fri: 'pending', sat: 'blank', sun: 'blank',
    });
  });

  it('marks a scheduled day with its own entry as "success", distinct from an unscheduled catch-up', () => {
    const goal = scheduled(4, ['mon', 'tue', 'wed', 'thu'], ['2026-08-11', '2026-08-12', '2026-08-13']); // Tue/Wed/Thu logged, Monday missed
    const detail = frequencyMissedDetail(goal, true, '2026-08-14'); // Friday
    expect(statesByDay(detail)).toEqual({
      mon: 'missed', tue: 'success', wed: 'success', thu: 'success', fri: 'blank', sat: 'blank', sun: 'blank',
    });
  });

  it('every-day (7x unification): every day is "scheduled", so only the actually-past missed day isn\'t "pending"', () => {
    const goal = weeklyAny(7, []); // Monday missed
    const detail = frequencyMissedDetail(goal, true, TUE);
    expect(statesByDay(detail)).toEqual({
      mon: 'missed', tue: 'pending', wed: 'pending', thu: 'pending', fri: 'pending', sat: 'pending', sun: 'pending',
    });
  });

  it('still reports the full day picture once downgraded to tomorrow (logged today, still short) — not just while overdue', () => {
    // Mon-Thu scheduled, target 4, only Monday missed, Tue/Wed/Thu logged.
    // frequencyUrgencyOf clears this to 'tomorrow' once Friday's own log
    // covers the rest — but Monday's specific slot was never actually filled.
    const goal = scheduled(4, ['mon', 'tue', 'wed', 'thu'], ['2026-08-11', '2026-08-12', '2026-08-13']);
    const detail = frequencyMissedDetail(goal, true, '2026-08-14');
    expect(statesByDay(detail).mon).toBe('missed');
  });
});
