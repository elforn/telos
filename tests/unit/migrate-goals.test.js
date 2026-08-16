import { describe, it, expect } from 'vitest';
import { migrateGoals } from '../../app/utils/migrate-goals.js';

function state(goals) {
  return { goals, images: {}, lists: [], accentColors: {} };
}

describe('migrateGoals — percentage → tracking', () => {
  it('rewrites a flat-percentage goal to the tracking union', () => {
    const before = state({
      '2026': { capstone: [{ id: 'c1', title: 'Ship it', tags: [], percentage: 40 }], milestones: [], wow: [], focus: [] },
    });
    const after = migrateGoals(before);
    const goal = after.goals['2026'].capstone[0];
    expect(goal.tracking).toEqual({ type: 'percentage', value: 40 });
    expect('percentage' in goal).toBe(false);
  });

  it('preserves dueDate and archived alongside the rewritten tracking field', () => {
    const before = state({
      '2026': { capstone: [{ id: 'c1', title: 'Ship it', tags: ['work'], percentage: 100, dueDate: '2026-12-31', archived: true }], milestones: [], wow: [], focus: [] },
    });
    const after = migrateGoals(before);
    const goal = after.goals['2026'].capstone[0];
    expect(goal.dueDate).toBe('2026-12-31');
    expect(goal.archived).toBe(true);
    expect(goal.tracking).toEqual({ type: 'percentage', value: 100 });
  });

  it('migrates every section and every year', () => {
    const before = state({
      '2025': { capstone: [{ id: 'a', title: 'A', percentage: 10 }], milestones: [], wow: [], focus: [] },
      '2026': {
        capstone: [],
        milestones: [{ id: 'b', title: 'B', percentage: 20 }],
        wow: [{ id: 'c', title: 'C', percentage: 30 }],
        focus: [{ id: 'd', title: 'D', percentage: 40 }],
      },
    });
    const after = migrateGoals(before);
    expect(after.goals['2025'].capstone[0].tracking.value).toBe(10);
    expect(after.goals['2026'].milestones[0].tracking.value).toBe(20);
    expect(after.goals['2026'].wow[0].tracking.value).toBe(30);
    expect(after.goals['2026'].focus[0].tracking.value).toBe(40);
  });

  it('leaves an already-migrated goal untouched', () => {
    const goal = { id: 'c1', title: 'Ship it', tags: [], tracking: { type: 'weekly', target: 3, entries: ['2026-08-10'] } };
    const before = state({ '2026': { capstone: [goal], milestones: [], wow: [], focus: [] } });
    const after = migrateGoals(before);
    expect(after.goals['2026'].capstone[0]).toBe(goal); // same reference — never touched
  });

  it('is idempotent: running twice produces the same result and no-ops the second time', () => {
    const before = state({
      '2026': { capstone: [{ id: 'c1', title: 'Ship it', percentage: 40 }], milestones: [], wow: [], focus: [] },
    });
    const once = migrateGoals(before);
    const twice = migrateGoals(once);
    expect(twice).toBe(once); // reference-equal — boot() relies on this to skip a redundant IDB write
  });

  it('returns the exact same state reference when there is nothing to migrate', () => {
    const before = state({
      '2026': { capstone: [{ id: 'c1', title: 'Already tracking', tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [], focus: [] },
    });
    expect(migrateGoals(before)).toBe(before);
  });

  it('passes through state with no goals key at all', () => {
    const before = { images: {}, lists: [] };
    expect(migrateGoals(before)).toBe(before);
  });

  it('passes through an empty goals object', () => {
    const before = state({});
    expect(migrateGoals(before)).toBe(before);
  });
});
