// The `tracking` shape (replaces flat `percentage`, migrated once at boot;
// see app/utils/migrate-goals.js). Not a strict discriminated union — every
// goal always carries all four fields:
//   { type: 'percentage' | 'weekly' | 'monthly' | 'decreasing' | 'countdown', value: number, target: number, entries: string[] }
// `type` is a pure discriminant: it tells consumers which fields are "live"
// (percentValue reads `value` for percentage, `target`/`entries` for
// weekly/monthly/decreasing), but doesn't gate which fields *exist*.
// Switching type never drops the inactive side — a goal that's been both a
// percentage and a habit at different points keeps both `value` and
// `entries` around, so switching back recovers exactly what was there
// before. `entries` are unique ISO calendar dates (YYYY-MM-DD), one per day
// max, past dates allowed. "Every day" is a UI preset for weekly target=7,
// not its own type.
//
// `decreasing` ("Avoid" in the UI) is the anti-habit type — it starts at
// 100% and drops as `entries` (days you slipped, not completed) accumulate.
// Its `target` is repurposed as an *allowance*: free slips (0–6, default 0)
// that cost nothing, refilling every week — the fraction's denominator is
// always that week's own 7 days. (A pooled 4-week allowance existed briefly
// and was removed: its blocks were tiled backwards from whatever date was
// being viewed, so the same calendar week landed in different blocks
// depending on when you looked, and a past week the row called clean could
// still dent the history chart. Any budget spanning more than one week has
// to be anchored to the calendar — a month, not "four weeks back from
// now" — which was more machinery than the setting was worth.) Switching
// an existing weekly/monthly goal to decreasing (or back) reinterprets
// `entries`' meaning — completions become slips or vice versa — rather than
// discarding them, the same class of tradeoff the "never drops the inactive
// side" rule above already accepts.
//
// percentValue() works identically for every type — nothing outside this
// module should read `.tracking` directly.
//
// `countdown` is a self-advancing type — it has no manual value and no
// entries; its percentage is purely derived from elapsed calendar days
// between `tracking.startDate` and the goal's own `dueDate` (its end date —
// deliberately reused rather than a second date field, see CLAUDE.md). One
// more field rides along, meaningful only for this type (same "always
// present once ever set, inert otherwise" convention `dueDate` follows):
//   startDate: string (ISO YYYY-MM-DD) — the actual concrete date every
//     calculation reads, exactly like dueDate. Goal-dialog's "Year start"
//     button is a one-shot quick-fill (sets this field to Jan 1 of the
//     goal's own year and nothing more) rather than a stored mode — there's
//     no memory of how a given startDate was set, it's just a plain editable
//     date like any other. Goal objects don't carry their own `year` (it's
//     the outer key in the store), so "Year start" resolves against
//     goal-dialog's own `_fromYear` at the moment it's clicked rather than
//     something recomputed live — avoids threading year context through
//     percentValue and every consumer (export-markdown, upcoming.js,
//     sw-extensions.js, ...). Known tradeoff: moving a countdown goal to a
//     different year never shifts a startDate that happened to be set via
//     "Year start" — re-clicking the button after the move does.
//
// `reminderDays` (weekly goals only, set via goal-dialog's own reminder-day
// chip row) is a separate, independently-optional field on the same object:
//   undefined  — not configured yet (default; the goal doesn't participate
//                in the Upcoming digest/skim view until explicitly set)
//   'any'      — times-per-period mode: no specific days pinned
//   string[]   — scheduled-days mode: a subset of WEEKDAYS (0+ days)
// goal-dialog.js reads/writes it directly alongside type/target/entries
// (the dialog is this shape's own editor, same as those); WEEKDAYS is
// exported from here so it stays the single source for day-key order once
// the Upcoming-view aggregation also needs to read this field.
import { todayISO } from './today-iso.js';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Which calendar unit a type's periods bucket into. Decreasing shares
// weekly's Mon–Sun buckets (the allowance is a per-week budget), so it
// reuses isoWeekKey rather than a parallel copy of the period-walking logic
// below — see periodKey/recentPeriods.
const PERIOD_UNIT = { weekly: 'week', monthly: 'month', decreasing: 'week' };

// Decreasing's fraction denominator — always 7 (days in a week), never
// scaled by the allowance. A miss always costs exactly 1/7 of that week's
// score once you're past the allowance.
const DAYS_PER_WEEK = 7;

