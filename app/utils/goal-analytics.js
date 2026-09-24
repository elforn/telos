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
  PERIOD_WINDOW,
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
function singlePeriodFraction(goal, iso, todayIso, cap = true) {
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
  const frac = count / (tr.target || 1);
  return cap ? Math.min(frac, 1) : frac;
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
// ── Per-period performance (Overview's bar chart) ──────────────────────
// How each individual period actually went — deliberately NOT the score.
// completionSeries samples percentValueAt, a point-in-time reading of the
// rolling recency-weighted score; this instead measures each period on its
// own. That difference is why this one has to aggregate and that one doesn't:
// sampling a continuously-running value at any date is always valid, whereas
// a per-period figure is only meaningful for the periods it actually covers.
//
// The goal's natural period (ISO week, or calendar month for monthly goals)
// is what gets measured. When the chosen timeframe IS that period, the raw
// uncapped value is reported, so an over-target week reads above 100% — that
// is real and worth seeing. At any coarser timeframe each natural period is
// capped at 100% before averaging, so a 200% week cannot paper over a 0%
// week: the bar answers "how many of my weeks did I hold", a consistency
// figure, not a volume one. (Volume is already the Activity tab's histogram.)
// Note that an uncapped average would be arithmetically identical to
// total-achieved/total-expected, since target is constant across periods —
// capping is the only thing that distinguishes them.
function naturalUnitFor(goal) {
  return goal?.tracking?.type === 'monthly' ? 'month' : 'week';
}

// Inclusive [start, end] calendar bounds of one sampled timebox.
function timeboxBounds(unit, todayIso, periodsAgo) {
  const d = localDate(todayIso);
  if (unit === 'week') {
    const dow = (d.getDay() + 6) % 7; // Monday-based, matching isoWeekKey
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow - periodsAgo * 7);
    return [mon, new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)];
  }
  if (unit === 'month') {
    const s = new Date(d.getFullYear(), d.getMonth() - periodsAgo, 1);
    return [s, new Date(s.getFullYear(), s.getMonth() + 1, 0)];
  }
  if (unit === 'quarter') {
    const a = new Date(d.getFullYear(), d.getMonth() - periodsAgo * 3, 1);
    const qs = new Date(a.getFullYear(), Math.floor(a.getMonth() / 3) * 3, 1);
    return [qs, new Date(qs.getFullYear(), qs.getMonth() + 3, 0)];
  }
  const y = d.getFullYear() - periodsAgo;
  return [new Date(y, 0, 1), new Date(y, 11, 31)];
}

// Every natural period belonging to a timebox, keyed by a date inside it.
// A week belongs to the timebox containing its Monday, so weeks straddling a
// month/quarter boundary are counted once, never double-counted. Periods that
// haven't happened yet are excluded so an in-progress timebox isn't dragged
// down by its own future.
function naturalPeriodsIn(goal, bounds, todayIso) {
  const [start, end] = bounds;
  const today = localDate(todayIso);
  const stop = end < today ? end : today;
  const out = [];
  if (naturalUnitFor(goal) === 'month') {
    let c = new Date(start.getFullYear(), start.getMonth(), 1);
    while (c <= stop) { out.push(toIso(c)); c = new Date(c.getFullYear(), c.getMonth() + 1, 1); }
  } else {
    const dow = (start.getDay() + 6) % 7;
    let c = new Date(start.getFullYear(), start.getMonth(), start.getDate() - dow);
    if (c < start) c = new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7);
    while (c <= stop) { out.push(toIso(c)); c = new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7); }
  }
  return out;
}

export function periodPerformanceSeries(goal, unit, count, todayIso = todayISO()) {
  const aggregated = unit !== naturalUnitFor(goal);
  const points = [];
  for (let i = count - 1; i >= 0; i--) {
    const bounds = timeboxBounds(unit, todayIso, i);
    const periods = naturalPeriodsIn(goal, bounds, todayIso);
    const iso = toIso(bounds[0]);
    if (periods.length === 0) { points.push({ iso, value: undefined, aggregated }); continue; }
    const value = aggregated
      ? periods.reduce((a, p) => a + singlePeriodFraction(goal, p, todayIso, true), 0) / periods.length
      : singlePeriodFraction(goal, periods[0], todayIso, false);
    points.push({ iso, value: Math.round(value * 100), aggregated });
  }
  return points;
}

