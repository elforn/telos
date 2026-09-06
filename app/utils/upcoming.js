// Aggregates goals (every year) and list items (every list, including
// archived ones) into the Overdue/Today/Tomorrow buckets the Upcoming dialog
// and bottom-nav badge both read. Pure and store-agnostic — callers pass in
// whatever slice of state they have (see bottom-nav.js). A goal's placement
// merges two independent urgency sources — its plain dueDate countdown and
// its own frequency pace (see frequency-urgency.js) — to whichever is
// worse, exactly mirroring goal-item's own row icon so a goal's Upcoming
// placement always matches what its row is showing.
import { urgencyOf, mostUrgent, daysUntil } from './urgency.js';
import { percentValue } from './tracking.js';
import { frequencyUrgencyOf, frequencyMissedDetail } from './frequency-urgency.js';
import { yearDeadlinesVisible, listDeadlinesVisible } from './deadline-visibility.js';

const GOAL_SECTIONS = ['capstone', 'milestones', 'wow', 'focus'];

// entry.detail is optional descriptive commentary for the dialog row —
// never affects bucket placement, purely "why": a plain dueDate overdue
// gets how many days past due; a frequency-driven overdue/tomorrow-with-
// shortfall gets frequencyMissedDetail's own count-or-days shape (see that
// function for the two forms). Deadline wins when both would apply — a
// goal with an overdue dueDate is showing that as the more legible reason,
// even if it's also behind on pace; only reaches for the frequency detail
// once the dueDate itself isn't the overdue one.
function goalDetail(goal, active) {
  if (urgencyOf(goal.dueDate, active) === 'overdue') {
    return { kind: 'overdue', days: -daysUntil(goal.dueDate) };
  }
  return frequencyMissedDetail(goal, active);
}

// List items have no frequency tracking at all (only goals track
// progress) — a plain dueDate overdue is the only detail that can ever apply.
function itemDetail(item, active) {
  return urgencyOf(item.dueDate, active) === 'overdue'
    ? { kind: 'overdue', days: -daysUntil(item.dueDate) }
    : null;
}

// Archived goals are excluded, matching the existing rule that urgency
// badges only ever show for `!archived` goals. Archived lists are NOT
// excluded — a due date stays meaningful regardless of whether the list
// itself has been tucked away (see CLAUDE.md's Upcoming-view scope note).
//
// 'tomorrow' is now a first-class bucket value in its own right (see
// urgency.js/frequency-urgency.js), not a separate flag layered on top of
// 'week' — so placement is a single mostUrgent()+bucket check for goals and
// items alike, the same shape as the overdue/today branches right next to
// it, rather than the old OR-of-two-different-tomorrow-signals it used to
// take to detect the same thing.
//
// goalsDeadlinesVisible/listsDeadlinesVisible gate a whole year's goals or a
// whole list's items out of this aggregation entirely when hidden — the
// same "hides visuals AND notifications together" rule goal-item.js/
// list-item.js apply to their own row markers, so a year/list you've
// silenced in-app doesn't keep nagging you in the notification digest
// either (see deadline-visibility.js).
export function collectUpcoming({ goals, lists, goalsDeadlinesVisible, listsDeadlinesVisible } = {}) {
  const overdue = [];
  const today = [];
  const tomorrow = [];

  for (const [year, yg] of Object.entries(goals ?? {})) {
    if (!yearDeadlinesVisible(goalsDeadlinesVisible, year)) continue;
    for (const section of GOAL_SECTIONS) {
      for (const goal of yg?.[section] ?? []) {
        if (goal.archived) continue;
        const active = percentValue(goal) < 100;
        const entry = { kind: 'goal', id: goal.id, title: goal.title, year, section };
        const detail = goalDetail(goal, active);
        if (detail) entry.detail = detail;
        const bucket = mostUrgent([urgencyOf(goal.dueDate, active), frequencyUrgencyOf(goal, active)]);
        if (bucket === 'overdue') overdue.push(entry);
        else if (bucket === 'today') today.push(entry);
        else if (bucket === 'tomorrow') tomorrow.push(entry);
      }
    }
  }

  for (const list of lists ?? []) {
    if (!listDeadlinesVisible(listsDeadlinesVisible, list.id)) continue;
    for (const item of list.items ?? []) {
      const active = item.status !== 'done' && item.status !== 'closed';
      const entry = { kind: 'item', id: item.id, title: item.title, listId: list.id, listName: list.name };
      const detail = itemDetail(item, active);
      if (detail) entry.detail = detail;
      const bucket = urgencyOf(item.dueDate, active);
      if (bucket === 'overdue') overdue.push(entry);
      else if (bucket === 'today') today.push(entry);
      else if (bucket === 'tomorrow') tomorrow.push(entry);
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

// The exact inverse of collectUpcoming's own gating — only years/lists whose
// deadlines are currently *hidden*, and only their overdue/today items (no
// 'tomorrow' tier, and no entry.detail commentary): these are deliberately
// second-class, a quiet "here's what you're not seeing" list, not a parallel
// Upcoming view. Reachable only from a link inside <upcoming-dialog> — see
// hidden-items-dialog.js — never a notification trigger on its own (see
// buildDigest's own doc in notification-digest.js).
export function collectHiddenUrgent({ goals, lists, goalsDeadlinesVisible, listsDeadlinesVisible } = {}) {
  const hidden = [];

  for (const [year, yg] of Object.entries(goals ?? {})) {
    if (yearDeadlinesVisible(goalsDeadlinesVisible, year)) continue;
    for (const section of GOAL_SECTIONS) {
      for (const goal of yg?.[section] ?? []) {
        if (goal.archived) continue;
        const active = percentValue(goal) < 100;
        const bucket = mostUrgent([urgencyOf(goal.dueDate, active), frequencyUrgencyOf(goal, active)]);
        if (bucket === 'overdue' || bucket === 'today') {
          hidden.push({ kind: 'goal', id: goal.id, title: goal.title, year, section });
        }
      }
    }
  }

  for (const list of lists ?? []) {
    if (listDeadlinesVisible(listsDeadlinesVisible, list.id)) continue;
    for (const item of list.items ?? []) {
      const active = item.status !== 'done' && item.status !== 'closed';
      const bucket = urgencyOf(item.dueDate, active);
      if (bucket === 'overdue' || bucket === 'today') {
        hidden.push({ kind: 'item', id: item.id, title: item.title, listId: list.id, listName: list.name });
      }
    }
  }

  return hidden;
}
