import { describe, it, expect } from 'vitest';
import {
  AGGREGATE_WEIGHT_LIMITS, memberKey, memberWeight, resolveMember, computeAggregate,
  reconcileAggregates, pruneMembers, wouldCycle, goalsFromEntries,
} from '../../app/utils/aggregate.js';

const TODAY = '2026-10-11';

function pct(id, value) {
  return { id, title: id, tags: [], tracking: { type: 'percentage', value } };
}
function agg(id, members, extra = {}) {
  return { id, title: id, tags: [], tracking: { type: 'aggregate', members, ...extra } };
}
function ref(goalId, weight, year = '2026', section = 'focus') {
  return weight === undefined ? { year, section, goalId } : { year, section, goalId, weight };
}
// One year, everything in `focus` unless a test places it elsewhere.
function store(focus, rest = {}) {
  return { '2026': { capstone: [], milestones: [], wow: [], focus, ...rest } };
}

describe('memberKey / resolveMember', () => {
  it('keys a reference by year, section and goal id together', () => {
    expect(memberKey({ year: '2026', section: 'focus', goalId: 'a' })).toBe('2026|focus|a');
  });

  it('resolves through the year and section keys directly', () => {
    const goals = store([pct('a', 40)]);
    expect(resolveMember(goals, ref('a')).id).toBe('a');
  });

  it('returns undefined for a missing year, section or goal', () => {
    const goals = store([pct('a', 40)]);
    expect(resolveMember(goals, ref('a', undefined, '2030'))).toBeUndefined();
    expect(resolveMember(goals, ref('a', undefined, '2026', 'capstone'))).toBeUndefined();
    expect(resolveMember(goals, ref('nope'))).toBeUndefined();
  });

  it('survives a non-array value sitting on a year key', () => {
    // Year objects are not guaranteed to hold only section arrays.
    const goals = { '2026': { focus: [pct('a', 40)], somethingElse: 'not an array' } };
    expect(resolveMember(goals, ref('a', undefined, '2026', 'somethingElse'))).toBeUndefined();
  });
});

