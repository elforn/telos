import { describe, it, expect } from 'vitest';
import { frequencyUrgencyOf, frequencyRowUrgencyOf, frequencyMissedDetail } from '../../app/utils/frequency-urgency.js';
import { isOverAllowance } from '../../app/utils/tracking.js';

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

  it('is Failed evaluated per week, not per block: a week with zero new slips is not Failed even though an earlier week in the same 4-week block already blew the pooled allowance', () => {
    // Block-start week (3 weeks before MON) already has 3 slips against an
    // allowance of 2 — the block's pooled budget is blown. This week (MON)
    // has no new entries at all. isOverAllowance (the block-level, purely
    // cumulative check) is still true — that's correct for e.g. the
    // dialog's own allowance summary — but the row's Failed indicator must
    // not carry a past week's overage forward onto a clean week.
    const blockStartWeek = ['2026-07-20', '2026-07-21', '2026-07-22'];
    const goal = decreasing(2, [...blockStartWeek], '4weeks');
    expect(isOverAllowance(goal, MON)).toBe(true); // sanity check: the block really is over
    expect(frequencyRowUrgencyOf(goal, true, MON)).toBe('none');
  });

  it('is Failed the exact week a slip pushes an already-blown block over again, even mid-week', () => {
    const blockStartWeek = ['2026-07-20', '2026-07-21', '2026-07-22']; // already over (3 vs allowance 2)
    const goal = decreasing(2, [...blockStartWeek, MON], '4weeks'); // one new slip this week
    expect(frequencyRowUrgencyOf(goal, true, MON)).toBe('overdue');
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

  it('shows today (not overdue) at slack == 0, unlogged, while still recoverable', () => {
    // Friday, nothing logged, target 3: 3 days remain (Fri-Sun), 3 needed ->
    // slack 0, but logging all three remaining days still hits the target,
    // so this is genuinely recoverable — 'today', not 'overdue'. Matches
    // the row's own recoverability split (see nxRowBucketWeekly).
    expect(frequencyUrgencyOf(weeklyAny(3), true, FRI)).toBe('today');
  });

  it('escalates to overdue once slack goes negative enough to be genuinely unrecoverable', () => {
    // Saturday, nothing logged, target 3: 2 days remain, 3 needed -> only 2
    // opportunity days for 3 required -> unrecoverable.
    expect(frequencyUrgencyOf(weeklyAny(3), true, SAT)).toBe('overdue');
    // Sunday, still nothing logged: 1 day remains, 3 needed -> unrecoverable.
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

  it('shows today (not overdue) at slack == 0 while still recoverable, escalating to overdue only once genuinely unrecoverable', () => {
    // Aug 22: 10 days remain, 10 needed -> slack 0, but exactly enough days
    // left to hit it -> recoverable -> 'today'.
    expect(frequencyUrgencyOf(monthly(target), true, '2026-08-22')).toBe('today');
    // Aug 25: 7 days remain, 10 needed -> only 7 opportunity days for 10
    // required -> unrecoverable -> 'overdue'.
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

  it('stays today (not overdue) on a later scheduled day even with an earlier miss, as long as it\'s still recoverable', () => {
    // Monday missed; checking Friday, which is itself also scheduled and
    // unlogged. 3 days remain (Fri-Sun) for the 3 still needed -> still
    // fully recoverable, so today's own task reads as plain 'today' rather
    // than escalating over an earlier miss that hasn't actually run out of
    // road yet.
    const goal = scheduled(3, ['mon', 'wed', 'fri']); // Monday missed (no entries)
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('today');
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

  it('stays today the day after a missed scheduled day, as long as it\'s still recoverable', () => {
    // Tuesday, Monday was scheduled and missed (0 entries). 6 days remain
    // for the 3 still needed -> comfortably recoverable -> 'today'.
    const goal = scheduled(3, ['mon', 'wed', 'fri']);
    expect(frequencyUrgencyOf(goal, true, TUE)).toBe('today');
  });

  it('escalates to overdue once recovery is mathematically impossible', () => {
    // Saturday, all three scheduled days (mon/wed/fri) missed, target 3.
    // 2 days remain (sat, sun), 3 needed -> genuinely unrecoverable, unlike
    // the same-goal-earlier-in-the-week cases above which still had road
    // left. Recoverability now decides the dialog's answer, same as the row.
    const goal = scheduled(3, ['mon', 'wed', 'fri']);
    expect(frequencyUrgencyOf(goal, true, SAT)).toBe('overdue');
  });

  it('still shows today, not overdue, on the last possible day if that day alone can still close the gap', () => {
    // Sunday, the only scheduled day (Monday) was missed, target 1 -> 1 day
    // left (today) for 1 still needed -> just barely recoverable -> 'today'.
    const goal = scheduled(1, ['mon']);
    expect(frequencyUrgencyOf(goal, true, SUN)).toBe('today');
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

  it('shows today, not overdue, on an unscheduled day when the miss is still recoverable', () => {
    // Mon-Thu scheduled, target 4, only Monday missed (Tue/Wed/Thu logged).
    // 3 days remain (Fri-Sun) for the 1 still needed -> recoverable -> 'today'.
    const goal = scheduled(4, ['mon', 'tue', 'wed', 'thu'], [TUE, WED, THU]);
    expect(frequencyUrgencyOf(goal, true, FRI)).toBe('today');
  });

  it('shows the orange tomorrow icon when nothing is missed, today is unscheduled, and tomorrow is scheduled', () => {
    const goal = scheduled(1, ['fri']);
    expect(frequencyUrgencyOf(goal, true, THU)).toBe('tomorrow');
  });

  it('stays today despite an earlier miss, on a day that is itself scheduled, as long as it\'s still recoverable', () => {
    const missedYesterday = scheduled(2, ['mon', 'tue']); // Monday missed, 6 days left for the 2 needed
    expect(frequencyUrgencyOf(missedYesterday, true, TUE)).toBe('today');
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

describe('frequency-urgency — row-facing (frequencyRowUrgencyOf): overdue only when genuinely unrecoverable', () => {
  it('a missed scheduled day is Failed until something extra pays it down — a still-recoverable aggregate does not clear it', () => {
    // Monday scheduled and missed; Tuesday, nothing logged yet at all. Debt
    // of 1 (Monday), no surplus — Failed, even though the week's total is
    // still easily on pace by plain count.
    const untouched = scheduled(3, ['mon', 'wed', 'fri']);
    expect(frequencyRowUrgencyOf(untouched, true, TUE)).toBe('overdue');
    // Logging Tuesday itself (unscheduled — not one of mon/wed/fri) is
    // surplus: it pays down exactly Monday's one unit of debt, clearing it.
    const paidByBonus = scheduled(3, ['mon', 'wed', 'fri'], [TUE]);
    expect(frequencyRowUrgencyOf(paidByBonus, true, TUE)).not.toBe('overdue');
    // Logging Wednesday instead — a day that IS scheduled — only pays
    // Wednesday's own slot, never Monday's debt. Still Failed.
    const paidByOwnSlot = scheduled(3, ['mon', 'wed', 'fri'], [WED]);
    expect(frequencyRowUrgencyOf(paidByOwnSlot, true, WED)).toBe('overdue');
    // Every scheduled day missed and no days left to add surplus (Sat/Sun
    // aren't scheduled but could still bank surplus — this is genuinely
    // unrecoverable only once the period itself ends with debt unpaid).
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

  it('diverges from the dialog once a debt-paying bonus entry clears Failed but Friday\'s own slot is still pending (scheduled-days)', () => {
    // MF (Mon/Fri) schedule, target 2, Monday missed. Logging Tuesday (an
    // unscheduled, debt-paying day) clears Monday's debt entirely, so the
    // row is no longer Failed — but unlike the dialog's blanket 'none'
    // (purely on-pace by count), the row still has nothing to say about
    // Friday's own not-yet-due slot beyond "today's own action is logged."
    const goal = scheduled(2, ['mon', 'fri'], [TUE]);
    expect(frequencyUrgencyOf(goal, true, TUE)).toBe('none');
    expect(frequencyRowUrgencyOf(goal, true, TUE)).not.toBe('overdue');
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
