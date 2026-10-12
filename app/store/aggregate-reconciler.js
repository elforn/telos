// The one piece of the aggregate feature that talks to the store.
// app/utils/aggregate.js stays pure (nothing in app/utils/ imports the
// store); this module owns the "when", it owns no arithmetic.
//
// ── Why the write-back is deferred, not synchronous ──────────────────────
// The obvious shape — subscribe('goals', g => setState('goals',
// reconcileAggregates(g))) — is quietly broken. _lib/core/store/store.js's
// setState calls _notify(oldState, _state), and _notify captures newState as
// an ARGUMENT before any callback runs. A setState from inside a subscriber
// therefore runs a nested _notify that delivers the reconciled object, and
// then control returns to the OUTER loop, which carries on handing the
// pre-reconcile object to every subscriber positioned after this one. Last
// write wins in the DOM, so those components render the stale number.
//
// That is not hypothetical here: subscription order is bottom-nav (upgraded
// during main.js's import graph) -> this reconciler -> home-page (mounted
// only once router.routes is assigned at the end of main.js). home-page is
// the one that renders the goal rows, and it is after us. The symptom would
// look intermittent — an aggregate row showing its previous value until some
// unrelated write happened to come along.
//
// Deferring to a microtask steps out of the notify loop entirely, so the
// follow-up setState runs its own complete, in-order notify. A microtask
// lands before paint, so there is no visible flash. Reordering the
// subscription to be last was the other option and was rejected: it would
// depend on router mount timing, which is not something this file can see.
//
// Coalescing matters for a second reason: one user action can write `goals`
// more than once (a move across sections, an undo restore), and ten members
// changing in one action should still cost one O(V+E) pass.
import { subscribe, getState, setState } from '../../_lib/core/store/store.js';
import { reconcileAggregates } from '../utils/aggregate.js';
import { todayISO } from '../utils/today-iso.js';

let scheduled = false;

// Recompute every aggregate's value (and record today's snapshot) on the
// next microtask. Safe to call from inside a store subscriber, and safe to
// call repeatedly — extra calls collapse into the one pending pass.
export function scheduleAggregateReconcile() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    // Read fresh rather than closing over the subscriber's argument: by the
    // time this runs, another write may already have landed.
    const goals = getState().goals;
    const next = reconcileAggregates(goals, todayISO());
    // Same-reference means nothing needed changing, which is what stops this
    // from feeding itself — see reconcileAggregates' own contract.
    if (next !== goals) setState('goals', next);
  });
}

// Called once from main.js, straight after boot. subscribe() invokes its
// callback immediately with the current value, so this covers the initial
// reconcile at boot through exactly the same path as every later write —
// including the import/merge write that happens inside _lib/modules/sync/,
// which app code has no way to wrap.
export function startAggregateReconciler() {
  subscribe('goals', scheduleAggregateReconcile);
}