// count (entries in a period) -> 0..1 score, per type. Frequency counts *up*
// toward a target; decreasing counts *down* from a perfect week — same
// window/weighting machinery, opposite polarity — so this is a pluggable
// per-type function rather than a branch inside fractionsForWindow.
const PERIOD_FRACTION = {
  weekly:  (count, target) => Math.min(count / target, 1),
  monthly: (count, target) => Math.min(count / target, 1),
  // `target` here is an *allowance*: the first N slips each week are free
  // (effective stays 0, no cost at all). Once you're past it, the excess
  // is weighed against (7 - allowance) rather than a flat 7 — a shrinking
  // remaining budget, so each slip past the allowance costs progressively
  // more than the flat-7 baseline would, catching up to the full week's
  // worth of damage as the allowance itself grows. Clamped at 0 so a very
  // bad week can't drag the weighted average negative.
  decreasing: (count, allowance = 0) => Math.max(0, 1 - Math.max(0, count - allowance) / (DAYS_PER_WEEK - allowance)),
};

// Target/allowance defaults for a type that's never had one set (a fresh
// goal, or one switching into weekly/monthly/decreasing for the first time).
export const DEFAULT_TARGET = { weekly: 3, monthly: 4, decreasing: 0 };

// Periods considered for the weighted average — weekly and monthly get
// separate lengths because a "period" is such a different wall-clock span
// for each (6 weeks ≈ 1.5 months vs 4 months) — a shared count would mean a
// flawless brand-new monthly goal can't reach 100% for many months (weight
// math bottoms out at current/sum-of-1..N with every period before the goal
// existed counted as missed). Decreasing shares weekly's 6-week window; its
// own recency curve (see decreasingWeightedAverage) is what actually differs.
export const PERIOD_WINDOW = { weekly: 6, monthly: 4, decreasing: 6 };

// The row's glance strip deliberately shows *less* history than the score
// actually counts, where the two windows differ (3 periods — the current
// one plus 2 past — vs. PERIOD_WINDOW's 6/4/6) — a recent-glance view, not a
// full explanation of the score, in anticipation of a future analytics
// feature that will cover the fuller history in detail (shrunk from 4 to 3
// in favour of that upcoming analytics view, to cut a bit more noise off the
// row itself). Narrower than every type's own score window now, including
// monthly's (PERIOD_WINDOW.monthly is 4) — recentDots never shows a type's
// full scored history at this size. Purely display: recentDots()/
// recentWeekStates() read this, but percentValue/weightedAverage/
// decreasingWeightedAverage always read PERIOD_WINDOW and are completely
// untouched by this window's size.
export const DOT_WINDOW = { weekly: 3, monthly: 3, decreasing: 3 };

// Fix-a-day's scrollable window, in calendar days — deliberately independent
// of both PERIOD_WINDOW (the score) and DOT_WINDOW (the display) and
// unchanged by the DOT_WINDOW size above:
// showing less by default was never meant to shrink how far back an entry
// can still be corrected. Monthly specifically reaches further (6 months)
// than what's actually scored (PERIOD_WINDOW.monthly, 4 months) — by
// design, correcting an old month you're catching up on shouldn't require
// it to still be visible or still counted. Months are approximated at 30
// days; fix-a-day is a flat day-count strip, not period-boundary-exact —
// the score itself (via monthKey/isoWeekKey below) is the exact calendar
// math.
export const FIX_DAY_SPAN = { weekly: 42, monthly: 180, decreasing: 42 };

// Decreasing's max allowance is capped one day below the week (6 of 7) so
// at least one day can still cost something; a max equal to the full week
// would make every day free, i.e. stop tracking anything.
export const TARGET_LIMITS = {
  weekly: [1, 7],
  monthly: [1, 31],
  decreasing: [0, 6],
};

// The single place that resolves a type down to its [min, max] pair — every
// caller (the stepper's clamp, its disabled states) goes through this rather
// than indexing TARGET_LIMITS directly, so a type's limits are named in
// exactly one place.
export function targetLimitsFor(type) {
  return TARGET_LIMITS[type];
}

export function isFrequency(goal) {
  const type = goal?.tracking?.type;
  return type === 'weekly' || type === 'monthly';
}

