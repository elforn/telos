// Deadline / due-date urgency model — shared by goals and list items.
// Pure and DOM-free so it can be unit-tested in Node.
//
// A `dueDate` is a local calendar `YYYY-MM-DD` string (see today-iso.js). Buckets
// are ordered least → most urgent; the index in URGENCY_ORDER is the rank used to
// aggregate a set of items to their single most-urgent state.
import { todayISO } from './today-iso.js';

export const WEEK_DAYS = 7;   // 1–7 days out → "this week" (yellow)
export const MONTH_DAYS = 30; // 8–30 days out → "this month" (green)

// Least → most urgent. Index === rank.
export const URGENCY_ORDER = ['none', 'far', 'month', 'week', 'today', 'overdue'];

// Whole days from local today until `iso` (negative if in the past). Parses the
// date parts manually — `new Date('2026-07-28')` is UTC midnight and can land on
// the wrong local day.
export function daysUntil(iso) {
  const [ty, tm, td] = todayISO().split('-').map(Number);
  const [dy, dm, dd] = iso.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  const due = new Date(dy, dm - 1, dd);
  return Math.round((due - today) / 86400000);
}

// The urgency bucket for a due date. `active` gates the whole thing off — an
// inactive (done/closed/completed/archived) or date-less item is always 'none'.
export function urgencyOf(dueDate, active) {
  if (!dueDate || !active) return 'none';
  const today = todayISO();
  if (dueDate < today) return 'overdue'; // lexical compare == chronological for YYYY-MM-DD
  if (dueDate === today) return 'today';
  const days = daysUntil(dueDate);
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
