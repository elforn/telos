// Pure, DOM-free analytics functions for the goal-analytics view (Overview,
// Score, Activity, Streaks pages inside the goal-edit dialog's swipeable
// tabs). Nothing here touches the store — every function takes a plain
// `goal` object and, where relevant, an explicit `todayIso` override for
// deterministic tests, mirroring the convention already established in
// tracking.js.
import { todayISO } from './today-iso.js';
import {
  percentValue, percentHistory, historyValueAt, isoWeekKey, monthKey,
  isEntryBased, isDecreasing, isFrequency, weekDayStates, daysBetween,
} from './tracking.js';

// ── Page list ────────────────────────────────────────────────────────────
// The analytics view's own internal pages, in display order. The "Score"
// page (how the weighted score is calculated) only exists for the three
// types whose percentage comes from a rolling weighted window at all —
// percentage and countdown compute their value a completely different way,
// so there's nothing there for that page to explain. Countdown additionally
// has no discrete per-day log of any kind, so Activity/Streaks are dropped
// outright rather than shown empty.
export function pagesFor(goal) {
  const pages = ['overview'];
  if (isFrequency(goal) || isDecreasing(goal)) pages.push('score');
  if (goal?.tracking?.type !== 'countdown') pages.push('activity', 'streaks');
  return pages;
}

function localDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function pad(n) { return String(n).padStart(2, '0'); }

function toIso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// ── percentValueAt ───────────────────────────────────────────────────────
// A goal's percentValue as of a past (or present) date. Delegates straight
// to percentValue() for every type except 'percentage' — weekly/monthly/
// decreasing/countdown are already date-aware (percentValue takes a
// todayIso), so no new data is needed for them. Percentage-type is the only
// type whose formula wasn't already date-aware — that's exactly the gap the
// new tracking.history log closes. Returns undefined — not 0 — when no
// snapshot predates `iso` at all, so callers can tell "not enough history
// yet" apart from a real 0%.
export function percentValueAt(goal, iso) {
  if (goal?.tracking?.type !== 'percentage') return percentValue(goal, iso);
  return historyValueAt(percentHistory(goal), iso);
}

// ── dateListFor ──────────────────────────────────────────────────────────
// The date array Activity/Streaks read from. Bounded to `daysBack` so a
// years-old goal doesn't force scanning its entire history for a chart that
// only ever shows a few months of it.
export function dateListFor(goal, todayIso = todayISO(), daysBack = 180) {
  const cutoff = iso => daysBetween(iso, todayIso) <= daysBack;
  if (isDecreasing(goal)) return decreasingOnTrackDates(goal, todayIso, daysBack);
  if (isEntryBased(goal)) return (goal?.tracking?.entries ?? []).filter(cutoff);
  if (goal?.tracking?.type === 'percentage') return percentHistory(goal).map(h => h.date).filter(cutoff);
  return []; // countdown has no discrete per-day log of any kind
}

// The dates something was actually *logged* — as opposed to dateListFor's
// "on track" complement for decreasing. Calendar shading and streaks
// genuinely want the on-track/clean-day signal (that's the whole point of
// the inversion), but "how many times was this touched" (the histogram, the
// Overview count stat) means the real entries — for decreasing, that's
// slips, not the 300-odd clean days they didn't happen on. Identical to
// dateListFor for every other type; only decreasing actually differs.
export function rawLoggedDates(goal, todayIso = todayISO(), daysBack = 180) {
  if (isDecreasing(goal)) {
    const cutoff = iso => daysBetween(iso, todayIso) <= daysBack;
    return (goal?.tracking?.entries ?? []).filter(cutoff);
  }
  return dateListFor(goal, todayIso, daysBack);
}