export function isCountdown(goal) { return goal?.tracking?.type === 'countdown'; }

// weekly | monthly | decreasing — every type whose progress lives in
// `entries` rather than a stored `value`. This, not isFrequency, is what
// gates the *interaction model* (tap/hold toggles a day, no drag-scrub) and
// Fix-a-day availability. isFrequency stays scoped to weekly/monthly because
// it also gates goal-item's dot-cluster *rendering*, which decreasing
// deliberately doesn't use — it keeps the percentage label visible and
// renders a septagon history strip instead. Broadening isFrequency to
// include decreasing would incorrectly hide that label and show the
// dot-cluster for this type.
export function isEntryType(type) { return !!PERIOD_UNIT[type]; }
export function isEntryBased(goal) { return isEntryType(goal?.tracking?.type); }
export function isDecreasing(goal) { return goal?.tracking?.type === 'decreasing'; }

// Decreasing-only recency weighting: weight doubles each week back (current
// week ~51% of a fully-elapsed score, oldest of the 6 only ~1.6%) —
// deliberately steeper than weekly/monthly's shared linear weightedAverage
// below, which stays untouched so no existing goal's score changes. A week
// fully outside the 6-week window still contributes nothing, same as the
// linear scheme — the goal always recovers to 100% once every slip has aged
// out of the window, just front-loaded much harder within it.
//
// The current (still in-progress) week gets two corrections a closed week
// doesn't need, together:
//
// 1. Its weight is prorated by how much of it has actually elapsed (Monday
//    = 1/7, Sunday = 7/7 = full weight) — otherwise a goal with a bad prior
//    week would read as instantly "recovered" the moment a new week starts,
//    crediting days that haven't happened yet as if they'd already been
//    avoided.
// 2. Its *fraction* is judged against elapsedDays instead of the fixed
//    7-day denominator PERIOD_FRACTION.decreasing uses for closed weeks —
//    a fully-elapsed week is just the elapsedDays=7 case of the same
//    formula, so this doesn't change anything once the week is over.
//
// Both corrections are needed together: prorating only the weight (1) while
// leaving the fraction on a fixed denominator lets a *worsening* week's
// score briefly *rise* for the first few days — the weight's growth
// (roughly 2x from Monday to Tuesday) can outrun how much one more slip
// drops a /7 fraction (roughly 0.83x), so the product still increases even
// while the user keeps failing. Modeled day-by-day before landing on this;
// judging the fraction against elapsedDays instead keeps it strictly
// non-increasing on a fail (a fail day always raises the ratio of
// slips-to-elapsed-days, never lowers it), which removes the paradox.
//
// Every week is judged on its own: its slips against its own elapsed days,
// with the allowance refilling each Monday. A pooled multi-week budget was
// tried and removed — see the module doc above for why anything spanning
// more than one week has to be anchored to the calendar.
function decreasingWeightedAverage(tracking, todayIso) {
  const weekKeys = recentPeriods('decreasing', PERIOD_WINDOW.decreasing, todayIso); // oldest -> current
  const counts = countByPeriod(tracking.entries, 'decreasing');
  const allowance = tracking.target ?? 0;
  const elapsedDaysThisWeek = ((localDate(todayIso).getDay() + 6) % 7) + 1; // Mon=1 .. Sun=7

  const fractions = weekKeys.map((key, i) => {
    const slips = counts.get(key) ?? 0;
    const elapsed = i === weekKeys.length - 1 ? elapsedDaysThisWeek : DAYS_PER_WEEK;
    return Math.max(0, 1 - Math.max(0, slips - allowance) / Math.max(1, elapsed - allowance));
  });

  let weightedSum = 0, weightSum = 0;
  fractions.forEach((f, i) => {
    const isCurrent = i === fractions.length - 1;
    const weight = 2 ** i * (isCurrent ? elapsedDaysThisWeek / DAYS_PER_WEEK : 1); // oldest -> 2^0=1, current -> up to 2^5=32
    weightedSum += f * weight;
    weightSum += weight;
  });
  return weightSum ? weightedSum / weightSum : 0;
}

// Whole calendar days from `fromIso` to `toIso` (negative if `toIso` is
// earlier) — parses date parts manually, same reasoning as daysUntil in
// urgency.js: `new Date('2026-07-28')` is UTC midnight and can land on the
// wrong local day.
export function daysBetween(fromIso, toIso) {
  return Math.round((localDate(toIso) - localDate(fromIso)) / 86400000);
}

