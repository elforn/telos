// Pace-based urgency for weekly/monthly (frequency) goals — a second,
// independent urgency source alongside dueDate's urgencyOf() (see
// urgency.js). Callers merge the two via mostUrgent([dueBucket, freqBucket])
// so a goal's calendar icon / full-row-red state / Upcoming placement always
// reflects whichever signal is currently worse — see goal-item.js and
// upcoming.js. Returns the same bucket vocabulary as urgencyOf ('none' |
// 'week' | 'today' | 'overdue') so the merge and the existing
// urgency-badge.js CSS need no changes to understand it; 'far'/'month' are
// never produced here, they're dueDate-only concepts.
//
// Logging progress never cares which day it happens on — reminderDays is a
// display/warning overlay only, never a gate on what counts toward target
// (see tracking.js). This module only ever *reads* tracking, never mutates.
import { todayISO } from './today-iso.js';
import { WEEKDAYS, currentPeriodCount } from './tracking.js';

function localDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function weekdayKeyOf(iso) {
  return WEEKDAYS[(localDate(iso).getDay() + 6) % 7]; // Mon=0..Sun=6
}

function tomorrowWeekdayKeyOf(todayIso) {
  const d = localDate(todayIso);
  d.setDate(d.getDate() + 1);
  return WEEKDAYS[(d.getDay() + 6) % 7];
}

// Days left in the goal's current period, inclusive of today — the
// denominator "never give up" recovery checks against. Weekly is always
// Mon–Sun; monthly is the full calendar month (no trailing-window
// restriction — slack naturally stays low early in the month, so nothing
// artificial is needed to avoid nagging on day 2).
function remainingDaysInPeriod(type, todayIso) {
  const d = localDate(todayIso);
  if (type === 'monthly') {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return lastDay - d.getDate() + 1;
  }
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  return 7 - dow;
}

// Times-per-period ("x") mode — weekly with reminderDays: 'any', or any
// monthly goal (monthly has no day picker; it's unconditionally
// times-per-period, no opt-in needed). slack = days left, inclusive of
// today, minus entries still needed this period. slack<=0 means every
// remaining day is now required — shows the same red "today" icon used for
// due-today items — and stays showing even if slack keeps dropping further:
// no achievability cutoff, this mode never goes quiet from pace alone and
// never earns the full-row red treatment either.
function nxBucket(goal, todayIso) {
  const { type, target } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none'; // already met this period
  const slack = remainingDaysInPeriod(type, todayIso) - remainingNeed;
  if (slack <= 0) return 'today';
  if (slack === 1) return 'week';
  return 'none';
}

// Scheduled-days mode (weekly only) — a specific subset of WEEKDAYS.
// "Missed" is judged against how many *scheduled* days have already passed
// this week, not the calendar date an entry happens to land on (an entry on
// an unscheduled day still counts — see the module doc above): if fewer
// entries exist than scheduled days already elapsed, something scheduled
// hasn't been caught up on yet. Recovery is judged against the full target
// though (not just the missed-schedule count), consistent with "any day can
// catch up" and the "never give up while still mathematically possible"
// rule — a goal missing every scheduled day so far can still recover right
// up to the last remaining day of the period, scheduled or not.
function scheduledBucket(goal, todayIso) {
  const { type, target, entries, reminderDays } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none'; // already met this period — checked first so a target hit earlier in the week also clears a later scheduled day's icon
  const todayKey = weekdayKeyOf(todayIso);
  // Today only wins over overdue while today's own entry is still
  // outstanding — once logged, the day's actionable task is done, so this
  // falls through to the same missed/recoverable check any other day gets
  // (which may still be 'overdue' if today's entry didn't fully cover an
  // earlier miss, or 'none' if it did).
  if (reminderDays.includes(todayKey) && !entries.includes(todayIso)) return 'today';
  const todayIdx = WEEKDAYS.indexOf(todayKey);
  const scheduledSoFar = reminderDays.filter(d => WEEKDAYS.indexOf(d) < todayIdx).length;
  if (count >= scheduledSoFar) return 'none'; // on pace, nothing missed yet
  const slack = remainingDaysInPeriod(type, todayIso) - remainingNeed;
  return slack >= 0 ? 'overdue' : 'none'; // recoverable miss vs. mathematically impossible (quiet, non-actionable)
}

// The goal's own pace-driven urgency, plus whether it belongs in Upcoming's
// Tomorrow section (a targeted one-day-out check, decoupled from bucket the
// same way urgencyOf's dueDate items already carve Tomorrow out of the
// broader 'week' bucket — see upcoming.js's isTomorrow). `active` mirrors
// urgencyOf's own gate (percentValue < 100 && !archived) — callers pass the
// same value they'd pass to urgencyOf for the goal's dueDate.
export function frequencyUrgency(goal, active, todayIso = todayISO()) {
  if (!active) return { bucket: 'none', tomorrow: false };
  const tr = goal?.tracking;
  if (!tr) return { bucket: 'none', tomorrow: false };

  if (tr.type === 'monthly') {
    const bucket = nxBucket(goal, todayIso);
    return { bucket, tomorrow: bucket === 'week' };
  }

  if (tr.type === 'weekly') {
    if (tr.reminderDays === 'any') {
      const bucket = nxBucket(goal, todayIso);
      return { bucket, tomorrow: bucket === 'week' };
    }
    if (Array.isArray(tr.reminderDays) && tr.reminderDays.length > 0) {
      const bucket = scheduledBucket(goal, todayIso);
      const tomorrow = bucket === 'none' && tr.reminderDays.includes(tomorrowWeekdayKeyOf(todayIso));
      return { bucket, tomorrow };
    }
  }

  return { bucket: 'none', tomorrow: false }; // percentage, decreasing, or weekly never configured
}

// bucket alone — the common case for goal-item's icon/full-row-red merge,
// where Tomorrow-membership doesn't apply.
export function frequencyUrgencyOf(goal, active, todayIso = todayISO()) {
  return frequencyUrgency(goal, active, todayIso).bucket;
}
