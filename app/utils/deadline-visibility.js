// Single source of truth for whether deadline/urgency markers are visible at
// each of the app's two scoped levels — goals (per year) and list items (per
// list). Both gate the *entire* merged urgency picture when off (calendar
// icon, full-row-red, and notification-digest/Upcoming-dialog placement),
// not just the due-date component — see CLAUDE.md's Urgency section for why
// a single "less noise" toggle beats separately silencing due-date vs
// frequency-pace urgency. Reused by year-header.js/home-page.js (goals) and
// list-detail-page.js (list items) so the default resolution logic exists in
// exactly one place, instead of duplicated inline per caller.
export function yearDeadlinesVisible(goalsDeadlinesVisible, year) {
  const stored = goalsDeadlinesVisible?.[String(year)];
  return stored ?? (Number(year) === new Date().getFullYear());
}

// Unlike years, lists have no "current" to default against — they're
// trans-year and permanent — so a list's deadlines default visible
// unconditionally, archived included: forgetting an archived list still has
// a due date is worse than a little extra noise, and the user can always
// turn it off per-list if a specific archived list's stale dates bother them.
export function listDeadlinesVisible(listsDeadlinesVisible, listId) {
  return listsDeadlinesVisible?.[listId] ?? true;
}
