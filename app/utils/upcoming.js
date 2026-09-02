// Aggregates goals (every year) and list items (every list, including
// archived ones) into the Overdue/Today/Tomorrow buckets the Upcoming dialog
// and bottom-nav badge both read. Pure and store-agnostic — callers pass in
// whatever slice of state they have (see bottom-nav.js). A goal's placement
// merges two independent urgency sources — its plain dueDate countdown and
// its own frequency pace (see frequency-urgency.js) — to whichever is
// worse, exactly mirroring goal-item's own row icon so a goal's Upcoming
// placement always matches what its row is showing.
import { urgencyOf, daysUntil, mostUrgent } from './urgency.js';
import { percentValue } from './tracking.js';
import { frequencyUrgency } from './frequency-urgency.js';

const GOAL_SECTIONS = ['capstone', 'milestones', 'wow', 'focus'];

// Exactly one day out — urgencyOf() folds this into the broader 'week'
// bucket (1-7 days), so it isn't distinguishable from its return value alone.
function isTomorrow(dueDate) {
  return !!dueDate && daysUntil(dueDate) === 1;
}

// Archived goals are excluded, matching the existing rule that urgency
// badges only ever show for `!archived` goals. Archived lists are NOT
// excluded — a due date stays meaningful regardless of whether the list
// itself has been tucked away (see CLAUDE.md's Upcoming-view scope note).
export function collectUpcoming({ goals, lists } = {}) {
  const overdue = [];
  const today = [];
  const tomorrow = [];

  for (const [year, yg] of Object.entries(goals ?? {})) {
    for (const section of GOAL_SECTIONS) {
      for (const goal of yg?.[section] ?? []) {
        if (goal.archived) continue;
        const active = percentValue(goal) < 100;
        const entry = { kind: 'goal', id: goal.id, title: goal.title, year, section };
        const freq = frequencyUrgency(goal, active);
        const bucket = mostUrgent([urgencyOf(goal.dueDate, active), freq.bucket]);
        if (bucket === 'overdue') overdue.push(entry);
        else if (bucket === 'today') today.push(entry);
        else if (active && (isTomorrow(goal.dueDate) || freq.tomorrow)) tomorrow.push(entry);
      }
    }
  }

  for (const list of lists ?? []) {
    for (const item of list.items ?? []) {
      const active = item.status !== 'done' && item.status !== 'closed';
      const entry = { kind: 'item', id: item.id, title: item.title, listId: list.id, listName: list.name };
      const bucket = urgencyOf(item.dueDate, active);
      if (bucket === 'overdue') overdue.push(entry);
      else if (bucket === 'today') today.push(entry);
      else if (active && isTomorrow(item.dueDate)) tomorrow.push(entry);
    }
  }

  return { overdue, today, tomorrow };
}

// The bottom-nav badge count: overdue + today only — tomorrow is
// deliberately excluded from the number even though tomorrow's items still
// appear in the dialog itself. Overdue and Today never share an item (each
// item/goal resolves to exactly one bucket via urgencyOf), so this is a
// plain sum, no dedup needed.
export function upcomingBadgeCount({ overdue, today }) {
  return (overdue?.length ?? 0) + (today?.length ?? 0);
}
