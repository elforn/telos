// Single source of truth for deadline/urgency visibility at the app's two
// scoped levels — goals (per year) and list items (per list). Lists stay a
// plain on/off toggle (listDeadlinesVisible below), but goals have a third,
// intermediate level: 'off' (nothing at all), 'warn' (icon + notifications,
// but the row can never go Failed/full-row-red), and 'full' (everything,
// matching what a single on/off toggle used to mean). 'off'/'full' behave
// exactly as the old boolean false/true did; 'warn' is the new middle
// ground — for a user who wants a heads-up system without the punishing
// red consequence. Reused by year-header.js/home-page.js/sw-extensions.js
// (which can't import this module directly — see its own duplicated copy)
// so the default resolution logic exists in exactly one place.
export const DEADLINE_LEVELS = ['off', 'warn', 'full'];

export function yearDeadlinesLevel(goalsDeadlinesVisible, year) {
  const stored = goalsDeadlinesVisible?.[String(year)];
  if (DEADLINE_LEVELS.includes(stored)) return stored;
  return Number(year) === new Date().getFullYear() ? 'full' : 'off';
}

// Unlike years, lists have no "current" to default against — they're
// trans-year and permanent — so a list's deadlines default visible
// unconditionally, archived included: forgetting an archived list still has
// a due date is worse than a little extra noise, and the user can always
// turn it off per-list if a specific archived list's stale dates bother them.
export function listDeadlinesVisible(listsDeadlinesVisible, listId) {
  return listsDeadlinesVisible?.[listId] ?? true;
}
