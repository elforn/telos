import { describe, it, expect, beforeEach } from 'vitest';
import { boot, setState, getState, subscribe, unsubscribe } from '../../_lib/core/store/store.js';
import { startAggregateReconciler, scheduleAggregateReconcile } from '../../app/store/aggregate-reconciler.js';

function pct(id, value) {
  return { id, title: id, tags: [], tracking: { type: 'percentage', value } };
}
function agg(id, memberIds) {
  return {
    id, title: id, tags: [],
    tracking: {
      type: 'aggregate',
      members: memberIds.map(goalId => ({ year: '2026', section: 'focus', goalId })),
    },
  };
}
function store(focus) {
  return { '2026': { capstone: [], milestones: [], wow: [], focus } };
}
const tick = () => new Promise(r => queueMicrotask(r));

let dbSeq = 0;

describe('aggregate-reconciler', () => {
  beforeEach(async () => {
    await boot({ dbName: `aggregate-reconciler-${dbSeq++}`, initialState: { goals: {} } });
  });

  it('reconciles on boot, because subscribe fires its callback immediately', async () => {
    setState('goals', store([pct('a', 80), agg('x', ['a'])]));
    startAggregateReconciler();
    await tick();
    expect(getState().goals['2026'].focus[1].tracking.aggValue).toBe(80);
  });

  it('reconciles after a member’s value changes', async () => {
    setState('goals', store([pct('a', 20), agg('x', ['a'])]));
    startAggregateReconciler();
    await tick();

    const goals = getState().goals;
    setState('goals', {
      '2026': { ...goals['2026'], focus: [pct('a', 90), goals['2026'].focus[1]] },
    });
    await tick();
    expect(getState().goals['2026'].focus[1].tracking.aggValue).toBe(90);
  });

  it('delivers the RECONCILED object to subscribers registered after it', async () => {
    // The regression this file exists for. store.js's _notify captures
    // newState as an argument, so a synchronous setState from inside a
    // subscriber lets the outer loop carry on delivering the PRE-reconcile
    // object to everyone after it — and home-page, which renders the rows,
    // is after the reconciler in real subscription order.
    startAggregateReconciler();
    const seen = [];
    const later = goals => seen.push(goals?.['2026']?.focus?.[1]?.tracking?.aggValue);
    subscribe('goals', later);

    setState('goals', store([pct('a', 70), agg('x', ['a'])]));
    await tick();

    // Whatever it saw along the way, the LAST thing it saw must be correct.
    expect(seen.at(-1)).toBe(70);
    unsubscribe('goals', later);
  });

  it('does not notify again once everything is already reconciled', async () => {
    setState('goals', store([pct('a', 50), agg('x', ['a'])]));
    startAggregateReconciler();
    await tick();

    let notifications = 0;
    const count = () => { notifications++; };
    subscribe('goals', count);      // immediate call
    notifications = 0;

    scheduleAggregateReconcile();
    await tick();
    // Same reference back from reconcileAggregates means no write at all.
    expect(notifications).toBe(0);
    unsubscribe('goals', count);
  });

  it('coalesces several writes in one turn into a single reconcile pass', async () => {
    startAggregateReconciler();
    const base = store([pct('a', 10), agg('x', ['a'])]);
    setState('goals', base);
    setState('goals', { '2026': { ...base['2026'], focus: [pct('a', 20), base['2026'].focus[1]] } });
    setState('goals', { '2026': { ...base['2026'], focus: [pct('a', 30), base['2026'].focus[1]] } });

    let notifications = 0;
    const count = () => { notifications++; };
    subscribe('goals', count);
    notifications = 0;

    await tick();
    // One pass, so at most one write-back — not one per setState above.
    expect(notifications).toBeLessThanOrEqual(1);
    expect(getState().goals['2026'].focus[1].tracking.aggValue).toBe(30);
    unsubscribe('goals', count);
  });

  it('settles a three-level chain from one scheduled pass', async () => {
    setState('goals', store([
      pct('leaf', 60), agg('l3', ['leaf']), agg('l2', ['l3']), agg('l1', ['l2']),
    ]));
    startAggregateReconciler();
    await tick();
    const byId = Object.fromEntries(getState().goals['2026'].focus.map(g => [g.id, g]));
    expect(byId.l1.tracking.aggValue).toBe(60);
    expect(byId.l2.tracking.aggValue).toBe(60);
    expect(byId.l3.tracking.aggValue).toBe(60);
  });
});
