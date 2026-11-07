// Deadline / due-date urgency model — shared by goals and list items.
// Pure and DOM-free so it can be unit-tested in Node.
//
// A `dueDate` is a local calendar `YYYY-MM-DD` string (see today-iso.js). Buckets
// are ordered least → most urgent; the index in URGENCY_ORDER is the rank used to
// aggregate a set of items to their single most-urgent state.
import { todayISO } from './today-iso.js';

export const WEEK_DAYS = 7;   // 2–7 days out → "this week" (yellow); 1 day out is its own "tomorrow" bucket, see below
export const MONTH_DAYS = 30; // 8–30 days out → "this month" (green)

// Least → most urgent. Index === rank. 'tomorrow' is its own status (orange),
// not a subset of 'week' — see urgencyOf below.
export const URGENCY_ORDER = ['none', 'far', 'month', 'week', 'tomorrow', 'today', 'overdue'];

// Whole days from local today until `iso` (negative if in the past). Parses the
// date parts manually — `new Date('2026-07-28')` is UTC midnight and can land on
// the wrong local day.
export function daysUntil(iso, todayIso = todayISO()) {
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [dy, dm, dd] = iso.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  const due = new Date(dy, dm - 1, dd);
  return Math.round((due - today) / 86400000);
}

// The urgency bucket for a due date. `active` gates the whole thing off — an
// inactive (done/closed/completed/archived) or date-less item is always 'none'.
//
// `todayIso` is an optional override for deterministic tests, defaulting to
// real today — the same convention percentValue and frequencyUrgencyOf
// already follow. It is not merely a convenience: goalUrgencyOf
// (frequency-urgency.js) merges this function's bucket with a pace bucket
// and threads one date into both, so without an override here the two halves
// of that merge would silently resolve against different days whenever a
// caller passed anything but real today.
export function urgencyOf(dueDate, active, todayIso = todayISO()) {
  if (!dueDate || !active) return 'none';
  if (dueDate < todayIso) return 'overdue'; // lexical compare == chronological for YYYY-MM-DD
  if (dueDate === todayIso) return 'today';
  const days = daysUntil(dueDate, todayIso);
  if (days === 1) return 'tomorrow';
  if (days <= WEEK_DAYS) return 'week';
  if (days <= MONTH_DAYS) return 'month';
  return 'far';
}

export function rank(bucket) {
  const i = URGENCY_ORDER.indexOf(bucket);
  return i === -1 ? 0 : i;
}

// The single most-urgent bucket across a list of buckets ('none' when empty).
export function mostUrgent(buckets) {
  return buckets.reduce((max, b) => (rank(b) > rank(max) ? b : max), 'none');
}

// How many buckets are genuinely urgent (due today or overdue). Drives the
// roll-up count, which only shows when this is > 0.
export function urgentCount(buckets) {
  return buckets.filter(b => b === 'today' || b === 'overdue').length;
}

// Compact badge label for a count — exact up to 99, then a bare "+" (meaning
// "more than 99") to keep the badge to at most two characters. The full number
// is still used in aria-labels.
export function formatCount(n) {
  return n > 99 ? '+' : String(n);
}

// The date-filter pill keys, in display order.
export const DATE_FILTER_KEYS = ['overdue', 'week', 'month', 'later', 'none'];

// Which date-filter key claims an ALREADY-COMPUTED urgency bucket. Split out
// from matchesDateBucket so the goal-aware variant — which merges dueDate
// urgency with frequency/pace urgency before filtering, see
// matchesGoalDateBucket in frequency-urgency.js — maps its merged bucket
// through this exact same table instead of repeating it. The mapping is a
// clean partition of URGENCY_ORDER: every bucket but 'none' is claimed by
// exactly one key, and 'today'/'tomorrow' both fold into 'week' (a pill
// labelled "Week" is understood to mean "due within the week", today
// included — there are deliberately no separate Today/Tomorrow pills).
//
// 'none' is not handled here on purpose: it is the one key that asks about
// the ABSENCE of a date rather than about a bucket, so each caller answers
// it from its own data before reaching for this.
export function bucketMatchesKey(key, bucket) {
  if (key === 'overdue') return bucket === 'overdue';
  if (key === 'week') return bucket === 'today' || bucket === 'tomorrow' || bucket === 'week';
  if (key === 'month') return bucket === 'month';
  if (key === 'later') return bucket === 'far';
  return false;
}

// Whether a `dueDate` (with its `active` state) belongs to a date-filter bucket.
// The four dated buckets reuse urgencyOf so the filter matches exactly what the
// calendar marker shows (active-only). 'none' means "no date at all", regardless
// of status — the "what haven't I dated?" case.
//
// This is the LIST-ITEM form: items carry nothing but a dueDate, so it is
// complete for them. Goals have a second urgency source (frequency/pace) that
// this signature structurally cannot see — it takes no goal — so goals must go
// through matchesGoalDateBucket instead (frequency-urgency.js). Keeping items on
// this leaner function is deliberate: it lets urgency.js stay free of any
// tracking.js dependency, which list-item.js's import chain relies on.
export function matchesDateBucket(key, dueDate, active, todayIso = todayISO()) {
  if (key === 'none') return !dueDate;
  return bucketMatchesKey(key, urgencyOf(dueDate, active, todayIso));
}
