// Boot migration for stored goals to the canonical shape (safe to run repeatedly):
// - description → notes (renamed 1.8.0)
// - strip dead `tracking` written by the old promote flow; ensure `percentage`
// Returns the same reference when nothing needed migrating.
export function migrateGoals(goals) {
  let changed = false;
  const migrated = Object.fromEntries(Object.entries(goals ?? {}).map(([year, yg]) => {
    const sections = Object.fromEntries(Object.entries(yg).map(([section, list]) => [
      section,
      list.map(g => {
        if (!('description' in g) && !('tracking' in g)) return g;
        changed = true;
        const { description, tracking, ...rest } = g;
        if ('description' in g) rest.notes = description || undefined;
        if ('tracking' in g && rest.percentage === undefined) rest.percentage = 0;
        return rest;
      }),
    ]));
    return [year, sections];
  }));
  return changed ? migrated : goals;
}
