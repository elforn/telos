// The `tracking` union — canonical goal progress shape (replaces flat
// `percentage`, migrated once at boot; see app/utils/migrate-goals.js):
//   { type: 'percentage', value: number }                            — 0–100
//   { type: 'weekly'|'monthly', target: number, entries: string[] }  — entries
//     are unique ISO calendar dates (YYYY-MM-DD), one per day max, past dates
//     allowed. "Every day" is a UI preset for weekly target=7, not its own type.
//
// percentValue() works identically for all three types — nothing outside this
// module should read `.tracking` directly.
import { todayISO } from './today-iso.js';

// Periods considered for the weighted average AND the row's glance strip (dot
// count = PERIOD_WINDOW[type] - 1 history + 1 current) — one shared window so
// the math and the UI never quietly drift apart. Weekly and monthly get
// separate lengths because a "period" is such a different wall-clock span
// for each (6 weeks ≈ 1.5 months vs 4 months) — a shared count would mean a
// flawless brand-new monthly goal can't reach 100% for many months (weight
// math bottoms out at current/sum-of-1..N with every period before the goal
// existed counted as missed).
export const PERIOD_WINDOW = { weekly: 6, monthly: 4 };

// Fix-a-day's scrollable window, in calendar days — sized to actually reach
// every period the score above can still be influenced by. Past this many
// days back, backfilling an entry wouldn't move the displayed percentage, so
// there's no reason to scroll further. Months are approximated at 30 days;
// fix-a-day is a flat day-count strip, not period-boundary-exact — the score
// itself (via monthKey/isoWeekKey below) is the exact calendar math.
export const FIX_DAY_SPAN = { weekly: 7 * PERIOD_WINDOW.weekly, monthly: 30 * PERIOD_WINDOW.monthly };

export const TARGET_LIMITS = { weekly: [1, 7], monthly: [1, 31] };

export function isFrequency(goal) {
  const type = goal?.tracking?.type;
  return type === 'weekly' || type === 'monthly';
}

export function percentValue(goal, todayIso = todayISO()) {
  const tr = goal?.tracking;
  if (!tr) return 0;
  if (tr.type === 'percentage') return tr.value ?? 0;
  return Math.round(weightedAverage(tr, todayIso) * 100);
}

export function setPercent(goal, pct) {
  return { ...goal, tracking: { type: 'percentage', value: Math.max(0, Math.min(100, pct)) } };
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
  return type === 'weekly' ? isoWeekKey(iso) : monthKey(iso);
}

// The last `count` period keys ending with the period containing `todayIso`,
// oldest first — the shared window the dot-strip and the weighted average
// both walk.
export function recentPeriods(type, count = PERIOD_WINDOW[type], todayIso = todayISO()) {
  const today = localDate(todayIso);
  const keys = [];
  for (let i = count - 1; i >= 0; i--) {
    if (type === 'weekly') {
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

// Fraction of target met (0–1, capped) for each period in the window, oldest
// first — the last entry is always the current (possibly still-open) period.
export function periodFractions(tracking, todayIso = todayISO()) {
  const { type, target, entries } = tracking;
  const counts = countByPeriod(entries, type);
  return recentPeriods(type, PERIOD_WINDOW[type], todayIso).map(key => Math.min((counts.get(key) ?? 0) / target, 1));
}

// Raw (uncapped) entry count for the period containing `todayIso` — the
// number a status line reads out ("2 of 3 this week"), as opposed to
// periodFractions' capped 0–1 used for math/rendering.
export function currentPeriodCount(tracking, todayIso = todayISO()) {
  const { type, entries } = tracking;
  const counts = countByPeriod(entries, type);
  return counts.get(periodKey(todayIso, type)) ?? 0;
}

// UI-facing: classify each period in the window, with the last one flagged
// `current` (still open, not a closed period yet) — feeds goal-item's dot-strip
// directly so the component never touches date math itself.
export function recentDots(goal, todayIso = todayISO()) {
  const fractions = periodFractions(goal.tracking, todayIso);
  return fractions.map((fraction, i) => ({
    fraction,
    state: fraction >= 1 ? 'met' : fraction > 0 ? 'partial' : 'missed',
    current: i === fractions.length - 1,
  }));
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