// Decreasing's entries are slip days — the inverse of a positive signal.
// "On track" here reuses weekDayStates' own allowance-aware chronological
// accounting (clean or within-allowance, i.e. not 'over') rather than a
// naive complement of raw entries, so this stays consistent with exactly
// what the septagon strip already shows for the same goal.
function decreasingOnTrackDates(goal, todayIso, daysBack) {
  const weeksNeeded = Math.ceil(daysBack / 7) + 1;
  const dates = [];
  for (let w = weeksNeeded - 1; w >= 0; w--) {
    for (const day of weekDayStates(goal, todayIso, w)) {
      if (day.future || day.state === 'over') continue;
      dates.push(day.iso);
    }
  }
  return dates.filter(iso => daysBetween(iso, todayIso) <= daysBack).sort();
}

// ── Streaks ──────────────────────────────────────────────────────────────
// Pure over a date-string array — no goal/tracking knowledge at all.
export function computeStreaks(dates) {
  const sorted = [...new Set(dates)].sort();
  const streaks = [];
  let start = null, prev = null;
  for (const iso of sorted) {
    if (prev !== null && daysBetween(prev, iso) !== 1) {
      streaks.push({ start, end: prev, length: daysBetween(start, prev) + 1 });
      start = iso;
    } else if (start === null) {
      start = iso;
    }
    prev = iso;
  }
  if (start !== null) streaks.push({ start, end: prev, length: daysBetween(start, prev) + 1 });
  return streaks;
}

// Top-N longest, then re-sorted most-recent-first for display — selecting
// by length and displaying by date are two different orderings, so a
// 4-day streak can sit above an 11-day one if it happened more recently.
export function topStreaks(dates, n = 10) {
  return computeStreaks(dates)
    .sort((a, b) => b.length - a.length)
    .slice(0, n)
    .sort((a, b) => b.end.localeCompare(a.end));
}

// ── Count-per-timebox ────────────────────────────────────────────────────
function quarterKey(iso) { return `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`; }
function yearKey(iso) { return iso.slice(0, 4); }
const BUCKET_KEY = { week: isoWeekKey, month: monthKey, quarter: quarterKey, year: yearKey };

// General grouping over a plain date array + an explicit unit — independent
// of goal type. Not a reuse of tracking.js's own (private, unexported)
// countByPeriod: that helper is keyed to a tracking type's own week/month
// cadence and has no quarter/year unit at all.
export function countByBucket(dates, unit) {
  const keyFn = BUCKET_KEY[unit];
  const counts = new Map();
  for (const iso of dates) counts.set(keyFn(iso), (counts.get(keyFn(iso)) ?? 0) + 1);
  return counts;
}

// ── Period stepping (for series/comparisons) ────────────────────────────
function stepDate(unit, todayIso, periodsAgo) {
  const d = localDate(todayIso);
  if (unit === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() - periodsAgo * 7);
  if (unit === 'quarter') return new Date(d.getFullYear(), d.getMonth() - periodsAgo * 3, d.getDate());
  if (unit === 'year') return new Date(d.getFullYear() - periodsAgo, d.getMonth(), d.getDate());
  return new Date(d.getFullYear(), d.getMonth() - periodsAgo, d.getDate()); // month
}

// ── Completion-% series (Progress chart, "achieved" line) ───────────────
// `count` points, oldest first, ending at todayIso's own period. Points
// with value === undefined (percentage-type, before any snapshot existed)
// are left in — the chart is expected to skip drawing them, not fabricate 0.
export function completionSeries(goal, unit, count, todayIso = todayISO()) {
  const points = [];
  for (let i = count - 1; i >= 0; i--) {
    const iso = toIso(stepDate(unit, todayIso, i));
    points.push({ iso, value: percentValueAt(goal, iso) });
  }
  return points;
}

// A single period's raw achieved fraction (0-1), independent of the
// weighted-average score — e.g. "3 of 3 runs that specific week", not the
// recency-weighted score across several weeks. Only meaningful for
// weekly/monthly/decreasing; percentage/countdown are handled directly in
// successRatioSeries below since they have no per-period target at all.
function singlePeriodFraction(goal, iso, todayIso) {
  const tr = goal.tracking;
  if (tr.type === 'decreasing') {
    const weeksAgo = Math.round(daysBetween(iso, todayIso) / 7);
    const days = weekDayStates(goal, todayIso, weeksAgo).filter(d => !d.future);
    if (days.length === 0) return 1;
    return days.filter(d => d.state !== 'over').length / days.length;
  }
  const keyFn = tr.type === 'monthly' ? monthKey : isoWeekKey;
  const key = keyFn(iso);
  const count = (tr.entries ?? []).filter(e => keyFn(e) === key).length;
  return Math.min(count / (tr.target || 1), 1);
}

