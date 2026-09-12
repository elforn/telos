// Pace-based urgency for weekly/monthly (frequency) goals — a second,
// independent urgency source alongside dueDate's urgencyOf() (see
// urgency.js). Callers merge the two via mostUrgent([dueBucket, freqBucket])
// so a goal's calendar icon / full-row-red state / Upcoming placement always
// reflects whichever signal is currently worse — see goal-item.js and
// upcoming.js. Returns the same bucket vocabulary as urgencyOf ('none' |
// 'week' | 'tomorrow' | 'today' | 'overdue') so the merge and the shared
// urgency-badge.js CSS need no changes to understand it; 'far'/'month' are
// never produced here — those stay plain-dueDate-only concepts, too coarse
// to be worth a pace-based equivalent.
//
// Weekly and monthly are deliberately different modes, not the same
// thresholds scaled by period length: a week only ever has 7 days total, so
// there's barely room for a third tier below "act tomorrow" — any slack
// looser than that is already comfortably quiet. A month is long enough
// that a moderate early-warning tier earns its keep, so monthly alone also
// produces 'week' (2-7 days of slack). Scheduled-days mode has no monthly
// equivalent at all — monthly has no day-of-week picker, it's
// unconditionally times-per-period.
//
// TWO exported functions, not one, because the row and the Upcoming dialog
// deliberately disagree about what 'overdue' means:
//
// - frequencyUrgencyOf (dialog/Upcoming/notification-facing) stays fully
//   actionable — 'overdue' means "behind and nothing logged today," full
//   stop, no distinction between a still-fully-recoverable miss and an
//   already-unreachable one (don't hint at recoverability); logging today
//   always clears or downgrades it, so the bell badge and dialog never get
//   stuck showing something the user can't act on to resolve.
// - frequencyRowUrgencyOf (the goal's own row icon, and specifically the
//   full-row-red "Failed" treatment) reserves 'overdue' for a genuinely
//   unrecoverable miss only — as long as the target is still reachable by
//   period end, it is not Failed, even on a day nothing's been logged yet
//   at all. That day shows 'today' (or 'tomorrow' once today's own entry is
//   in) instead. Once a miss turns out to be *unrecoverable*, though, the
//   row latches to 'overdue' for the rest of the period regardless of
//   further logging: "the week is lost, do better next week," a
//   deliberately sticky consequence the dialog is not supposed to carry.
//
// Recoverability (see isRecoverable below) needs no memory of past days to
// support that stickiness — it's recomputed fresh every time from current
// entries/target/date, and simply keeps coming back "no" on its own once
// truly behind, since logging any single day can only ever add +1 to the
// available slack.
import { todayISO } from './today-iso.js';
import { WEEKDAYS, currentPeriodCount, isOverAllowance } from './tracking.js';

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

// Shared by every frequency mode, both dialog- and row-facing — "an entry
// on an unscheduled day still counts" (see the module doc), so
// recoverability is purely total-entries-vs-total-days-left, never about
// which specific days are scheduled; scheduled-days and flexible/Any share
// this exact calculation. Today's own slot, once logged, no longer counts
// as a still-available opportunity day — excluding it is what makes this a
// fresh, memoryless, per-day computation rather than something needing to
// remember prior days: once truly behind, each subsequent day's own log is
// only ever worth +1 slack, so any bigger deficit keeps re-confirming
// itself as unrecoverable on its own, day after day, with no history to
// track.
//
// The dialog-facing functions use this too now, not just the row — a
// historical "nothing missed before today" check alone isn't enough to
// call a goal genuinely fine; the days actually remaining also have to fit
// the entries still needed (see scheduledBucket's own doc for the case
// that exposed this).
function isRecoverable(goal, todayIso) {
  const { type, target, entries } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return true; // already met — nothing left to recover
  const loggedToday = entries?.includes(todayIso);
  const opportunityDaysLeft = remainingDaysInPeriod(type, todayIso) - (loggedToday ? 1 : 0);
  return opportunityDaysLeft >= remainingNeed;
}

