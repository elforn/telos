// One-time boot migration: flat `percentage` → the canonical `tracking` union
// (see app/utils/tracking.js). Idempotent — goals already carrying `tracking`
// pass through untouched, and reference-equal state is returned when nothing
// changed so boot() skips the IDB write.
export function migrateGoals(state) {
  const goals = state.goals;
  if (!goals) return state;

  let changed = false;
  const migratedGoals = {};
  for (const [year, sections] of Object.entries(goals)) {
    const migratedSections = {};
    for (const [section, list] of Object.entries(sections)) {
      migratedSections[section] = list.map(goal => {
        if (goal.tracking || goal.percentage === undefined) return goal;
        changed = true;
        const { percentage, ...rest } = goal;
        return { ...rest, tracking: { type: 'percentage', value: percentage } };
      });
    }
    migratedGoals[year] = migratedSections;
  }

  return changed ? { ...state, goals: migratedGoals } : state;
}