describe('computeAggregate — the weighted mean', () => {
  it('reads a single member with an omitted weight as that member', () => {
    const goals = store([pct('a', 42), agg('x', [ref('a')])]);
    expect(computeAggregate(agg('x', [ref('a')]), goals, TODAY)).toBe(42);
  });

  it('weights members and rounds the result', () => {
    // 100x1 + 42x3 + 0x2 = 226 over a weight sum of 6 = 37.67 -> 38
    const goals = store([pct('a', 100), pct('b', 42), pct('c', 0)]);
    const x = agg('x', [ref('a'), ref('b', 3), ref('c', 2)]);
    expect(computeAggregate(x, goals, TODAY)).toBe(38);
  });

  it('treats an omitted weight as exactly 1, matching a stored 1', () => {
    const goals = store([pct('a', 80), pct('b', 20)]);
    const omitted = agg('x', [ref('a'), ref('b')]);
    const explicit = agg('x', [ref('a', 1), ref('b', 1)]);
    expect(computeAggregate(omitted, goals, TODAY)).toBe(50);
    expect(computeAggregate(explicit, goals, TODAY)).toBe(50);
  });

  it('clamps a weight of 0, a negative, a NaN and an over-max into range', () => {
    const [min, max] = AGGREGATE_WEIGHT_LIMITS;
    const goals = store([pct('a', 100), pct('b', 0)]);
    // 0, -2 and NaN all land on min; 99 lands on max.
    for (const bad of [0, -2, NaN, 'not a number']) {
      const x = agg('x', [ref('a', bad), ref('b', bad)]);
      expect(computeAggregate(x, goals, TODAY)).toBe(50);
    }
    const over = agg('x', [ref('a', 99), ref('b', min)]);
    expect(computeAggregate(over, goals, TODAY)).toBe(Math.round((100 * max) / (max + min)));
  });

  it('accepts a numeric string weight from a hand-edited import', () => {
    const goals = store([pct('a', 100), pct('b', 0)]);
    const x = agg('x', [ref('a', '3'), ref('b', '1')]);
    expect(computeAggregate(x, goals, TODAY)).toBe(75);
  });

  it('never returns NaN when every weight clamps up from zero', () => {
    const goals = store([pct('a', 50)]);
    const x = agg('x', [ref('a', 0)]);
    expect(computeAggregate(x, goals, TODAY)).toBe(50);
  });

  it('skips a reference to a deleted goal, shrinking the denominator', () => {
    const goals = store([pct('a', 100)]);
    // 'gone' resolves to nothing, so this reads as a 1-member group at 100,
    // not a 2-member group at 50.
    const x = agg('x', [ref('a'), ref('gone')]);
    expect(computeAggregate(x, goals, TODAY)).toBe(100);
  });

  it('reads 0 when no member resolves at all, and when there are no members', () => {
    const goals = store([]);
    expect(computeAggregate(agg('x', [ref('gone')]), goals, TODAY)).toBe(0);
    expect(computeAggregate(agg('x', []), goals, TODAY)).toBe(0);
    expect(computeAggregate(agg('x', undefined), goals, TODAY)).toBe(0);
  });

  it('counts a duplicated reference once', () => {
    const goals = store([pct('a', 100), pct('b', 0)]);
    const x = agg('x', [ref('a'), ref('a'), ref('b')]);
    expect(computeAggregate(x, goals, TODAY)).toBe(50);
  });

  it('reads members across different years and sections', () => {
    const goals = {
      '2026': { capstone: [pct('a', 100)], milestones: [], wow: [], focus: [] },
      '2027': { capstone: [], milestones: [pct('b', 0)], wow: [], focus: [] },
    };
    const x = agg('x', [
      { year: '2026', section: 'capstone', goalId: 'a' },
      { year: '2027', section: 'milestones', goalId: 'b' },
    ]);
    expect(computeAggregate(x, goals, TODAY)).toBe(50);
  });

  it('reads an entry-based member through percentValue, honouring todayIso', () => {
    // A day-count member: 5 of 10 logged days is 50%, whatever the date.
    const member = { id: 'd', title: 'd', tags: [], tracking: {
      type: 'daycount', target: 10,
      entries: ['2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05'],
    } };
    const goals = store([member]);
    expect(computeAggregate(agg('x', [ref('d')]), goals, TODAY)).toBe(50);
  });
});