// Times-per-period ("x") mode, weekly, dialog-facing — weekly goals with
// reminderDays: 'any'. slack = days left, inclusive of today, minus entries
// still needed this period. slack<=0 means every remaining day is now
// required — 'overdue' only once that's genuinely unrecoverable; while
// still catchable it's 'today', the same recoverability split the row uses
// (see nxRowBucketWeekly). Earlier versions of this function called every
// slack<=0/not-logged day 'overdue' unconditionally, deliberately never
// hinting at recoverability — that made sense back when the dialog was the
// only place any of this showed up (a "you can't fix this" message with no
// alternative would be pure discouragement). Now that the row carries its
// own dedicated, honest "truly unrecoverable" signal (Failed), the dialog
// is free to be this precise without losing that safety net.
//
// Once today's own entry is logged, though, there's nothing more the user
// can act on until tomorrow, so it downgrades to 'tomorrow' regardless of
// recoverability — the dialog still always gives grace once you've acted
// today, unlike the row, which latches to Failed even after logging if the
// miss is unrecoverable (see nxRowBucketWeekly's own sticky behaviour).
//
// No 'week' tier here (unlike monthly) — a week is only ever 7 days long,
// so once slack passes 1 there's nowhere near enough runway left in the
// period for a moderate "still weeks off" warning to mean anything; it's
// just quiet from there.
function nxBucketWeekly(goal, todayIso) {
  const { target, entries } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none'; // already met this period
  const slack = remainingDaysInPeriod('weekly', todayIso) - remainingNeed;
  if (slack <= 0) {
    if (entries?.includes(todayIso)) return 'tomorrow'; // logged today — always grace, regardless of recoverability
    return isRecoverable(goal, todayIso) ? 'today' : 'overdue'; // 'overdue' only once genuinely unrecoverable
  }
  if (slack === 1) return 'tomorrow';
  return 'none';
}

// nxBucketWeekly's row-facing counterpart. Only ever returns 'overdue' when
// the miss is mathematically unrecoverable — that's the one state that's
// genuinely Failed. A shortfall that's still catchable by period end shows
// 'today' (still time to act, even with zero slack left) or 'tomorrow'
// (today's own entry is already in, nothing more to do until tomorrow)
// instead — never 'overdue', even though the dialog calls that same
// not-yet-logged day 'overdue'. Once unrecoverable, this latches for the
// rest of the period regardless of any further logging: "the week is lost,
// do better next week."
function nxRowBucketWeekly(goal, todayIso) {
  const { target } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none';
  const slack = remainingDaysInPeriod('weekly', todayIso) - remainingNeed;
  if (slack <= 0) {
    // Whenever slack<=0, logging today can only ever move the needle by
    // exactly the +1 day of slack a same-day entry buys — never enough to
    // cross back above 0, since slack<=0 here means the days left already
    // don't cover what's needed even before today's own contribution is
    // subtracted out again for recoverability's opportunity-days count.
    // Concretely: isRecoverable is always false whenever today is already
    // logged in this branch (provable from the arithmetic alone, verified
    // exhaustively too) — so 'today' is the only reachable outcome once the
    // unrecoverable case above has been ruled out, logged or not.
    return isRecoverable(goal, todayIso) ? 'today' : 'overdue'; // 'overdue' only once genuinely unrecoverable
  }
  if (slack === 1) return 'tomorrow';
  return 'none';
}

// Times-per-period mode, monthly, dialog-facing — every monthly goal,
// unconditionally (no reminderDays opt-in exists for monthly at all, see
// the module doc above). Same shape and same recoverability split as
// weekly (see nxBucketWeekly's own doc for why 'overdue' now means
// genuinely unrecoverable, not just "slack hit zero") — kept deliberately
// consistent rather than diverging further — but a month is long enough to
// still earn a genuine third tier: 'week' at 2-7 days of slack, a moderate
// early warning distinct from 'tomorrow'/'today's immediate urgency and
// from 'none's comfortable quiet — mirrors dueDate's own week/tomorrow/
// today split, just computed from pace instead of a fixed date.
function nxBucketMonthly(goal, todayIso) {
  const { target, entries } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none'; // already met this period
  const slack = remainingDaysInPeriod('monthly', todayIso) - remainingNeed;
  if (slack <= 0) {
    if (entries?.includes(todayIso)) return 'tomorrow'; // logged today — always grace, regardless of recoverability
    return isRecoverable(goal, todayIso) ? 'today' : 'overdue';
  }
  if (slack === 1) return 'tomorrow';
  if (slack <= 7) return 'week';
  return 'none';
}

