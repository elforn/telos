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

// ── As-of ────────────────────────────────────────────────────────────────
// The same goal with anything logged after `iso` removed. percentValue's
// todayIso parameter moves the scoring *window* to that date but still reads
// the whole entries array, so a period gets credited (or charged) with days
// that had not happened yet at the date being asked about. Live callers pass
// the real today and never notice — no entry can be in the future. Sampling
// the past is where it shows, and where it is wrong in both directions:
// frequency types look better than they were (later entries counted early),
// and Avoid looks dramatically worse, because a slip charged to an earlier
// date is divided by only the days elapsed by then. A week with one
// over-allowance slip on Thursday read 69% on the Monday before it, when
// nothing had happened at all and the true figure was 100%.
//
// Returns the goal unchanged when nothing needs dropping, so the common case
// allocates nothing.
function asOf(goal, iso) {
  const entries = goal?.tracking?.entries;
  if (!entries?.length) return goal;
  const kept = entries.filter(e => e <= iso);
  return kept.length === entries.length ? goal : { ...goal, tracking: { ...goal.tracking, entries: kept } };
}

// ── percentValueAt ───────────────────────────────────────────────────────
// A goal's percentValue as of a past (or present) date — a genuine
// point-in-time reading, with no knowledge of what happened later (see
// asOf). Percentage-type reads its own snapshot log instead, the gap
// tracking.history closes. Returns undefined — not 0 — when no snapshot
// predates `iso` at all, so callers can tell "not enough history yet" apart
// from a real 0%.
export function percentValueAt(goal, iso) {
  if (goal?.tracking?.type !== 'percentage') return percentValue(asOf(goal, iso), iso);
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

// ── Avoid: per-slip allowance classification ─────────────────────────────
// Which of an Avoid goal's slips were forgiven ('within' the allowance) and
// which were real fails ('over'), as a Map iso -> state. Reuses
// weekDayStates' own chronological, block-aware allowance accounting — the
// same source the septagon strip and decreasingOnTrackDates already read —
// rather than re-ranking entries here, so every Avoid visual (score
// septagons, the count histogram, the weekday grid) agrees on which slips
// were forgiven. Empty for every other type: only decreasing has an
// allowance for a slip to sit inside or outside of.
export function slipStates(goal, todayIso = todayISO(), daysBack = 180) {
  const out = new Map();
  if (!isDecreasing(goal)) return out;
  const weeksNeeded = Math.ceil(daysBack / 7) + 1;
  for (let w = weeksNeeded - 1; w >= 0; w--) {
    for (const day of weekDayStates(goal, todayIso, w)) {
      if (day.future || day.state === 'clean') continue;
      if (daysBetween(day.iso, todayIso) <= daysBack) out.set(day.iso, day.state);
    }
  }
  return out;
}

// Convenience split of the above into two plain date arrays, in the shape
// the count histogram's own bucketing (countByBucket) already takes.
export function slipDatesByState(goal, todayIso = todayISO(), daysBack = 180) {
  const within = [], over = [];
  for (const [iso, state] of slipStates(goal, todayIso, daysBack)) {
    (state === 'over' ? over : within).push(iso);
  }
  return { within: within.sort(), over: over.sort() };
}

// ── First real entry ─────────────────────────────────────────────────────
// The earliest date this goal has any record of — its first logged entry for
// entry-based types, its first recorded percentage for percentage-type.
// undefined when nothing has ever been recorded. There is no createdAt in
// the goal schema, so this is the closest thing to "when did this start"
// that is a real user event rather than an assumption (the same reasoning
// expectedRampSeries already anchors on).
export function firstRecordIso(goal) {
  if (goal?.tracking?.type === 'percentage') return percentHistory(goal)[0]?.date;
  const entries = goal?.tracking?.entries ?? [];
  return entries.length === 0 ? undefined : entries.reduce((a, b) => (a < b ? a : b));
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

// A single logged day is a run of one, which computeStreaks reports
// faithfully — but it isn't a streak, and listing rows of "1d" buries the
// real ones. The floor is applied here rather than in computeStreaks so that
// function stays an honest primitive: callers that want every run, including
// the ones of length 1, still get them.
export const MIN_STREAK_DAYS = 2;

// Top-N longest, then re-sorted most-recent-first for display — selecting
// by length and displaying by date are two different orderings, so a
// 4-day streak can sit above an 11-day one if it happened more recently.
// Filtered before selecting, not after, so single days can't consume slots
// that genuine streaks would otherwise fill.
export function topStreaks(dates, n = 10) {
  return computeStreaks(dates)
    .filter(s => s.length >= MIN_STREAK_DAYS)
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

// ── Sample dates ─────────────────────────────────────────────────────────
// The x-axis of any time series here: `count` periods of `unit`, ending at
// todayIso. `periodSamples` puts one point at each period boundary — the
// right resolution for a compact sparkline or a slope estimate.
//
// `denseSamples` covers the same span at a much finer step, and is what the
// Progress chart plots. Period-resolution sampling silently loses any value
// that never happened to be current on a sampling date: a percentage goal
// set to 10% on 1 May and 100% on 14 May has no monthly sample inside that
// window at all, so its line drew a flat 100 from May onward and the 10%
// leg vanished entirely. Sampling by day makes the same series a real step
// function — 10% held from 1 to 14 May, then a jump. Capped at maxPoints so
// a multi-year span doesn't turn into thousands of path segments; the step
// stays uniform (and anchored on today) so x position stays linear in time,
// which is what lets a step land on the right date.
export function periodSamples(unit, count, todayIso = todayISO()) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(toIso(stepDate(unit, todayIso, i)));
  return out;
}

export function denseSamples(unit, count, todayIso = todayISO(), maxPoints = 140) {
  const startIso = toIso(stepDate(unit, todayIso, count - 1));
  const span = daysBetween(startIso, todayIso);
  const step = Math.max(1, Math.ceil(span / maxPoints));
  const out = [];
  const d = localDate(todayIso);
  for (let back = Math.floor(span / step) * step; back >= 0; back -= step) {
    out.push(toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back)));
  }
  return out;
}