// Countdown's own math — doesn't fit the period/entries machinery above (no
// target, no entries), so like decreasingWeightedAverage it's a wholly
// separate function percentValue special-cases directly. Undefined
// start/due dates (goal switched into countdown but not fully configured
// yet) read as 0% rather than throwing — the dialog force-opens the
// due-date field the moment countdown is picked, but a goal can still be
// briefly in this state mid-edit.
export function countdownValue(goal, todayIso = todayISO()) {
  const { startDate } = goal?.tracking ?? {};
  const dueDate = goal?.dueDate;
  if (!startDate || !dueDate) return 0;
  const total = daysBetween(startDate, dueDate);
  if (total <= 0) return todayIso >= dueDate ? 100 : 0;
  const elapsed = Math.max(0, Math.min(total, daysBetween(startDate, todayIso)));
  return Math.round((elapsed / total) * 100);
}

// Days left until the due date, floored at 0 (never negative — an overdue
// countdown just reads 0, same as its percentage capping at 100). `null`
// when there's no due date at all yet, distinct from 0 (due today) — the
// row's label reads that as "not yet configured" rather than "due today".
export function countdownDaysRemaining(goal, todayIso = todayISO()) {
  const dueDate = goal?.dueDate;
  if (!dueDate) return null;
  return Math.max(0, daysBetween(todayIso, dueDate));
}

export function percentValue(goal, todayIso = todayISO()) {
  const tr = goal?.tracking;
  if (!tr) return 0;
  if (tr.type === 'percentage') return tr.value ?? 0;
  if (tr.type === 'countdown') return countdownValue(goal, todayIso);
  if (tr.type === 'decreasing') return Math.round(decreasingWeightedAverage(tr, todayIso) * 100);
  return Math.round(weightedAverage(tr, todayIso) * 100);
}

// `history` is percentage-type's own analytics log — a snapshot of `value`
// per calendar day, one entry per day max (upsert, overwriting same-day),
// mirroring the "one entry per day max" convention `entries` already uses
// for frequency/decreasing types. It's the only way "percentage over time"
// or "vs last month/quarter/year" can exist for this type at all: unlike
// weekly/monthly/decreasing (whose percentValue is already date-aware via
// entries), a percentage goal's value has no history without this. No
// backfill — a goal's history starts accumulating from whichever day this
// first runs on, same as every other lazily-introduced optional field here.
export function percentHistory(goal) { return goal?.tracking?.history ?? []; }

// Carry-forward lookup — the last snapshot with date <= iso, since a
// percentage doesn't reset each period the way a frequency score does.
// `history` must be ascending-sorted (setPercent maintains this).
// Returns undefined — not 0 — when no snapshot predates `iso` at all, so
// callers can distinguish "not enough history yet" from a real 0%.
export function historyValueAt(history, iso) {
  let result;
  for (const entry of history) {
    if (entry.date > iso) break;
    result = entry.value;
  }
  return result;
}

export function setPercent(goal, pct, dateIso = todayISO()) {
  // Spreads the existing tracking first so a dormant target/entries (from a
  // goal that's previously been weekly/monthly) survives untouched — only
  // type, value, and this date's history snapshot are actually being touched.
  const v = Math.max(0, Math.min(100, pct));
  const history = [...percentHistory(goal).filter(h => h.date !== dateIso), { date: dateIso, value: v }]
    .sort((a, b) => a.date.localeCompare(b.date));
  // value mirrors the LATEST snapshot, not the one just written — editing a
  // past day must not drag the goal's current percentage backwards with it.
  // For an edit dated today the two are the same, so this is a no-op there.
  return { ...goal, tracking: { ...goal.tracking, type: 'percentage', value: history[history.length - 1].value, history } };
}

// Removes a single day's snapshot. The surgical fix for a mistyped value —
// notably the first one, which anchors the whole expected-pace ramp and
// otherwise can only ever be overwritten, never removed. Emptying the history
// entirely drops the goal back to 0: value always tracks the newest snapshot,
// so with none left there is nothing recorded to report.
export function clearPercentAt(goal, dateIso) {
  const history = percentHistory(goal).filter(h => h.date !== dateIso);
  const value = history.length ? history[history.length - 1].value : 0;
  return { ...goal, tracking: { ...goal.tracking, type: 'percentage', value, history } };
}

