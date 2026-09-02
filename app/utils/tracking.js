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
// Its `target` is repurposed as an *allowance*: free slips (0–6, default 0)
// that cost nothing. `allowancePeriod` ('week' | '4weeks', default 'week' —
// see DEFAULT_ALLOWANCE_PERIOD) decides how often that allowance refills:
// every week (the fraction denominator is 7, the original behaviour) or
// pooled across a rolling 4-week block (denominator 28, stricter). Switching
// an existing weekly/monthly goal to decreasing (or back) reinterprets
// `entries`' meaning — completions become slips or vice versa — rather than
// discarding them, the same class of tradeoff the "never drops the inactive
// side" rule above already accepts.
//
// percentValue() works identically for every type — nothing outside this
// module should read `.tracking` directly.
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

// Decreasing-only: how often the allowance itself refills. 'week' (default —
// every goal without this field reads as 'week', so nothing about an
// existing goal's score changes) grants `target` free slips every single
// week, exactly the original behaviour. '4weeks' pools that same `target`
// number across a rolling 4-week block instead: the budget only refills once
// the block rolls over, so it's the stricter of the two. Purely a decreasing
// setting — every other type ignores it.
export const DEFAULT_ALLOWANCE_PERIOD = 'week';
export const ALLOWANCE_PERIOD_WEEKS = { week: 1, '4weeks': 4 };

// Periods considered for the weighted average — weekly and monthly get
// separate lengths because a "period" is such a different wall-clock span
// for each (6 weeks ≈ 1.5 months vs 4 months) — a shared count would mean a
// flawless brand-new monthly goal can't reach 100% for many months (weight
// math bottoms out at current/sum-of-1..N with every period before the goal
// existed counted as missed). Decreasing shares weekly's 6-week window; its
// own recency curve (see decreasingWeightedAverage) is what actually differs.
export const PERIOD_WINDOW = { weekly: 6, monthly: 4, decreasing: 6 };

// The row's glance strip deliberately shows *less* history than the score
// actually counts (3 periods, vs. PERIOD_WINDOW's 6/4/6) — a recent-glance
// view, not a full explanation of the score, in anticipation of a future
// analytics feature that will cover the fuller history in detail. Purely
// display: recentDots()/recentWeekStates() read this, but
// percentValue/weightedAverage/decreasingWeightedAverage always read
// PERIOD_WINDOW and are completely untouched by this window shrinking.
export const DOT_WINDOW = { weekly: 3, monthly: 3, decreasing: 3 };

// Fix-a-day's scrollable window, in calendar days — deliberately independent
// of both PERIOD_WINDOW (the score) and DOT_WINDOW (the display, now much
// shorter at 3 periods) and unchanged by the DOT_WINDOW shrink above:
// showing less by default was never meant to shrink how far back an entry
// can still be corrected. Monthly specifically reaches further (6 months)
// than what's actually scored (PERIOD_WINDOW.monthly, 4 months) — by
// design, correcting an old month you're catching up on shouldn't require
// it to still be visible or still counted. Months are approximated at 30
// days; fix-a-day is a flat day-count strip, not period-boundary-exact —
// the score itself (via monthKey/isoWeekKey below) is the exact calendar
// math.
export const FIX_DAY_SPAN = { weekly: 42, monthly: 180, decreasing: 42 };

// Decreasing's max allowance scales with allowancePeriod — capped one day
// below the full block (6 of 7 days for 'week', 27 of 28 for '4weeks') so
// at least one day in the block can still cost something; a max equal to
// the full block would make every day free, i.e. stop tracking anything.
export const TARGET_LIMITS = {
  weekly: [1, 7],
  monthly: [1, 31],
  decreasing: { week: [0, 6], '4weeks': [0, 27] },
};

