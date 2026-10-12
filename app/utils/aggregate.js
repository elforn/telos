// Aggregate goals ("Group" in the UI) — a goal whose percentage is the
// weighted mean of other goals' percentages, where a member may itself be
// another aggregate.
//
// The shape (see tracking.js for the union this belongs to):
//   { type: 'aggregate',
//     members: [{ year, section, goalId, weight? }],
//     aggValue: number,              // machine-written; what percentValue reads
//     history: [{ date, value }] }   // percentage-type's own snapshot log, reused
//
// `members` mirrors ListItem.inGoals's {year, section, goalId} reference idiom
// rather than a bare id: a goal's year and section are the outer store keys,
// so carrying them makes resolution a direct lookup instead of a walk over
// every year (there is deliberately no find-goal-by-id-across-years helper in
// this app). `weight` is omitted entirely when it is 1 — the same
// "omit rather than store the default" convention Goal.color follows — so
// every read goes through clampWeight, never `ref.weight` directly.
//
// ── Why the value is stored rather than derived on read ──────────────────
// percentValue(goal, todayIso) is pure over a single goal and has ~20 call
// sites, two of which structurally cannot see the rest of the store:
// export-markdown.js only ever receives one year's goals, and
// sw-extensions.js is a dependency-free classic script that cannot import at
// all. So the number is computed once here and parked in `aggValue`, and
// every reader stays exactly as it was. reconcileAggregates is the only
// writer; see app/main.js for the two places it runs.
//
// ── Cycles and sharing are two different problems ────────────────────────
// `seen` is per-path (a fresh Set per member), NOT shared across siblings: a
// diamond — X over A and B, both over D — is perfectly legal, and D has to
// count in both branches. A single Set threaded through sibling recursion
// would count D under A and silently skip it under B, shrinking B's weight
// sum for no reason the user could see.
//
// But per-path traversal alone re-walks every shared sub-group once per path,
// so a chain of diamonds costs 2^n visits. The fix is to keep the two
// concerns separate: `cache` memoises *values* by goal id (a goal's value is
// a pure function of the graph, never of the path that reached it), while
// `seen` stays per-path and only ever answers "would stepping here close a
// loop". Together they make a full reconcile O(V+E).
//
// A subtree that actually hit a cycle is deliberately NOT cached: its value
// was computed with a member skipped, which is true only for the path that
// reached it. Cycles are prevented at edit time by wouldCycle, so this is a
// defence against hand-edited or imported data, not a normal code path.
//
// ── One pass is enough ───────────────────────────────────────────────────
// computeAggregate RECURSES into a nested aggregate rather than reading its
// cached aggValue. That is the whole reason reconcileAggregates converges in
// a single pass: reading the cache instead would make a three-level chain lag
// one write behind and force an iterate-to-fixpoint loop. Don't "optimise"
// that recursion away.
import { percentValue, isAggregate } from './tracking.js';
import { todayISO } from './today-iso.js';

// A weight the stepper can actually reach. 9 is high enough to say "this one
// counts triple" without the chip ever needing two digits, and the stepper's
// disabled states at both ends are the only place the range is shown — hence
// one exported constant rather than a literal in the dialog.
export const AGGREGATE_WEIGHT_LIMITS = [1, 9];

// Identity of a member *reference*, not of the goal it points at — two
// different years can hold goals with the same id after an import, and a
// picker selection has to distinguish them.
export function memberKey(ref) {
  return `${ref?.year}|${ref?.section}|${ref?.goalId}`;
}

// Direct lookup, no walk. The year object also holds non-array keys, so the
// Array.isArray guard matters (same guard home-page's tag collector uses).
export function resolveMember(goals, ref) {
  const list = goals?.[ref?.year]?.[ref?.section];
  return Array.isArray(list) ? list.find(g => g?.id === ref?.goalId) : undefined;
}