// nxBucketMonthly's row-facing counterpart — same relationship to it as
// nxRowBucketWeekly has to nxBucketWeekly above: 'overdue' only once the
// miss is unrecoverable, 'today'/'tomorrow' for a shortfall that's still
// catchable by month end.
function nxRowBucketMonthly(goal, todayIso) {
  const { target } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none';
  const slack = remainingDaysInPeriod('monthly', todayIso) - remainingNeed;
  if (slack <= 0) {
    // Same proof as nxRowBucketWeekly's own version of this branch (see its
    // doc): whenever slack<=0, isRecoverable is always false if today is
    // already logged, so 'today' is the only reachable outcome once the
    // unrecoverable case has been ruled out.
    return isRecoverable(goal, todayIso) ? 'today' : 'overdue'; // 'overdue' only once genuinely unrecoverable
  }
  if (slack === 1) return 'tomorrow';
  if (slack <= 7) return 'week';
  return 'none';
}

// Scheduled-days mode (weekly only), dialog-facing — a specific subset of
// WEEKDAYS. "Missed" is judged against how many *scheduled* days have
// already passed this week, not the calendar date an entry happens to land
// on (an entry on an unscheduled day still counts — see the module doc
// above): if fewer entries exist than scheduled days already elapsed,
// something scheduled hasn't been caught up on yet.
//
// Today wins — but only while there's no earlier debt that's still
// unrecoverable. If today itself is scheduled and not yet logged, and
// nothing before today was missed (or an earlier miss is still catchable),
// that's just the ordinary, unremarkable "your task for today" state
// ('today'). Only a genuinely unrecoverable earlier miss escalates to
// 'overdue' even on a day that's also itself scheduled and unlogged — the
// earlier miss is the more urgent story, and masking it behind today's own
// normal task would hide it. (Contrast: the very first scheduled day of a
// fresh period trivially has no earlier debt — scheduledSoFar is 0 — so it
// always reads as plain 'today', never 'overdue'.)
//
// Beyond that: 'overdue' means genuinely unrecoverable, same recoverability
// split the row uses (see scheduledRowBucket) — this used to call every
// "behind, nothing logged today" case 'overdue' uniformly, deliberately
// never hinting at recoverability, back when the dialog was the only place
// any of this showed up. Now that the row carries its own dedicated
// "truly unrecoverable" signal (Failed), the dialog is free to say 'today'
// instead whenever there's still a way to catch up. Once today IS logged,
// it either clears to 'none' (already caught up, WITH enough runway left
// for what remains) or downgrades to 'tomorrow' (still short, but nothing
// more to act on until tomorrow) — regardless of recoverability, the
// dialog always gives grace once you've acted today, unlike the row, which
// latches to Failed even after logging if the miss is unrecoverable (see
// scheduledRowBucket's own sticky behaviour).
//
// "Caught up" requires more than just clearing the historical debt count
// (count >= scheduledSoFar) — that only checks whether earlier scheduled
// days were covered, never whether the days actually still remaining can
// fit the days still needed. E.g. missing the first of three scheduled
// days, then logging only the second, clears the historical-debt check
// (nothing missed *before* today) while leaving too few days for the
// third — genuinely still behind despite looking "on pace" by that
// narrower measure. isRecoverable folds in exactly that forward-looking
// check, so 'none' now requires both conditions together, and so does the
// choice between 'today' and 'overdue' for an unresolved debt.
function scheduledBucket(goal, todayIso) {
  const { target, entries, reminderDays } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none'; // already met this period

  const todayKey = weekdayKeyOf(todayIso);
  const loggedToday = entries?.includes(todayIso);
  const todayIdx = WEEKDAYS.indexOf(todayKey);
  const scheduledSoFar = reminderDays.filter(d => WEEKDAYS.indexOf(d) < todayIdx).length;
  const recoverable = isRecoverable(goal, todayIso);

  if (reminderDays.includes(todayKey) && !loggedToday) {
    if (count < scheduledSoFar) return recoverable ? 'today' : 'overdue';
    return 'today';
  }

  if (count >= scheduledSoFar && recoverable) return 'none'; // caught up AND still enough runway left
  if (loggedToday) return 'tomorrow'; // still short, but nothing more actionable today — grace regardless of recoverability
  return recoverable ? 'today' : 'overdue'; // not logged, behind, today isn't itself the scheduled slot in question
}

