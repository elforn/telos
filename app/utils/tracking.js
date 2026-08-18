// The `tracking` shape (replaces flat `percentage`, migrated once at boot;
// see app/utils/migrate-goals.js). Not a strict discriminated union — every
// goal always carries all four fields:
//   { type: 'percentage' | 'weekly' | 'monthly' | 'decreasing', value: number, target: number, entries: string[] }
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
// Its `target` is repurposed as an *allowance*: free slips per week (0–6,
// default 0) that cost nothing; the fraction denominator is always 7 (days
// in a week), never scaled by the allowance. Switching an existing
// weekly/monthly goal to decreasing (or back) reinterprets `entries`'
// meaning — completions become slips or vice versa — rather than discarding
// them, the same class of tradeoff the "never drops the inactive side" rule
// above already accepts.
//
// percentValue() works identically for every type — nothing outside this
// module should read `.tracking` directly.
import { todayISO } from './today-iso.js';

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

// The row's glance strip shows more history than the score actually counts
// for monthly goals — 6 months of context vs. the 4 PERIOD_WINDOW scores —
// deliberately: seeing further back doesn't change what you're being judged
// on, it just gives more of the story. Weekly's display and scored windows
// stay equal (both were already 6). recentDots() also trims *display* only
// (see below) — neither of these affects percentValue/weightedAverage,
// which always read PERIOD_WINDOW. decreasing.DOT_WINDOW is present for
// uniformity only — goal-item renders a 6-septagon history strip instead of
// calling recentDots for this type, and that strip is always shown
// untrimmed (no display-only trim like the frequency dot-strip).
export const DOT_WINDOW = { weekly: PERIOD_WINDOW.weekly, monthly: 6, decreasing: PERIOD_WINDOW.decreasing };

// Fix-a-day's scrollable window, in calendar days — sized to reach every
// period shown in the row's own dot-strip (DOT_WINDOW), not just the ones
// still scored (PERIOD_WINDOW). For weekly/decreasing the two windows are
// equal, so this is moot; for monthly they differ on purpose (see
// DOT_WINDOW above) — backfilling a month 5-6 back won't move the score,
// but anything visible in the strip should still be tappable to fix, not
// just the portion that happens to still count. Months are approximated at
// 30 days; fix-a-day is a flat day-count strip, not period-boundary-exact —
// the score itself (via monthKey/isoWeekKey below) is the exact calendar
// math.
export const FIX_DAY_SPAN = {
  weekly: 7 * DOT_WINDOW.weekly,
  monthly: 30 * DOT_WINDOW.monthly,
  decreasing: 7 * DOT_WINDOW.decreasing,
};

export const TARGET_LIMITS = { weekly: [1, 7], monthly: [1, 31], decreasing: [0, 6] };

export function isFrequency(goal) {
  const type = goal?.tracking?.type;
  return type === 'weekly' || type === 'monthly';
}

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
function decreasingWeightedAverage(tracking, todayIso) {
  const fractions = periodFractions(tracking, todayIso); // PERIOD_WINDOW.decreasing = 6, oldest -> current
  const elapsedDaysThisWeek = ((localDate(todayIso).getDay() + 6) % 7) + 1; // Mon=1 .. Sun=7
  const allowance = tracking.target ?? 0;
  const currentCount = currentPeriodCount(tracking, todayIso);
  fractions[fractions.length - 1] = Math.max(
    0,
    1 - Math.max(0, currentCount - allowance) / Math.max(1, elapsedDaysThisWeek - allowance)
  );

  let weightedSum = 0, weightSum = 0;
  fractions.forEach((f, i) => {
    const isCurrent = i === fractions.length - 1;
    const weight = 2 ** i * (isCurrent ? elapsedDaysThisWeek / DAYS_PER_WEEK : 1); // oldest -> 2^0=1, current -> up to 2^5=32
    weightedSum += f * weight;
    weightSum += weight;
  });
  return weightSum ? weightedSum / weightSum : 0;
}

export function percentValue(goal, todayIso = todayISO()) {
  const tr = goal?.tracking;
  if (!tr) return 0;
  if (tr.type === 'percentage') return tr.value ?? 0;
  if (tr.type === 'decreasing') return Math.round(decreasingWeightedAverage(tr, todayIso) * 100);
  return Math.round(weightedAverage(tr, todayIso) * 100);
}

export function setPercent(goal, pct) {
  // Spreads the existing tracking first so a dormant target/entries (from a
  // goal that's previously been weekly/monthly) survives untouched — only
  // type and value are actually being set here.
  return { ...goal, tracking: { ...goal.tracking, type: 'percentage', value: Math.max(0, Math.min(100, pct)) } };
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
function fractionsForWindow(tracking, count, todayIso) {
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
// by that week's slips in date order against the allowance — same ranking
// logic regardless of which week. Backfilling an earlier slip via Fix-a-day
// can re-rank a later slip from 'within' to 'over' — intentional, the
// allowance is spent chronologically, not per-day. Feeds goal-item's
// septagon strip directly, mirroring how recentDots feeds the frequency
// dot-strip.
export function weekDayStates(goal, todayIso = todayISO(), weeksAgo = 0) {
  const { entries = [], target = 0 } = goal?.tracking ?? {};
  const logged = new Set(entries);
  const days = weekDates(todayIso, weeksAgo);
  let spent = 0;
  return days.map(iso => {
    let state = 'clean';
    if (logged.has(iso)) { state = spent < target ? 'within' : 'over'; spent++; }
    return { iso, state, today: iso === todayIso, future: iso > todayIso };
  });
}

// All PERIOD_WINDOW.decreasing weeks, oldest → current — drives the
// goal-item septagon history strip directly, always shown untrimmed (unlike
// recentDots' display-only trim of a leading missed streak). A week before
// the goal existed has no entries, so it naturally comes back all-'clean' (0
// slips ⇒ fraction 1.0) — correctly consistent with "a new decreasing goal
// starts at 100%", the mirror image of frequency types' "counts as missed
// before the goal existed" issue noted above, not a new problem needing its
// own placeholder state.
export function recentWeekStates(goal, todayIso = todayISO(), count = PERIOD_WINDOW.decreasing) {
  return Array.from({ length: count }, (_, i) => weekDayStates(goal, todayIso, count - 1 - i));
}