// ── Completion-% series (Progress chart, "achieved" line) ───────────────
// One point per sampled date, oldest first. Points with value === undefined
// (percentage-type, before any snapshot existed) are left in — the chart is
// expected to skip drawing them, not fabricate 0.
export function completionSeriesAt(goal, isos) {
  return isos.map(iso => ({ iso, value: percentValueAt(goal, iso) }));
}

export function completionSeries(goal, unit, count, todayIso = todayISO()) {
  return completionSeriesAt(goal, periodSamples(unit, count, todayIso));
}

// A single period's raw achieved fraction (0-1), independent of the
// weighted-average score — e.g. "3 of 3 runs that specific week", not the
// recency-weighted score across several weeks. Only meaningful for
// weekly/monthly/decreasing; percentage/countdown are handled directly in
// the ramp/recovery curves below, since they have no per-period target.
function singlePeriodFraction(goal, iso, todayIso, cap = true) {
  const tr = goal?.tracking ?? {}; // a never-migrated goal has none — see percentValue
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
// The period a goal is actually measured in — the single source for it. Only
// monthly goals run on calendar months; every other type (including Avoid,
// whose allowance refills weekly) is scored Mon-Sun. Exported because the
// component needs the same answer for its chart defaults and axis labels, and
// three separate copies of this one-liner had already drifted into existence
// under three names.
export function naturalUnitFor(goal) {
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

// ── Expected ramp (Overview's expected-pace line, percentage goals) ─────
// A straight line from the goal's first recorded percentage to 100% at its
// end date. Nothing is drawn before that first snapshot, and nothing at all
// if none exists yet — an expectation needs a real starting point, and
// inventing one is what made the old day-of-year formula wrong (it assumed
// every goal had been running since 1 January, so a goal started in
// February looked behind from the moment it was created, and the line
// sawtoothed whenever the chart window crossed a year boundary).
//
// Anchoring on the first snapshot rather than a creation date is deliberate:
// there is no createdAt in the goal schema, and the first recorded value is
// a real event the user performed — "I was at X% on this date" — rather than
// a proxy for one. It also fixes the start value for free: the ramp begins at
// whatever was actually recorded, not an assumed 0%.
//
// End date is the goal's dueDate when it falls earlier, else 31 December of
// the year the goal was being worked in (inferred from that first snapshot —
// goals are year-scoped, and this module is never told which year it is
// looking at). Past the end date the line holds at 100 rather than running on.
function rampEndIso(goal, firstIso) {
  const yearEnd = `${firstIso.slice(0, 4)}-12-31`;
  const due = goal?.dueDate;
  return due && due < yearEnd ? due : yearEnd;
}

export function expectedRampSeriesAt(goal, isos) {
  const history = percentHistory(goal);
  if (history.length === 0) return null; // nothing set yet — draw no line at all
  const first = history[0];
  const endIso = rampEndIso(goal, first.date);
  const span = daysBetween(first.date, endIso);
  if (span <= 0) return null; // end already reached/passed at the first snapshot
  return isos.map(iso => {
    if (iso < first.date) return undefined;
    const elapsed = Math.min(span, daysBetween(first.date, iso));
    return Math.round(first.value + (100 - first.value) * (elapsed / span));
  });
}

export function expectedRampSeries(goal, unit, count, todayIso = todayISO()) {
  return expectedRampSeriesAt(goal, periodSamples(unit, count, todayIso));
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
export function recoveryCurveAt(goal, isos, todayIso = todayISO()) {
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

  // Only the reality half reads as-of the sampled date. The ideal half must
  // not: its synthetic entries sit on the first `target` days of each period,
  // so filtering them to the sampled date makes every Monday read 1-of-3 and
  // the line saw-tooths down at each period boundary, recovering by midweek.
  // That is a true statement about what is achievable *by Monday* — one entry
  // per calendar day is the cap — but it is the wrong statement for this
  // line, which answers "if you play every period perfectly, where does the
  // score go". You cannot be behind on the Monday of a week you are going to
  // finish, so a period that would be met counts as met from its first day
  // and the line stays the monotonic ceiling it is meant to be.
  return isos.map(iso => (iso < cutoffIso ? percentValue(asOf(goal, iso), iso) : percentValue(ideal, iso)));
}

export function recoveryCurve(goal, unit, count, todayIso = todayISO()) {
  return recoveryCurveAt(goal, periodSamples(unit, count, todayIso), todayIso);
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
