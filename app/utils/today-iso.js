// Local calendar date as YYYY-MM-DD — not toISOString(), which is UTC and can
// land on the wrong day relative to the user's local "today" near midnight.
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