export function logEntry(goal, iso = todayISO()) {
  const tr = goal.tracking;
  if (tr.entries.includes(iso)) return goal;
  return { ...goal, tracking: { ...tr, entries: [...tr.entries, iso].sort() } };
}

export function unlogEntry(goal, iso = todayISO()) {
  const tr = goal.tracking;
  if (!tr.entries.includes(iso)) return goal;
  return { ...goal, tracking: { ...tr, entries: tr.entries.filter(d => d !== iso) } };
}

export function isLoggedOn(goal, iso = todayISO()) {
  return !!goal?.tracking?.entries?.includes(iso);
}

// ── Period math ──────────────────────────────────────────────────────────────
// Weeks are ISO weeks (Mon–Sun). Parses YYYY-MM-DD as local-date components
// (matching today-iso.js) rather than `new Date(iso)`, which is UTC and can
// land on the wrong local day.

function localDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function pad(n) { return String(n).padStart(2, '0'); }

// Standard "nearest Thursday" ISO week algorithm — the week (and its year,
// which can differ from the date's own year at year boundaries) belongs to
// whichever calendar year contains that week's Thursday.
export function isoWeekKey(iso) {
  const d = localDate(iso);
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - day + 3); // jump to this week's Thursday
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const week = 1 + Math.round((d - firstThursday) / 604800000);
  return `${d.getFullYear()}-W${pad(week)}`;
}

export function monthKey(iso) {
  const [y, m] = iso.split('-');
  return `${y}-${m}`;
}

function periodKey(iso, type) {
  return PERIOD_UNIT[type] === 'week' ? isoWeekKey(iso) : monthKey(iso);
}

// The last `count` period keys ending with the period containing `todayIso`,
// oldest first — the shared window the dot-strip and the weighted average
// both walk.
export function recentPeriods(type, count = PERIOD_WINDOW[type], todayIso = todayISO()) {
  const today = localDate(todayIso);
  const keys = [];
  for (let i = count - 1; i >= 0; i--) {
    if (PERIOD_UNIT[type] === 'week') {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 7);
      keys.push(isoWeekKey(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`));
    } else {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      keys.push(monthKey(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`));
    }
  }
  return keys;
}

function countByPeriod(entries, type) {
  const counts = new Map();
  for (const iso of entries) {
    const key = periodKey(iso, type);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// Shared by periodFractions (always PERIOD_WINDOW[type], feeds the score)
// and recentDots (DOT_WINDOW[type], feeds the row — can show more than the
// score counts, see DOT_WINDOW above).
export function fractionsForWindow(tracking, count, todayIso) {
  const { type, target, entries } = tracking;
  const counts = countByPeriod(entries, type);
  const fraction = PERIOD_FRACTION[type];
  return recentPeriods(type, count, todayIso).map(key => fraction(counts.get(key) ?? 0, target));
}

// Fraction of target met (0–1, capped) for each period in the window, oldest
// first — the last entry is always the current (possibly still-open) period.
export function periodFractions(tracking, todayIso = todayISO()) {
  return fractionsForWindow(tracking, PERIOD_WINDOW[tracking.type], todayIso);
}

// Raw (uncapped) entry count for the period containing `todayIso` — the
// number a status line reads out ("2 of 3 this week"), as opposed to
// periodFractions' capped 0–1 used for math/rendering.
export function currentPeriodCount(tracking, todayIso = todayISO()) {
  const { type, entries } = tracking;
  const counts = countByPeriod(entries, type);
  return counts.get(periodKey(todayIso, type)) ?? 0;
}

// UI-facing: classify each period in the DOT_WINDOW, with the last one
// flagged `current` (still open, not a closed period yet) — feeds
// goal-item's dot-strip directly so the component never touches date math
// itself. Leading missed periods are trimmed before returning: once a losing
// streak runs all the way back to the start of the window, showing all of it
// just anchors the row on the failure — trim down to wherever progress
// actually starts (or, if there's none at all, to the current period alone)
// so a fresh restart doesn't look like it's dragging a dead streak behind
// it. Display only — periodFractions/weightedAverage (the score) are a
// separate call that always reads the full, untrimmed PERIOD_WINDOW.
export function recentDots(goal, todayIso = todayISO()) {
  const { type } = goal.tracking;
  const fractions = fractionsForWindow(goal.tracking, DOT_WINDOW[type], todayIso);
  const dots = fractions.map((fraction, i) => ({
    fraction,
    state: fraction >= 1 ? 'met' : fraction > 0 ? 'partial' : 'missed',
    current: i === fractions.length - 1,
  }));
  const firstActive = dots.findIndex(d => d.state !== 'missed');
  return firstActive === -1 ? dots.slice(-1) : dots.slice(firstActive);
}

// Linear recency weighting — the current period counts PERIOD_WINDOW[type]×
// as much as the oldest one in the window. Documented here rather than left implicit:
// encodes "how you're doing lately matters more than a closed period from a
// while back" without a hard cliff between "counted" and "not counted".
function weightedAverage(tracking, todayIso = todayISO()) {
  const fractions = periodFractions(tracking, todayIso);
  let weightedSum = 0, weightSum = 0;
  fractions.forEach((f, i) => {
    const weight = i + 1; // oldest → 1, current → PERIOD_WINDOW
    weightedSum += f * weight;
    weightSum += weight;
  });
  return weightSum ? weightedSum / weightSum : 0;
}

// ── Decreasing-only UI helpers ──────────────────────────────────────────────

// The 7 ISO dates (Mon→Sun) of the week `weeksAgo` weeks before the week
// containing `todayIso` (0 = current week).
function weekDates(todayIso, weeksAgo = 0) {
  const d = localDate(todayIso);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) - weeksAgo * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  });
}