// ── Recovery curve (Overview's "expected pace" line, frequency types) ───
// What the score would read at each point if every period from the start of
// the current window onward had been played perfectly. Before that window it
// simply follows reality, so the line reads "here is where I was, and here is
// the best I could possibly be today."
//
// Deliberately computed rather than drawn as a straight ramp: the score
// weights the window's periods 6,5,4,3,2,1, so a newly-perfect period enters
// at the highest weight and decays as it ages. Recovery is therefore strongly
// front-loaded — from empty, one perfect week is worth 29 points and the
// sixth only 5 — and a straight line understates the achievable path by up to
// 21 points at the midpoint. It can also sit flat where a period was already
// at target, since making it "perfect" changes nothing.
export function recoveryCurve(goal, unit, count, todayIso = todayISO()) {
  const type = goal?.tracking?.type;
  const window = PERIOD_WINDOW[type];
  if (!window) return null;

  const nat = naturalUnitFor(goal);
  const [cutoffStart] = timeboxBounds(nat, todayIso, window - 1);
  const cutoffIso = toIso(cutoffStart);

  // A goal playing perfectly from the cutoff on: for entry-based types that
  // means target entries every period; for Avoid it means simply no further
  // slips, so the kept entries are the whole story.
  const kept = (goal.tracking.entries ?? []).filter(e => e < cutoffIso);
  const perfect = [...kept];
  if (!isDecreasing(goal)) {
    const target = goal.tracking.target || 1;
    for (let p = 0; p < window; p++) {
      const [s] = timeboxBounds(nat, todayIso, p);
      for (let n = 0; n < target; n++) {
        const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + n);
        if (toIso(d) <= todayIso) perfect.push(toIso(d));
      }
    }
  }
  const ideal = { ...goal, tracking: { ...goal.tracking, entries: [...new Set(perfect)].sort() } };

  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const iso = toIso(stepDate(unit, todayIso, i));
    out.push(iso < cutoffIso ? percentValue(goal, iso) : percentValue(ideal, iso));
  }
  return out;
}

export function successRatioSeries(goal, unit, count, todayIso = todayISO()) {
  const type = goal?.tracking?.type;
  const points = [];
  for (let i = count - 1; i >= 0; i--) {
    const iso = toIso(stepDate(unit, todayIso, i));
    let achieved, expected;
    if (type === 'percentage') {
      achieved = percentValueAt(goal, iso);
      const d = localDate(iso);
      // KNOWN ISSUE (deliberately deferred, not yet fixed): dayOfYear resets
      // every 1 January, so any chart window crossing a year boundary draws a
      // sawtooth — one cliff at month timeframe, repeating "mountains" at
      // quarter, and a useless flat line at year (every point lands on the
      // same day-of-year). Whatever replaces it, the ramp should run between
      // a real start and a real end rather than restarting annually. Options,
      // still to be decided — including which applies when, and whether they
      // combine (e.g. start at creation but end at a due date when one is set):
      //
      //   a) start of the goal's year  → end of that year
      //   b) goal creation date        → due date
      //
      // Constraints either way. (a) needs the goal's own year, which this
      // module is never given — a Telos goal belongs to exactly one year, so
      // that means threading it in from goal-dialog rather than inferring it
      // from the sampled date. (b) is harder: there is no createdAt anywhere
      // in the goal schema (see this file's HISTORY_DAYS_BACK note), so a
      // creation date would have to be added to the schema or proxied from
      // the first history snapshot — and a proxy is unreliable for goals that
      // predate tracking.history. dueDate is optional, so (b) also needs a
      // fallback for goals without one. Outside either range the line should
      // be undefined before the start and 100 after the end, never a restart.
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