// Debt ledger for scheduled-days mode — the row's own measure of "did you
// keep each specific commitment," not just "is the week's count on pace."
// Each scheduled day, once it's fully in the past, is its own slot: it's
// paid only by an entry on that exact date, never by a later entry landing
// on some other day. An entry on a day with no scheduled requirement of its
// own is surplus, banked to pay down exactly that much outstanding debt —
// this is the only way a missed day clears, since its own date can't be
// relogged after the fact. Deliberately stricter than a plain running
// count: hitting Wednesday's own session doesn't retroactively cover a
// missed Monday, even though the week's total might still be on pace —
// only something *extra* does. Today itself is never judged as missed here
// (that's "still due", not "already failed") but an unscheduled today's
// entry does count as surplus immediately, same as any other day.
function scheduledDebt(goal, todayIso) {
  // Reuses scheduledDayStates' own per-day classification (see below) rather
  // than re-deriving missed/unscheduled-with-entry from scratch — the two
  // functions must agree on what counts as "missed" or "surplus" (this
  // one's terms) vs. "missed" or "unscheduled" (that one's terms, feeding
  // the Upcoming dialog's own day-strip detail), and reusing one guarantees
  // it rather than relying on two implementations staying in sync by hand.
  const todayIdx = WEEKDAYS.indexOf(weekdayKeyOf(todayIso));
  let missed = 0;
  let surplus = 0;
  scheduledDayStates(goal, todayIso, goal.tracking.reminderDays).forEach((day, idx) => {
    if (idx > todayIdx) return; // only today and earlier days are in play
    if (day.state === 'missed') missed += 1; // a past scheduled day left unfilled
    else if (day.state === 'unscheduled') surplus += 1; // an entry on a day with no requirement of its own
  });
  return Math.max(0, missed - surplus);
}

// scheduledBucket's row-facing counterpart. Reserves 'overdue' for genuine
// unpaid debt (see scheduledDebt above) rather than the dialog's plain
// behind-schedule check — a debt day that's still payable by an extra
// session reads as 'today' instead of 'overdue' the dialog would show, and
// once debt exists it stays 'overdue' for the rest of the period regardless
// of further on-schedule logging (only a surplus entry — one on a day with
// no requirement of its own — ever pays it down), mirroring
// nxRowBucketWeekly's own sticky-until-resolved behaviour.
function scheduledRowBucket(goal, todayIso) {
  const { target, entries, reminderDays } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none';

  if (scheduledDebt(goal, todayIso) > 0) return 'overdue'; // a specific missed day was never made up — Failed

  const todayKey = weekdayKeyOf(todayIso);
  const loggedToday = entries?.includes(todayIso);
  if (reminderDays.includes(todayKey) && !loggedToday) return 'today'; // today's own slot is due
  if (loggedToday) return 'tomorrow'; // logged today, nothing more actionable until tomorrow
  return 'none'; // no debt, and today isn't a scheduled slot
}

// scheduledBucket() plus the day-ahead heads-up: if today's own state comes
// back quiet ('none' — either on pace, or already met) and tomorrow is
// itself a scheduled day, upgrade to 'tomorrow' — the same orange icon
// nxBucketWeekly already shows a day ahead of something coming due —
// instead of leaving the row icon-less with the heads-up only reaching the
// Upcoming dialog/notification digest.
//
// But if the target is already *met* this period, there's nothing left to
// do until the period resets, so no day-ahead preview for a day that's
// already covered — a completed Mon-Thu goal shouldn't keep hinting at
// Friday all the way to Sunday. The one exception is today being the
// period's last day (Sunday): "tomorrow" there means the *next* period
// starting fresh, not a leftover of this one, so a heads-up for its first
// scheduled day is exactly as relevant as any other day-ahead preview —
// reminderDays is a fixed weekly pattern, so checking it against next
// Monday is valid regardless of which week is starting.
function scheduledUrgency(goal, todayIso, reminderDays) {
  const raw = scheduledBucket(goal, todayIso);
  if (raw !== 'none') return raw;
  const { target } = goal.tracking;
  const met = currentPeriodCount(goal.tracking, todayIso) >= target;
  const isLastDayOfPeriod = weekdayKeyOf(todayIso) === 'sun';
  if (met && !isLastDayOfPeriod) return 'none';
  return reminderDays.includes(tomorrowWeekdayKeyOf(todayIso)) ? 'tomorrow' : 'none';
}

// Same day-ahead heads-up, wrapping the row-facing raw bucket instead —
// recoverability plays no part in the day-ahead preview itself (nothing's
// actually behind in that state, so there's nothing to latch).
function scheduledRowUrgency(goal, todayIso, reminderDays) {
  const raw = scheduledRowBucket(goal, todayIso);
  if (raw !== 'none') return raw;
  const { target } = goal.tracking;
  const met = currentPeriodCount(goal.tracking, todayIso) >= target;
  const isLastDayOfPeriod = weekdayKeyOf(todayIso) === 'sun';
  if (met && !isLastDayOfPeriod) return 'none';
  return reminderDays.includes(tomorrowWeekdayKeyOf(todayIso)) ? 'tomorrow' : 'none';
}