// Day-states for the week `weeksAgo` weeks before the week containing
// `todayIso` (0 = current). Each day is 'clean' | 'within' | 'over', ranked
// in date order against that week's own allowance, which refills every
// Monday. Backfilling an earlier slip via Fix-a-day can re-rank a later one
// in the same week from 'within' to 'over': intentional, the allowance is
// spent chronologically, not per-day. Feeds goal-item's septagon strip
// directly, mirroring how recentDots feeds the frequency dot-strip.
export function weekDayStates(goal, todayIso = todayISO(), weeksAgo = 0) {
  const tracking = goal?.tracking ?? {};
  const { entries = [], target = 0 } = tracking;
  const logged = new Set(entries);
  const days = weekDates(todayIso, weeksAgo);
  let spent = 0;
  return days.map(iso => {
    let state = 'clean';
    if (logged.has(iso)) { state = spent < target ? 'within' : 'over'; spent++; }
    return { iso, state, today: iso === todayIso, future: iso > todayIso };
  });
}

// How many slips have been spent so far this week — for display purposes
// (e.g. goal-dialog's own tracking summary: "3 of 2 allowed/week").
export function currentAllowanceSpent(goal, todayIso = todayISO()) {
  return currentPeriodCount(goal?.tracking ?? {}, todayIso);
}

// Whether the current period's spend has already exceeded the allowance —
// the single boolean weekDayStates' per-day 'over' ranking implies but never
// exposes directly. Stays true for the rest of the week once tripped, even
// on a day with no new entry, since spent-so-far never decreases.
export function isOverAllowance(goal, todayIso = todayISO()) {
  const target = goal?.tracking?.target ?? 0;
  return currentAllowanceSpent(goal, todayIso) > target;
}

// DOT_WINDOW.decreasing weeks, oldest → current — drives the goal-item
// septagon history strip directly, always shown untrimmed (unlike
// recentDots' display-only trim of a leading missed streak). Display-only,
// same as recentDots — the score (decreasingWeightedAverage) always reads
// the full PERIOD_WINDOW.decreasing regardless of how few weeks are shown
// here. A week before the goal existed has no entries, so it naturally
// comes back all-'clean' (0 slips ⇒ fraction 1.0) — correctly consistent
// with "a new decreasing goal starts at 100%", the mirror image of
// frequency types' "counts as missed before the goal existed" issue noted
// above, not a new problem needing its own placeholder state.
export function recentWeekStates(goal, todayIso = todayISO(), count = DOT_WINDOW.decreasing) {
  return Array.from({ length: count }, (_, i) => weekDayStates(goal, todayIso, count - 1 - i));
}