describe('computeAggregate — nesting, diamonds and cycles', () => {
  it('recurses into a nested aggregate rather than reading its stored value', () => {
    // inner's parked aggValue is deliberately wrong; the recursion must win,
    // which is what lets one reconcile pass converge.
    const goals = store([
      pct('a', 100), pct('b', 0),
      agg('inner', [ref('a'), ref('b')], { aggValue: 99 }),
    ]);
    const outer = agg('outer', [{ year: '2026', section: 'focus', goalId: 'inner' }]);
    expect(computeAggregate(outer, goals, TODAY)).toBe(50);
  });

  it('counts a shared member in BOTH branches of a diamond', () => {
    // X over A and B; both A and B are groups over the same D.
    // A = D = 60, B = D = 60, so X = 60. A shared `seen` set would skip D
    // under B, making B an empty group at 0 and X 30.
    const goals = store([
      pct('d', 60),
      agg('a', [ref('d')]),
      agg('b', [ref('d')]),
    ]);
    const x = agg('x', [ref('a'), ref('b')]);
    expect(computeAggregate(x, goals, TODAY)).toBe(60);
  });

  it('skips a self-reference', () => {
    const goals = store([pct('a', 80), agg('x', [ref('a'), ref('x')])]);
    expect(computeAggregate(goals['2026'].focus[1], goals, TODAY)).toBe(80);
  });

  it('skips a two-step cycle without overflowing the stack', () => {
    const goals = store([
      pct('a', 40),
      agg('x', [ref('a'), ref('y')]),
      agg('y', [ref('x')]),
    ]);
    // y's only member loops back to x, so y reads 0; x averages 40 and 0.
    expect(computeAggregate(goals['2026'].focus[1], goals, TODAY)).toBe(20);
  });

  it('skips a three-hop cycle without overflowing the stack', () => {
    const goals = store([
      agg('x', [ref('y')]),
      agg('y', [ref('z')]),
      agg('z', [ref('x')]),
    ]);
    expect(computeAggregate(goals['2026'].focus[0], goals, TODAY)).toBe(0);
  });

  it('memoises shared subtrees — a diamond chain stays linear, not exponential', () => {
    // Level k: Xk over Ak and Bk, both over X(k+1). Without value
    // memoisation this is 2^depth traversals; with it, O(depth). At depth 24
    // the unmemoised version is ~17M visits and this test would hang.
    const depth = 24;
    const focus = [pct('leaf', 50)];
    for (let k = 0; k < depth; k++) {
      const child = k === depth - 1 ? 'leaf' : `x${k + 1}`;
      focus.push(agg(`a${k}`, [ref(child)]));
      focus.push(agg(`b${k}`, [ref(child)]));
      focus.push(agg(`x${k}`, [ref(`a${k}`), ref(`b${k}`)]));
    }
    // Count section lookups through a proxy — deterministic, unlike timing.
    let reads = 0;
    const raw = store(focus);
    const goals = new Proxy(raw, {
      get(target, key) {
        const year = target[key];
        if (!year || typeof year !== 'object') return year;
        return new Proxy(year, { get(y, k) { reads++; return y[k]; } });
      },
    });
    const root = focus.find(g => g.id === 'x0');
    expect(computeAggregate(root, goals, TODAY)).toBe(50);
    // Linear in the node count, nowhere near 2^24.
    expect(reads).toBeLessThan(depth * 20);
  });
});

