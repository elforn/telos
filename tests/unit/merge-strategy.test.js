import { describe, it, expect } from 'vitest';
import { mergeStrategy } from '../../app/utils/merge-strategy.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function goal(id, title, extra = {}) {
  return { id, title, tracking: { type: 'percentage', value: 0 }, tags: [], ...extra };
}

function item(id, title, extra = {}) {
  return { id, title, status: 'open', tags: [], inGoals: [], ...extra };
}

function list(id, name, items = []) {
  return { id, name, items };
}

function state(overrides = {}) {
  return {
    goals:        {},
    lists:        [],
    accentColors: {},
    reflections:  {},
    images:       {},
    ...overrides,
  };
}

// ── goals ─────────────────────────────────────────────────────────────────────

describe('mergeStrategy — goals', () => {
  it('adds a new year from import', () => {
    const result = mergeStrategy(
      state(),
      state({ goals: { '2025': { capstone: [goal('g1', 'A')], milestones: [], wow: [], focus: [] } } }),
    );
    expect(result.goals['2025'].capstone).toHaveLength(1);
    expect(result.goals['2025'].capstone[0].id).toBe('g1');
  });

  it('adds goals with new IDs to an existing year', () => {
    const local    = state({ goals: { '2025': { capstone: [goal('g1', 'A')], milestones: [], wow: [], focus: [] } } });
    const imported = state({ goals: { '2025': { capstone: [goal('g2', 'B')], milestones: [], wow: [], focus: [] } } });
    const result   = mergeStrategy(local, imported);
    expect(result.goals['2025'].capstone).toHaveLength(2);
    expect(result.goals['2025'].capstone.map(g => g.id)).toEqual(['g1', 'g2']);
  });

  it('skips a goal with same ID and identical title', () => {
    const g = goal('g1', 'Same');
    const result = mergeStrategy(
      state({ goals: { '2025': { capstone: [g], milestones: [], wow: [], focus: [] } } }),
      state({ goals: { '2025': { capstone: [goal('g1', 'Same')], milestones: [], wow: [], focus: [] } } }),
    );
    expect(result.goals['2025'].capstone).toHaveLength(1);
  });

  it('creates a conflict copy (⚭) immediately after local when title differs', () => {
    const local    = state({ goals: { '2025': { capstone: [goal('g1', 'Old title'), goal('g2', 'B')], milestones: [], wow: [], focus: [] } } });
    const imported = state({ goals: { '2025': { capstone: [goal('g1', 'New title')], milestones: [], wow: [], focus: [] } } });
    const result   = mergeStrategy(local, imported);
    const capstone = result.goals['2025'].capstone;
    expect(capstone).toHaveLength(3);
    expect(capstone[0].id).toBe('g1');
    expect(capstone[1].title).toBe('⚭ New title');
    expect(capstone[1].id).not.toBe('g1');
    expect(capstone[2].id).toBe('g2');
  });

  it('does not treat tracking differences as a conflict', () => {
    const local    = state({ goals: { '2025': { capstone: [goal('g1', 'Same', { tracking: { type: 'percentage', value: 50 } })], milestones: [], wow: [], focus: [] } } });
    const imported = state({ goals: { '2025': { capstone: [goal('g1', 'Same', { tracking: { type: 'percentage', value: 80 } })], milestones: [], wow: [], focus: [] } } });
    const result   = mergeStrategy(local, imported);
    expect(result.goals['2025'].capstone).toHaveLength(1);
    expect(result.goals['2025'].capstone[0].tracking.value).toBe(50);
  });

  it('preserves local goal tracking value when same ID', () => {
    const local    = state({ goals: { '2025': { capstone: [goal('g1', 'Same', { tracking: { type: 'percentage', value: 75 } })], milestones: [], wow: [], focus: [] } } });
    const imported = state({ goals: { '2025': { capstone: [goal('g1', 'Same', { tracking: { type: 'percentage', value: 10 } })], milestones: [], wow: [], focus: [] } } });
    const result   = mergeStrategy(local, imported);
    expect(result.goals['2025'].capstone[0].tracking.value).toBe(75);
  });
});

// ── lists ─────────────────────────────────────────────────────────────────────

