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
// now deliberately disagree once a goal is behind schedule:
//
// - frequencyUrgencyOf (dialog/Upcoming/notification-facing) stays fully
//   actionable — 'overdue' means "behind and nothing logged today," full
//   stop, no distinction between a still-fully-recoverable miss and an
//   already-unreachable one (don't hint at recoverability); logging today
//   always clears or downgrades it, so the bell badge and dialog never get
//   stuck showing something the user can't act on to resolve.
// - frequencyRowUrgencyOf (the goal's own row icon) uses the exact same
//   "behind = overdue, no distinction" rule for a day that hasn't been
//   logged yet — but once a miss turns out to be *unrecoverable*, the row
//   latches to 'overdue' for the rest of the period regardless of further
//   logging: "the week is lost, do better next week," a deliberately
//   sticky consequence the dialog is not supposed to carry.
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
// required. 'overdue' (not 'today') once slack<=0 and nothing's logged yet
// — Any mode has no "day zero, nothing missed yet" state at all: its
// tightest possible target (6, since 7 routes to the every-day/
// scheduled-days path below) means slack can never even reach <=0 on day 1
// of a fresh period, so this state is always at least some accumulated
// shortfall, never a first-time "your task for today" moment the way
// scheduled-days' today-wins case is — 'overdue' was always the more
// honest label for it.
//
// Once today's own entry is logged, though, there's nothing more the user
// can act on until tomorrow, so it downgrades to 'tomorrow' — this stays
// true even once the miss is unrecoverable (that distinction is the row's
// job now, see nxRowBucketWeekly, not the dialog's).
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
  if (slack <= 0) return entries?.includes(todayIso) ? 'tomorrow' : 'overdue';
  if (slack === 1) return 'tomorrow';
  return 'none';
}

// nxBucketWeekly's row-facing counterpart: identical whenever nothing's
// behind (slack > 0) or nothing's been logged yet (both agree on
// 'overdue'/'tomorrow'/'none' there). Diverges only once today IS logged
// but the miss turns out to be unrecoverable — the dialog would clear that
// to 'tomorrow', but the row latches to 'overdue' instead and stays there
// for the rest of the period, regardless of any further logging: "the week
// is lost, do better next week."
function nxRowBucketWeekly(goal, todayIso) {
  const { target, entries } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none';
  const slack = remainingDaysInPeriod('weekly', todayIso) - remainingNeed;
  if (slack <= 0) {
    if (!isRecoverable(goal, todayIso)) return 'overdue'; // sticky — logging today can't undo this
    return entries?.includes(todayIso) ? 'tomorrow' : 'overdue'; // recoverable — same as the dialog
  }
  if (slack === 1) return 'tomorrow';
  return 'none';
}

// Times-per-period mode, monthly, dialog-facing — every monthly goal,
// unconditionally (no reminderDays opt-in exists for monthly at all, see
// the module doc above). Same shape and same today/overdue collapse as
// weekly — kept deliberately consistent rather than diverging further —
// but a month is long enough to still earn a genuine third tier: 'week' at
// 2-7 days of slack, a moderate early warning distinct from 'tomorrow'/
// 'today's immediate urgency and from 'none's comfortable quiet — mirrors
// dueDate's own week/tomorrow/today split, just computed from pace instead
// of a fixed date.
function nxBucketMonthly(goal, todayIso) {
  const { target, entries } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none'; // already met this period
  const slack = remainingDaysInPeriod('monthly', todayIso) - remainingNeed;
  if (slack <= 0) return entries?.includes(todayIso) ? 'tomorrow' : 'overdue';
  if (slack === 1) return 'tomorrow';
  if (slack <= 7) return 'week';
  return 'none';
}