// Absent → 1 (the omitted default). Anything else is forced into range:
// 0, negative, NaN and numeric strings can all arrive from a hand-edited
// import, and a weight sum of 0 would turn the mean into NaN — which would
// then flow into percentValue, the filter pills, aria-valuenow and the app
// badge before anyone noticed.
export function memberWeight(ref) {
  const [min, max] = AGGREGATE_WEIGHT_LIMITS;
  const raw = ref?.weight;
  if (raw === undefined || raw === null) return min;
  const n = Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// Returns { value, cyclic } so the caller can decide whether the result is
// safe to memoise — see the cycle note in the module doc.
function compute(goal, goals, todayIso, seen, cache) {
  const id = goal?.id;
  if (id && cache.has(id)) return { value: cache.get(id), cyclic: false };

  const members = goal?.tracking?.members ?? [];
  const nextSeen = new Set(seen);
  if (id) nextSeen.add(id);

  let weighted = 0;
  let weightSum = 0;
  let cyclic = false;
  const counted = new Set();

  for (const ref of members) {
    const key = memberKey(ref);
    if (counted.has(key)) continue; // a duplicated ref must not count twice
    counted.add(key);

    const member = resolveMember(goals, ref);
    if (!member) continue; // deleted goal — the denominator just shrinks

    // Covers a self-reference as well as a longer loop back to an ancestor.
    if (nextSeen.has(member.id)) { cyclic = true; continue; }

    const weight = memberWeight(ref);
    let pct;
    if (isAggregate(member)) {
      const nested = compute(member, goals, todayIso, nextSeen, cache);
      pct = nested.value;
      if (nested.cyclic) cyclic = true;
    } else {
      pct = percentValue(member, todayIso);
    }
    weighted += pct * weight;
    weightSum += weight;
  }

  // Nothing resolvable yet — read as 0 rather than throwing, the same
  // "not configured yet" reading dayCountValue gives a target-less goal.
  const value = weightSum > 0 ? Math.round(weighted / weightSum) : 0;
  if (id && !cyclic) cache.set(id, value);
  return { value, cyclic };
}

// `cache` is shared across one reconcile pass; `seen` is per-path. Both are
// optional so a caller computing a single goal needs neither.
export function computeAggregate(goal, goals, todayIso = todayISO(), seen = new Set(), cache = new Map()) {
  return compute(goal, goals, todayIso, seen, cache).value;
}

// Rebuilds the store's own { [year]: { [section]: Goal[] } } shape from the
// flat { year, section, goal } list the dialogs are handed. The graph walkers
// above take the store shape because that is what every caller in the app
// has; the picker is the one place holding the flat form, so the conversion
// lives here rather than as a second traversal written against that form.
export function goalsFromEntries(entries) {
  const goals = {};
  for (const { year, section, goal } of entries ?? []) {
    const y = String(year);
    goals[y] ??= {};
    (goals[y][section] ??= []).push(goal);
  }
  return goals;
}

// Would adding `candidateRef` as a member of the goal with id `selfId` close
// a loop? True when self is the candidate, or is reachable from it. Used by
// the picker to exclude candidates rather than letting bad data in and
// relying on compute()'s defence.
export function wouldCycle(candidateRef, selfId, goals) {
  if (!selfId) return false;
  const candidate = resolveMember(goals, candidateRef);
  if (!candidate) return false;

  const stack = [candidate];
  const visited = new Set();
  while (stack.length) {
    const goal = stack.pop();
    if (!goal?.id || visited.has(goal.id)) continue;
    visited.add(goal.id);
    if (goal.id === selfId) return true;
    for (const ref of goal.tracking?.members ?? []) {
      const member = resolveMember(goals, ref);
      if (member) stack.push(member);
    }
  }
  return false;
}

// Drops references to goals that no longer exist. Deliberately NOT part of
// reconcileAggregates: a year handoff can land an aggregate whose cross-year
// members point at years the receiver simply doesn't have, and a prune on the
// write path would strip them silently and permanently, with no later write
// able to restore them. Scoped instead to the one record being opened, which
// is where list-detail-page already prunes a list item's own inGoals.
// Returns the same goal reference when there is nothing to drop.
export function pruneMembers(goal, goals) {
  const members = goal?.tracking?.members;
  if (!members?.length) return goal;
  const kept = members.filter(ref => resolveMember(goals, ref));
  if (kept.length === members.length) return goal;
  return { ...goal, tracking: { ...goal.tracking, members: kept } };
}

// Recomputes every aggregate's `aggValue`. That is the whole job — nothing
// here records a history.
//
// `aggValue` is a CACHE, not a record: it is reconstructible at any moment
// from the members, and in fact is reconstructed on every write, at boot and
// at every day change. It exists for exactly one reason — to keep
// percentValue() pure over a single goal, so its ~20 callers (including
// export-markdown.js, which only ever receives one year, and
// sw-extensions.js, which cannot import anything) need no changes at all.
//
// An earlier version also accumulated a `history` log of snapshots here, to
// back an evolution chart and an Activity calendar. Both are gone, and the
// field with them: a group's value at any past date is fully DERIVABLE from
// its members (see aggregateValueAt in goal-analytics.js — asOf trims a
// member's entries, and every type's own percentValueAt is honest at a past
// date), so storing a record of it was redundant. Worse, it was a record of
// a derived number: once written it could never be corrected or
// reconstructed, and it forced an unanswerable question about what a lit
// Activity day meant — a group's score moves as periods roll and allowances
// refill, so it can never mean "you did something".
//
// Returns the SAME REFERENCE when nothing needed changing — migrateGoals'
// contract, and the reason the subscriber in main.js can write the result
// back without looping: a second pass over already-reconciled goals is a
// no-op.
//
// Every value is computed against the goals object as passed in, so one pass
// is one consistent reading of the whole graph.
export function reconcileAggregates(goals, todayIso = todayISO()) {
  if (!goals) return goals;
  const cache = new Map();
  let changed = false;
  const nextYears = {};

  for (const [year, sections] of Object.entries(goals)) {
    if (!sections || typeof sections !== 'object') { nextYears[year] = sections; continue; }
    let yearChanged = false;
    const nextSections = {};

    for (const [section, list] of Object.entries(sections)) {
      if (!Array.isArray(list)) { nextSections[section] = list; continue; }
      let listChanged = false;

      const nextList = list.map(goal => {
        if (!isAggregate(goal)) return goal;
        const value = computeAggregate(goal, goals, todayIso, new Set(), cache);
        const tracking = goal.tracking;
        if (tracking.aggValue === value) return goal;
        listChanged = true;
        return { ...goal, tracking: { ...tracking, aggValue: value } };
      });

      nextSections[section] = listChanged ? nextList : list;
      if (listChanged) yearChanged = true;
    }

    nextYears[year] = yearChanged ? nextSections : sections;
    if (yearChanged) changed = true;
  }

  return changed ? nextYears : goals;
}