describe('reconcileAggregates', () => {
  it('writes aggValue for a fresh aggregate', () => {
    const goals = store([pct('a', 100), pct('b', 0), agg('x', [ref('a'), ref('b')])]);
    const next = reconcileAggregates(goals, TODAY);
    expect(next['2026'].focus[2].tracking.aggValue).toBe(50);
  });

  it('stores no history — a group records nothing', () => {
    // aggValue is a cache, reconstructed on every pass. A group's value at
    // any past date is derived from its members instead (see
    // aggregateValueAt), so there is nothing here worth recording.
    const goals = store([pct('a', 40), agg('x', [ref('a')])]);
    const tracking = reconcileAggregates(goals, TODAY)['2026'].focus[1].tracking;
    expect('history' in tracking).toBe(false);
  });

  it('returns the SAME reference when every value is already current', () => {
    const goals = store([pct('a', 100), agg('x', [ref('a')])]);
    const once = reconcileAggregates(goals, TODAY);
    expect(once).not.toBe(goals);
    // The no-loop guarantee the main.js subscriber depends on.
    expect(reconcileAggregates(once, TODAY)).toBe(once);
  });

  it('is a no-op on a later day when nothing actually moved', () => {
    const goals = store([pct('a', 40), agg('x', [ref('a')])]);
    const day1 = reconcileAggregates(goals, '2026-10-10');
    expect(reconcileAggregates(day1, '2026-10-11')).toBe(day1);
  });

  it('follows a member that moves', () => {
    const goals = store([pct('a', 40), agg('x', [ref('a')])]);
    const first = reconcileAggregates(goals, TODAY);
    first['2026'].focus[0].tracking.value = 90;
    expect(reconcileAggregates(first, TODAY)['2026'].focus[1].tracking.aggValue).toBe(90);
  });

  it('leaves a store with no aggregates untouched by reference', () => {
    const goals = store([pct('a', 40), pct('b', 10)]);
    expect(reconcileAggregates(goals, TODAY)).toBe(goals);
  });

  it('resolves a three-level chain correctly in ONE pass from cold caches', () => {
    const goals = store([
      pct('leaf', 80),
      agg('l3', [ref('leaf')]),
      agg('l2', [ref('l3')]),
      agg('l1', [ref('l2')]),
    ]);
    const next = reconcileAggregates(goals, TODAY);
    const byId = Object.fromEntries(next['2026'].focus.map(g => [g.id, g]));
    expect(byId.l3.tracking.aggValue).toBe(80);
    expect(byId.l2.tracking.aggValue).toBe(80);
    expect(byId.l1.tracking.aggValue).toBe(80);
    expect(reconcileAggregates(next, TODAY)).toBe(next);
  });

  it('preserves a dormant target, entries and value from a previous type', () => {
    const goals = store([pct('a', 50), agg('x', [ref('a')], {
      value: 40, target: 3, entries: ['2026-09-01'],
    })]);
    const tracking = reconcileAggregates(goals, TODAY)['2026'].focus[1].tracking;
    expect(tracking.value).toBe(40);
    expect(tracking.target).toBe(3);
    expect(tracking.entries).toEqual(['2026-09-01']);
  });

  it('never prunes a member reference, even an unresolvable one', () => {
    // A year handoff can land cross-year refs the receiver has no year for;
    // the write path must not destroy them. pruneMembers is opt-in instead.
    const goals = store([agg('x', [{ year: '2099', section: 'focus', goalId: 'ghost' }])]);
    const x = reconcileAggregates(goals, TODAY)['2026'].focus[0];
    expect(x.tracking.members).toEqual([{ year: '2099', section: 'focus', goalId: 'ghost' }]);
    expect(x.tracking.aggValue).toBe(0);
  });

  it('reconciles aggregates in every year and section, leaving others by reference', () => {
    const goals = {
      '2026': { capstone: [agg('x', [{ year: '2027', section: 'focus', goalId: 'a' }])],
                milestones: [], wow: [], focus: [] },
      '2027': { capstone: [], milestones: [], wow: [], focus: [pct('a', 70)] },
    };
    const next = reconcileAggregates(goals, TODAY);
    expect(next['2026'].capstone[0].tracking.aggValue).toBe(70);
    expect(next['2027']).toBe(goals['2027']);
  });

  it('passes a null or undefined store straight through', () => {
    expect(reconcileAggregates(undefined, TODAY)).toBeUndefined();
    expect(reconcileAggregates(null, TODAY)).toBeNull();
  });
});

describe('pruneMembers', () => {
  it('returns the same goal reference when every member resolves', () => {
    const goals = store([pct('a', 40)]);
    const x = agg('x', [ref('a')]);
    expect(pruneMembers(x, goals)).toBe(x);
  });

  it('returns the same reference when there are no members at all', () => {
    const x = agg('x', []);
    expect(pruneMembers(x, store([]))).toBe(x);
  });

  it('drops only the unresolvable references', () => {
    const goals = store([pct('a', 40)]);
    const x = agg('x', [ref('a'), ref('ghost')]);
    const pruned = pruneMembers(x, goals);
    expect(pruned).not.toBe(x);
    expect(pruned.tracking.members).toEqual([ref('a')]);
  });
});

describe('wouldCycle', () => {
  const goals = store([
    pct('leaf', 10),
    agg('x', [ref('mid')]),
    agg('mid', [ref('deep')]),
    agg('deep', [ref('leaf')]),
    agg('sibling', [ref('leaf')]),
  ]);

  it('is true for the goal itself', () => {
    expect(wouldCycle(ref('x'), 'x', goals)).toBe(true);
  });

  it('is true for a direct back-edge', () => {
    // Adding x as a member of mid would close mid -> x -> mid.
    expect(wouldCycle(ref('x'), 'mid', goals)).toBe(true);
  });

  it('is true for a three-hop back-edge', () => {
    // Adding x as a member of deep closes deep -> x -> mid -> deep.
    expect(wouldCycle(ref('x'), 'deep', goals)).toBe(true);
  });

  it('is false for a plain leaf', () => {
    expect(wouldCycle(ref('leaf'), 'x', goals)).toBe(false);
  });

  it('is false for a diamond — sharing a member is not a cycle', () => {
    // x and sibling may both hold leaf; adding sibling to x is legal.
    expect(wouldCycle(ref('sibling'), 'x', goals)).toBe(false);
  });

  it('is false for an unresolvable candidate or a missing self id', () => {
    expect(wouldCycle(ref('ghost'), 'x', goals)).toBe(false);
    expect(wouldCycle(ref('x'), undefined, goals)).toBe(false);
  });
});