describe('mergeStrategy — lists', () => {
  it('adds a new list from import', () => {
    const result = mergeStrategy(
      state({ lists: [list('l1', 'A')] }),
      state({ lists: [list('l1', 'A'), list('l2', 'B')] }),
    );
    expect(result.lists).toHaveLength(2);
    expect(result.lists[1].id).toBe('l2');
  });

  it('adds new items to an existing list', () => {
    const result = mergeStrategy(
      state({ lists: [list('l1', 'A', [item('i1', 'X')])] }),
      state({ lists: [list('l1', 'A', [item('i1', 'X'), item('i2', 'Y')])] }),
    );
    expect(result.lists[0].items).toHaveLength(2);
    expect(result.lists[0].items[1].id).toBe('i2');
  });

  it('skips an item with same ID and identical title/note/url', () => {
    const i = item('i1', 'Same', { note: 'n', url: 'u' });
    const result = mergeStrategy(
      state({ lists: [list('l1', 'A', [i])] }),
      state({ lists: [list('l1', 'A', [item('i1', 'Same', { note: 'n', url: 'u' })])] }),
    );
    expect(result.lists[0].items).toHaveLength(1);
  });

  it('creates a conflict copy (⚭) immediately after local when title differs', () => {
    const result = mergeStrategy(
      state({ lists: [list('l1', 'A', [item('i1', 'Old'), item('i2', 'Z')])] }),
      state({ lists: [list('l1', 'A', [item('i1', 'New')])] }),
    );
    const items = result.lists[0].items;
    expect(items).toHaveLength(3);
    expect(items[0].id).toBe('i1');
    expect(items[1].title).toBe('⚭ New');
    expect(items[1].id).not.toBe('i1');
    expect(items[2].id).toBe('i2');
  });

  it('creates a conflict copy when note differs', () => {
    const result = mergeStrategy(
      state({ lists: [list('l1', 'A', [item('i1', 'Same', { note: 'old note' })])] }),
      state({ lists: [list('l1', 'A', [item('i1', 'Same', { note: 'new note' })])] }),
    );
    expect(result.lists[0].items).toHaveLength(2);
    expect(result.lists[0].items[1].title).toBe('⚭ Same');
  });

  it('creates a conflict copy when url differs', () => {
    const result = mergeStrategy(
      state({ lists: [list('l1', 'A', [item('i1', 'Same', { url: 'http://old' })])] }),
      state({ lists: [list('l1', 'A', [item('i1', 'Same', { url: 'http://new' })])] }),
    );
    expect(result.lists[0].items).toHaveLength(2);
  });

  it('does not treat status differences as a conflict', () => {
    const result = mergeStrategy(
      state({ lists: [list('l1', 'A', [item('i1', 'Same', { status: 'open' })])] }),
      state({ lists: [list('l1', 'A', [item('i1', 'Same', { status: 'done' })])] }),
    );
    expect(result.lists[0].items).toHaveLength(1);
    expect(result.lists[0].items[0].status).toBe('open');
  });

  it('preserves local list name and color when merging items', () => {
    const result = mergeStrategy(
      state({ lists: [{ id: 'l1', name: 'Local name', color: '#abc', items: [] }] }),
      state({ lists: [{ id: 'l1', name: 'Imported name', color: '#xyz', items: [item('i1', 'X')] }] }),
    );
    expect(result.lists[0].name).toBe('Local name');
    expect(result.lists[0].color).toBe('#abc');
    expect(result.lists[0].items).toHaveLength(1);
  });
});

// ── year-keyed data ───────────────────────────────────────────────────────────

describe('mergeStrategy — year-keyed data (accentColors, reflections, images)', () => {
  it('local wins for existing year in accentColors', () => {
    const result = mergeStrategy(
      state({ accentColors: { '2025': '#local' } }),
      state({ accentColors: { '2025': '#imported' } }),
    );
    expect(result.accentColors['2025']).toBe('#local');
  });

  it('adds new year from import in accentColors', () => {
    const result = mergeStrategy(
      state({ accentColors: { '2025': '#local' } }),
      state({ accentColors: { '2026': '#imported' } }),
    );
    expect(result.accentColors['2025']).toBe('#local');
    expect(result.accentColors['2026']).toBe('#imported');
  });

  it('local wins for existing year in reflections', () => {
    const r = { note: 'local', stars: 5 };
    const result = mergeStrategy(
      state({ reflections: { '2025': { annual: r } } }),
      state({ reflections: { '2025': { annual: { note: 'imported', stars: 3 } } } }),
    );
    expect(result.reflections['2025'].annual).toEqual(r);
  });

  it('local wins for existing year image mapping', () => {
    const result = mergeStrategy(
      state({ images: { '2025': 'local-blob-id' } }),
      state({ images: { '2025': 'imported-blob-id' } }),
    );
    expect(result.images['2025']).toBe('local-blob-id');
  });
});

// ── no-op ─────────────────────────────────────────────────────────────────────

describe('mergeStrategy — no-op', () => {
  it('returns local state unchanged when import is empty', () => {
    const local = state({
      goals: { '2025': { capstone: [goal('g1', 'A')], milestones: [], wow: [], focus: [] } },
      lists: [list('l1', 'My list', [item('i1', 'Item')])],
    });
    const result = mergeStrategy(local, state());
    expect(result.goals['2025'].capstone).toHaveLength(1);
    expect(result.lists).toHaveLength(1);
    expect(result.lists[0].items).toHaveLength(1);
  });
});