// ── Success-ratio series (Progress chart, "expected pace" line) ─────────
// achieved/expected, `count` points oldest first. For weekly/monthly/
// decreasing this is a direct, literal reuse of the goal's own per-period
// target math — "expected" is always 100% (fully met), "achieved" is that
// one period's raw fraction. For percentage, "expected" is a plain linear
// pace across the calendar year (day-of-year ÷ 365), ignoring any dueDate —
// the simplest baseline that still means something. For countdown,
// achieved always equals expected by construction (percentValue already
// is elapsed ÷ total) — a flat, low-signal line, kept for page-shape
// consistency rather than special-cased away.
export function successRatioSeries(goal, unit, count, todayIso = todayISO()) {
  const type = goal?.tracking?.type;
  const points = [];
  for (let i = count - 1; i >= 0; i--) {
    const iso = toIso(stepDate(unit, todayIso, i));
    let achieved, expected;
    if (type === 'percentage') {
      achieved = percentValueAt(goal, iso);
      const d = localDate(iso);
      const dayOfYear = Math.round((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1;
      expected = Math.min(100, Math.round((dayOfYear / 365) * 100));
    } else if (type === 'countdown') {
      achieved = percentValueAt(goal, iso);
      expected = achieved;
    } else {
      expected = 100;
      achieved = Math.round(singlePeriodFraction(goal, iso, todayIso) * 100);
    }
    points.push({ iso, achieved, expected });
  }
  return points;
}

// ── Comparison delta (Overview "vs month/quarter/year") ─────────────────
// null — not a fake 0 — when there's no snapshot old enough yet, so the
// caller can show "not enough history" instead of a misleading number.
export function comparisonDelta(goal, unit, todayIso = todayISO()) {
  const pastIso = toIso(stepDate(unit, todayIso, 1));
  const before = percentValueAt(goal, pastIso);
  if (before === undefined) return null;
  const now = percentValueAt(goal, todayIso) ?? percentValue(goal, todayIso);
  return Math.round(now - before);
}

// ── Entries/updates count (Overview stat) ────────────────────────────────
export function updateCount(goal, todayIso = todayISO(), daysBack = 180) {
  return rawLoggedDates(goal, todayIso, daysBack).length;
}

// ── Pace projection (Overview callout) ───────────────────────────────────
// Plain arithmetic, no model involved: the recent slope of the completion
// series, extrapolated forward to a 100% crossing date. A goal with a real
// dueDate gets an ahead/behind read against it; one without just gets the
// projected date on its own. Returns null when there's nothing useful to
// say (already at 100%, or too little history to have a slope at all).
export function projectPace(goal, todayIso = todayISO()) {
  const current = percentValue(goal, todayIso);
  if (current >= 100) return null;

  const series = completionSeries(goal, 'month', 4, todayIso).filter(p => p.value !== undefined);
  if (series.length < 2) return null;

  const first = series[0], last = series[series.length - 1];
  const monthsSpan = daysBetween(first.iso, last.iso) / 30.44;
  const rate = monthsSpan > 0 ? (last.value - first.value) / monthsSpan : 0;
  if (rate <= 0.15) return { insufficientMomentum: true };

  const monthsToGo = (100 - current) / rate;
  const projected = new Date(localDate(todayIso).getFullYear(), localDate(todayIso).getMonth() + Math.round(monthsToGo), localDate(todayIso).getDate());
  const projectedIso = toIso(projected);

  if (goal.dueDate) {
    const diffMonths = Math.round(daysBetween(goal.dueDate, projectedIso) / 30.44);
    return { projectedIso, deadlineIso: goal.dueDate, diffMonths };
  }
  return { projectedIso };
}