describe('memberWeight', () => {
  const [min, max] = AGGREGATE_WEIGHT_LIMITS;

  it('reads an omitted weight as the minimum', () => {
    // Omitted IS the default — nothing stores weight: 1.
    expect(memberWeight({ year: '2026', section: 'focus', goalId: 'a' })).toBe(min);
    expect(memberWeight({ weight: undefined })).toBe(min);
    expect(memberWeight({ weight: null })).toBe(min);
    expect(memberWeight(undefined)).toBe(min);
  });

  it('passes a valid weight through', () => {
    expect(memberWeight({ weight: 1 })).toBe(1);
    expect(memberWeight({ weight: 5 })).toBe(5);
    expect(memberWeight({ weight: max })).toBe(max);
  });

  it('clamps anything outside the range', () => {
    expect(memberWeight({ weight: 0 })).toBe(min);
    expect(memberWeight({ weight: -7 })).toBe(min);
    expect(memberWeight({ weight: 99 })).toBe(max);
  });

  it('coerces a numeric string and rounds a fraction', () => {
    // Both reachable from a hand-edited import.
    expect(memberWeight({ weight: '3' })).toBe(3);
    expect(memberWeight({ weight: 2.4 })).toBe(2);
    expect(memberWeight({ weight: 2.6 })).toBe(3);
  });

  it('never returns NaN, whatever it is handed', () => {
    for (const bad of [NaN, 'abc', {}, [], Infinity, -Infinity]) {
      const w = memberWeight({ weight: bad });
      expect(Number.isFinite(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(min);
      expect(w).toBeLessThanOrEqual(max);
    }
  });
});

describe('goalsFromEntries', () => {
  // The dialogs hold a flat [{year, section, goal}] list; every graph walker
  // in aggregate.js takes the store's own nested shape. This is the bridge.
  const entry = (year, section, id) => ({ year, section, goal: { id, title: id, tags: [] } });

  it('nests a flat list back into year and section keys', () => {
    const graph = goalsFromEntries([
      entry('2026', 'focus', 'a'),
      entry('2026', 'capstone', 'b'),
      entry('2027', 'focus', 'c'),
    ]);
    expect(Object.keys(graph).sort()).toEqual(['2026', '2027']);
    expect(graph['2026'].focus.map(g => g.id)).toEqual(['a']);
    expect(graph['2026'].capstone.map(g => g.id)).toEqual(['b']);
    expect(graph['2027'].focus.map(g => g.id)).toEqual(['c']);
  });

  it('keeps several goals in one section, in order', () => {
    const graph = goalsFromEntries([entry('2026', 'focus', 'a'), entry('2026', 'focus', 'b')]);
    expect(graph['2026'].focus.map(g => g.id)).toEqual(['a', 'b']);
  });

  it('stringifies a numeric year, so lookups by string key still resolve', () => {
    const graph = goalsFromEntries([{ year: 2026, section: 'focus', goal: { id: 'a' } }]);
    expect(graph['2026'].focus[0].id).toBe('a');
  });

  it('produces a graph the resolvers can actually read', () => {
    const graph = goalsFromEntries([entry('2026', 'focus', 'a')]);
    expect(resolveMember(graph, { year: '2026', section: 'focus', goalId: 'a' })?.id).toBe('a');
  });

  it('returns an empty graph for an empty or missing list', () => {
    expect(goalsFromEntries([])).toEqual({});
    expect(goalsFromEntries(undefined)).toEqual({});
  });
});