// Descriptive "what's actually going on" detail for the Upcoming dialog
// only — never used to decide a bucket, purely commentary layered on top
// of whatever frequencyUrgencyOf already returned. Returns null when
// there's nothing to report (on pace, met, or a plain day-ahead preview
// with no actual shortfall yet — see each helper below for how that's
// distinguished from a genuine one).
//
// Two shapes: { kind: 'count', count } for Any/monthly, which have no
// day-of-week concept at all to point to, just an aggregate shortfall; and
// { kind: 'days', days: [{ wd, state }, ...] } (all 7 WEEKDAYS, Mon-Sun)
// for scheduled-days/every-day, which can name a full picture per day —
// see scheduledDayStates below for the 5 states. The UI renders the
// latter as a fixed 7-slot strip (see upcoming-dialog.js) rather than
// spelling out day names — position alone disambiguates Tue from Thu, Sat
// from Sun, with a single letter per slot, and needs no translation-length
// accommodation the way spelled-out day names would.
function nxMissedCount(goal, todayIso, type) {
  const { target } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 0; // met
  const slack = remainingDaysInPeriod(type, todayIso) - remainingNeed;
  // Only the same critical zone nxBucket itself uses ('overdue'/'tomorrow'
  // once logged) counts as a genuine shortfall — slack === 1 is just the
  // day-ahead preview, nothing actually missed yet, so it reports 0 here
  // even though remainingNeed is still > 0 in that case too.
  return slack <= 0 ? remainingNeed : 0;
}

// The local calendar date, this week, for a given WEEKDAYS index (0=Mon).
function currentWeekDateForIndex(todayIso, dayIdx) {
  const d = localDate(todayIso);
  const todayIdx = (d.getDay() + 6) % 7;
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (dayIdx - todayIdx));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

// The full picture for every day of the current week (always all 7, fixed
// Mon-Sun order) — a literal per-date check, deliberately not the same
// "aggregate count vs scheduledSoFar" comparison the bucket itself uses
// (which lets an unscheduled day's entry silently cover an earlier
// scheduled day's debt). A goal that's mathematically "on pace" by that
// aggregate measure can still have a specific missed date here; this is
// describing what actually happened on each day, not whether the week's
// target is still reachable. Five states:
//   - 'missed': scheduled, strictly before today, no entry that exact date
//   - 'success': scheduled, has an entry that exact date (past or today)
//   - 'unscheduled': not scheduled, but has an entry anyway
//   - 'pending': scheduled, no entry yet, but not past (today or later) —
//     nothing to fault yet, the day just hasn't happened
//   - 'blank': not scheduled and no entry — irrelevant to this goal
export function scheduledDayStates(goal, todayIso, reminderDays) {
  const logged = new Set(goal.tracking.entries ?? []);
  const todayIdx = WEEKDAYS.indexOf(weekdayKeyOf(todayIso));
  return WEEKDAYS.map((wd, idx) => {
    const isScheduled = reminderDays.includes(wd);
    const isLogged = logged.has(currentWeekDateForIndex(todayIso, idx));
    let state;
    if (isScheduled && isLogged) state = 'success';
    else if (!isScheduled && isLogged) state = 'unscheduled';
    else if (isScheduled && idx < todayIdx) state = 'missed';
    else if (isScheduled) state = 'pending';
    else state = 'blank';
    return { wd, state };
  });
}

// Dispatches to whichever helper above applies, mirroring
// frequencyUrgencyOf's own type/reminderDays branching exactly — see that
// function for why each branch routes where it does.
export function frequencyMissedDetail(goal, active, todayIso = todayISO()) {
  if (!active) return null;
  const tr = goal?.tracking;
  if (!tr) return null;

  if (tr.type === 'monthly') {
    const count = nxMissedCount(goal, todayIso, 'monthly');
    return count > 0 ? { kind: 'count', count } : null;
  }

  if (tr.type === 'weekly') {
    if (tr.reminderDays === 'any' && tr.target === WEEKDAYS.length) {
      const days = scheduledDayStates(goal, todayIso, WEEKDAYS);
      return days.some(d => d.state === 'missed') ? { kind: 'days', days } : null;
    }
    if (tr.reminderDays === 'any') {
      const count = nxMissedCount(goal, todayIso, 'weekly');
      return count > 0 ? { kind: 'count', count } : null;
    }
    if (Array.isArray(tr.reminderDays) && tr.reminderDays.length > 0) {
      const days = scheduledDayStates(goal, todayIso, tr.reminderDays);
      return days.some(d => d.state === 'missed') ? { kind: 'days', days } : null;
    }
  }

  return null;
}

