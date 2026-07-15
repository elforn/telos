import { describe, it, expect, beforeEach } from 'vitest';
import { migrateGoals } from '../../app/utils/migrate-goals.js';
import { boot, setState, getState, reset } from '../../_lib/core/store/store.js';

let dbSeq = 0;
function freshName() { return `telos-migrate-${dbSeq++}`; }

const emptyYear = { capstone: [], milestones: [], wow: [], focus: [] };

describe('migrateGoals — pure function', () => {
  it('returns the same reference when nothing needs migrating', () => {
    const goals = { '2026': { ...emptyYear, capstone: [{ id: '1', title: 'A', tags: [], percentage: 40 }] } };
    expect(migrateGoals(goals)).toBe(goals);
  });

  it('renames description to notes', () => {
    const goals = { '2026': { ...emptyYear, capstone: [{ id: '1', title: 'A', description: 'old', tags: [], percentage: 0 }] } };
    const out = migrateGoals(goals);
    const g = out['2026'].capstone[0];
    expect(g.notes).toBe('old');
    expect('description' in g).toBe(false);
  });

  it('strips tracking and sets percentage: 0 on goals from the old promote flow', () => {
    const goals = { '2026': { ...emptyYear, milestones: [{ id: '1', title: 'Promoted', tags: [], tracking: { type: 'percentage', value: 0 } }] } };
    const g = migrateGoals(goals)['2026'].milestones[0];
    expect(g).toEqual({ id: '1', title: 'Promoted', tags: [], percentage: 0 });
    expect('tracking' in g).toBe(false);
  });

  it('strips tracking but preserves an existing percentage', () => {
    const goals = { '2026': { ...emptyYear, wow: [{ id: '1', title: 'A', tags: [], tracking: { type: 'percentage', value: 30 }, percentage: 55 }] } };
    const g = migrateGoals(goals)['2026'].wow[0];
    expect(g.percentage).toBe(55);
    expect('tracking' in g).toBe(false);
  });

  it('leaves untouched goals in migrated years by reference', () => {
    const clean = { id: '2', title: 'Clean', tags: [], percentage: 10 };
    const goals = { '2026': { ...emptyYear, capstone: [{ id: '1', title: 'A', tracking: {} }, clean] } };
    expect(migrateGoals(goals)['2026'].capstone[1]).toBe(clean);
  });

  it('is idempotent', () => {
    const goals = { '2026': { ...emptyYear, capstone: [{ id: '1', title: 'A', description: 'x', tracking: {} }] } };
    const once = migrateGoals(goals);
    expect(migrateGoals(once)).toBe(once);
  });

  it('handles empty and missing input', () => {
    expect(migrateGoals({})).toEqual({});
    expect(migrateGoals(undefined)).toEqual(undefined);
  });
});

describe('migrateGoals — boot integration', () => {
  beforeEach(() => reset());

  it('normalizes a stored goal with tracking and persists the result', async () => {
    const name = freshName();
    await boot({ dbName: name, initialState: { goals: {} } });
    setState('goals', { '2026': { ...emptyYear, focus: [{ id: '1', title: 'Promoted', tags: [], tracking: { type: 'percentage', value: 0 } }] } });
    reset();

    // Same sequence as app/main.js after boot
    await boot({ dbName: name, initialState: { goals: {} } });
    const goals = getState().goals ?? {};
    const migrated = migrateGoals(goals);
    if (migrated !== goals) setState('goals', migrated);

    expect(getState().goals['2026'].focus[0]).toEqual({ id: '1', title: 'Promoted', tags: [], percentage: 0 });

    // Migrated shape survives a further boot with nothing left to migrate
    reset();
    await boot({ dbName: name, initialState: { goals: {} } });
    const again = getState().goals;
    expect(migrateGoals(again)).toBe(again);
    expect(again['2026'].focus[0].percentage).toBe(0);
  });
});