// nxBucketMonthly's row-facing counterpart — same relationship to it as
// nxRowBucketWeekly has to nxBucketWeekly above.
function nxRowBucketMonthly(goal, todayIso) {
  const { target, entries } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none';
  const slack = remainingDaysInPeriod('monthly', todayIso) - remainingNeed;
  if (slack <= 0) {
    if (!isRecoverable(goal, todayIso)) return 'overdue';
    return entries?.includes(todayIso) ? 'tomorrow' : 'overdue';
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
// Today wins — but only while there's no earlier debt. If today itself is
// scheduled and not yet logged, and nothing before today was missed
// either, that's just the ordinary, unremarkable "your task for today"
// state ('today'). But if an earlier day WAS missed, 'overdue' takes
// precedence even on a day that's also itself scheduled and unlogged — the
// earlier miss is the more urgent story, and masking it behind today's own
// normal task would hide it. (Contrast: the very first scheduled day of a
// fresh period trivially has no earlier debt — scheduledSoFar is 0 — so it
// always reads as plain 'today', never 'overdue'.)
//
// Beyond that: 'overdue' now covers every "behind, nothing logged today"
// case uniformly, recoverable or not — don't hint at recoverability, and
// keep the dialog fully actionable. Once today IS logged, it either clears
// to 'none' (already caught up, WITH enough runway left for what remains)
// or downgrades to 'tomorrow' (still short, but nothing more to act on
// until tomorrow) — recoverability plays no part in *which of those two*
// the dialog shows; that distinction is the row's separate concern (see
// scheduledRowBucket).
//
// "Caught up" requires more than just clearing the historical debt count
// (count >= scheduledSoFar) — that only checks whether earlier scheduled
// days were covered, never whether the days actually still remaining can
// fit the days still needed. E.g. missing the first of three scheduled
// days, then logging only the second, clears the historical-debt check
// (nothing missed *before* today) while leaving too few days for the
// third — genuinely still behind despite looking "on pace" by that
// narrower measure. isRecoverable folds in exactly that forward-looking
// check, so 'none' now requires both conditions together.
function scheduledBucket(goal, todayIso) {
  const { target, entries, reminderDays } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none'; // already met this period

  const todayKey = weekdayKeyOf(todayIso);
  const loggedToday = entries?.includes(todayIso);
  const todayIdx = WEEKDAYS.indexOf(todayKey);
  const scheduledSoFar = reminderDays.filter(d => WEEKDAYS.indexOf(d) < todayIdx).length;

  if (reminderDays.includes(todayKey) && !loggedToday) {
    return count < scheduledSoFar ? 'overdue' : 'today';
  }

  if (count >= scheduledSoFar && isRecoverable(goal, todayIso)) return 'none'; // caught up AND still enough runway left
  if (loggedToday) return 'tomorrow'; // still short, but nothing more actionable today
  return 'overdue'; // not logged, behind, today isn't itself the scheduled slot in question
}

// scheduledBucket's row-facing counterpart. Agrees with the dialog in
// every case except one: today logged, still short of target, but the miss
// turns out to be unrecoverable — the dialog clears that to 'tomorrow', the
// row latches to 'overdue' and stays there for the rest of the period,
// exactly mirroring nxRowBucketWeekly's own single point of divergence.
function scheduledRowBucket(goal, todayIso) {
  const { target, entries, reminderDays } = goal.tracking;
  const count = currentPeriodCount(goal.tracking, todayIso);
  const remainingNeed = target - count;
  if (remainingNeed <= 0) return 'none';

  const todayKey = weekdayKeyOf(todayIso);
  const loggedToday = entries?.includes(todayIso);
  const todayIdx = WEEKDAYS.indexOf(todayKey);
  const scheduledSoFar = reminderDays.filter(d => WEEKDAYS.indexOf(d) < todayIdx).length;

  if (reminderDays.includes(todayKey) && !loggedToday) {
    return count < scheduledSoFar ? 'overdue' : 'today';
  }

  // Same "caught up AND still enough runway left" requirement as the
  // dialog's own scheduledBucket — see its doc for why the historical
  // debt count alone isn't sufficient.
  const recoverable = isRecoverable(goal, todayIso);
  if (count >= scheduledSoFar && recoverable) return 'none';
  if (loggedToday) {
    return recoverable ? 'tomorrow' : 'overdue'; // sticky if unrecoverable
  }
  return 'overdue';
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
// signal on top of pace/deadline urgency — plain failure. Once the current
// week's (or 4-week block's) slip allowance is exceeded, the row goes
// full-row-red exactly like an unrecoverable miss does elsewhere, not as a
// prompt to act (nothing today fixes an already-blown allowance) but as a
// static "the week is lost, do better next week" consequence — deliberately
// invisible to the dialog/bell badge/notifications, which stay about
// what's actionable, never about a retrospective failure to note.
export function frequencyRowUrgencyOf(goal, active, todayIso = todayISO()) {
  if (!active) return 'none';
  const tr = goal?.tracking;
  if (!tr) return 'none';

  if (tr.type === 'monthly') return nxRowBucketMonthly(goal, todayIso);

  if (tr.type === 'decreasing') return isOverAllowance(goal, todayIso) ? 'overdue' : 'none';

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