// The goal's pace-driven urgency for the Upcoming dialog / bell badge /
// notification digest — see the module doc for why this deliberately
// disagrees with frequencyRowUrgencyOf once a goal is behind schedule.
// `active` mirrors urgencyOf's own gate (percentValue < 100 && !archived).
export function frequencyUrgencyOf(goal, active, todayIso = todayISO()) {
  if (!active) return 'none';
  const tr = goal?.tracking;
  if (!tr) return 'none';

  if (tr.type === 'monthly') return nxBucketMonthly(goal, todayIso);

  if (tr.type === 'weekly') {
    // "Every day" is its own case, evaluated identically no matter which
    // picker produced it: Any mode maxed out at target 7 means the exact
    // same commitment as picking all 7 specific days (there's no day left
    // that isn't required), so both always go through scheduledUrgency
    // rather than nxBucketWeekly's math. That math stays exactly as-is for
    // every other Any target (1-6), which has no specific-days equivalent
    // to unify with — only 7 is unambiguous.
    if (tr.reminderDays === 'any' && tr.target === WEEKDAYS.length) {
      return scheduledUrgency({ ...goal, tracking: { ...tr, reminderDays: WEEKDAYS } }, todayIso, WEEKDAYS);
    }
    if (tr.reminderDays === 'any') return nxBucketWeekly(goal, todayIso);
    if (Array.isArray(tr.reminderDays) && tr.reminderDays.length > 0) {
      return scheduledUrgency(goal, todayIso, tr.reminderDays);
    }
  }

  return 'none'; // percentage, decreasing, or weekly never configured
}

// The goal's pace-driven urgency for its own row icon — see the module doc
// above for the exact (single) point of divergence from
// frequencyUrgencyOf: once a miss turns out to be mathematically
// unrecoverable, this latches to 'overdue' for the rest of the period,
// even after today gets logged, instead of clearing/downgrading the way
// the dialog does.
//
// Decreasing ("Avoid") goals are the row's *other* point of divergence,
// and a bigger one: the dialog never produces anything but 'none' for
// decreasing goals (no due-tomorrow/due-today concept applies to an
// anti-habit at all), but the row now also carries a second, unrelated
// signal on top of pace/deadline urgency — plain failure. Failed here is
// evaluated per week, not per block: isOverAllowance alone answers "is the
// block's pooled allowance currently exhausted," which for a 4-week
// allowancePeriod can stay true for the rest of the block once a single bad
// week blows it — that's the right answer for the dialog's own allowance
// summary (currentAllowanceSpent), but wrong for a *day-to-day* red
// indicator: a week with zero new slips shouldn't read as failing today
// just because an earlier week in the same block already spent the whole
// pool. Gating on currentPeriodCount too means Failed only lights up on a
// week that itself added a slip while the (carried-over) allowance was
// already used up — the exact week the overage actually happened in, not
// every week after it. Once true, it's a static "the week is lost, do
// better next week" consequence — deliberately invisible to the dialog/bell
// badge/notifications, which stay about what's actionable, never about a
// retrospective failure to note.
export function frequencyRowUrgencyOf(goal, active, todayIso = todayISO()) {
  if (!active) return 'none';
  const tr = goal?.tracking;
  if (!tr) return 'none';

  if (tr.type === 'monthly') return nxRowBucketMonthly(goal, todayIso);

  if (tr.type === 'decreasing') {
    const failedThisWeek = isOverAllowance(goal, todayIso) && currentPeriodCount(tr, todayIso) > 0;
    return failedThisWeek ? 'overdue' : 'none';
  }

  if (tr.type === 'weekly') {
    if (tr.reminderDays === 'any' && tr.target === WEEKDAYS.length) {
      return scheduledRowUrgency({ ...goal, tracking: { ...tr, reminderDays: WEEKDAYS } }, todayIso, WEEKDAYS);
    }
    if (tr.reminderDays === 'any') return nxRowBucketWeekly(goal, todayIso);
    if (Array.isArray(tr.reminderDays) && tr.reminderDays.length > 0) {
      return scheduledRowUrgency(goal, todayIso, tr.reminderDays);
    }
  }

  return 'none';
}