// The single place that resolves a type (+ allowancePeriod, for decreasing)
// down to a concrete [min, max] pair — every caller (the stepper's clamp,
// its disabled states) goes through this rather than indexing TARGET_LIMITS
// directly, since decreasing's entry isn't a plain array like the others.
export function targetLimitsFor(type, allowancePeriod = DEFAULT_ALLOWANCE_PERIOD) {
  return type === 'decreasing' ? TARGET_LIMITS.decreasing[allowancePeriod] : TARGET_LIMITS[type];
}

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
//
// `allowancePeriod` generalizes the same shape rather than changing it: each
// week's fraction judges the *cumulative* count since its allowance block
// started against the days elapsed in that block, instead of always judging
// just that single week against 7 days. A block of 1 week (allowancePeriod
// 'week', the default) makes every week its own block start, so
// weeksIntoBlock is always 0 and this collapses to exactly the original
// per-week formula above — no behavior change for any goal that predates
// this setting or never touches it. A block of 4 weeks ('4weeks') instead
// carries a week's unspent (or overspent) allowance into the next week of
// the same block, only resetting once the block rolls over — the two
// corrections above still apply to whichever week is current, just measured
// against the block's elapsed days rather than the week's.
function decreasingWeightedAverage(tracking, todayIso) {
  const blockWeeks = ALLOWANCE_PERIOD_WEEKS[tracking.allowancePeriod ?? DEFAULT_ALLOWANCE_PERIOD];
  const weekKeys = recentPeriods('decreasing', PERIOD_WINDOW.decreasing, todayIso); // oldest -> current
  const counts = countByPeriod(tracking.entries, 'decreasing');
  const allowance = tracking.target ?? 0;
  const elapsedDaysThisWeek = ((localDate(todayIso).getDay() + 6) % 7) + 1; // Mon=1 .. Sun=7

  const fractions = weekKeys.map((_, i) => {
    const weeksAgo = weekKeys.length - 1 - i; // 0 = current
    const weeksIntoBlock = blockWeeks - 1 - (weeksAgo % blockWeeks); // 0 = this week starts a fresh block
    let cumulative = 0;
    for (let b = 0; b <= weeksIntoBlock; b++) {
      const idx = i - b;
      if (idx < 0) break; // block start predates the scored window — treated as clean, same as "goal didn't exist yet"
      cumulative += counts.get(weekKeys[idx]) ?? 0;
    }
    const isCurrent = i === weekKeys.length - 1;
    const daysIntoBlock = 7 * weeksIntoBlock + (isCurrent ? elapsedDaysThisWeek : 7);
    return Math.max(0, 1 - Math.max(0, cumulative - allowance) / Math.max(1, daysIntoBlock - allowance));
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

// How much of the allowance a 4-week block has already spent in the weeks
// *before* `weeksAgo`, so weekDayStates can seed its own chronological
// ranking already part-way through the budget instead of starting every
// week fresh — the septagon-viz counterpart to decreasingWeightedAverage's
// cumulative block math above. 'week' mode (blockWeeks 1) always returns 0:
// every week is its own block, so this is a no-op and weekDayStates behaves
// exactly as it did before allowancePeriod existed.
function blockCarrySpent(tracking, todayIso, weeksAgo) {
  const blockWeeks = ALLOWANCE_PERIOD_WEEKS[tracking.allowancePeriod ?? DEFAULT_ALLOWANCE_PERIOD];
  if (blockWeeks === 1) return 0;
  const weeksIntoBlock = blockWeeks - 1 - (weeksAgo % blockWeeks); // 0 = this week starts a fresh block
  if (weeksIntoBlock === 0) return 0;
  const logged = new Set(tracking.entries ?? []);
  let count = 0;
  for (let d = 1; d <= weeksIntoBlock; d++) {
    for (const iso of weekDates(todayIso, weeksAgo + d)) {
      if (logged.has(iso)) count++;
    }
  }
  return count;
}

// Day-states for the week `weeksAgo` weeks before the week containing
// `todayIso` (0 = current). Each day is 'clean' | 'within' | 'over', ranked
// in date order against the allowance — chronologically *within the whole
// allowance block* (see blockCarrySpent), not reset at every week boundary,
// so a 4-week allowancePeriod visibly shows the pooled budget running out
// partway through the block rather than every week looking freshly funded.
// 'week' mode keeps the original per-week ranking (blockCarrySpent is a
// no-op there). Backfilling an earlier slip via Fix-a-day can re-rank a
// later slip — anywhere in the same block, not just the same week — from
// 'within' to 'over': intentional, the allowance is spent chronologically,
// not per-day. Feeds goal-item's septagon strip directly, mirroring how
// recentDots feeds the frequency dot-strip.
export function weekDayStates(goal, todayIso = todayISO(), weeksAgo = 0) {
  const tracking = goal?.tracking ?? {};
  const { entries = [], target = 0 } = tracking;
  const logged = new Set(entries);
  const days = weekDates(todayIso, weeksAgo);
  let spent = blockCarrySpent(tracking, todayIso, weeksAgo);
  return days.map(iso => {
    let state = 'clean';
    if (logged.has(iso)) { state = spent < target ? 'within' : 'over'; spent++; }
    return { iso, state, today: iso === todayIso, future: iso > todayIso };
  });
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
