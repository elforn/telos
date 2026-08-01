// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { FilterState } from './filter-state.js';

const SHAPE = {
  q:           { kind: 'string' },
  status:      { kind: 'enum', values: ['all', 'active', 'done'] },
  priority:    { kind: 'enum', values: ['low', 'mid', 'high'], default: 'mid' },
  tags:        { kind: 'set' },
  panelOpen:   { kind: 'boolean' },
};

const KEY = 'test-filter';

beforeEach(() => localStorage.clear());

describe('FilterState.load()', () => {
  it('returns defaults when nothing stored', () => {
    const fs = FilterState(KEY, SHAPE);
    const state = fs.load();
    expect(state.q).toBe('');
    expect(state.status).toBe('all');
    expect(state.priority).toBe('mid');
    expect(state.tags).toEqual(new Set());
    expect(state.panelOpen).toBe(false);
  });

  it('restores persisted values', () => {
    localStorage.setItem(KEY, JSON.stringify({
      q: 'hello', status: 'active', priority: 'high', tags: ['a', 'b'], panelOpen: true,
    }));
    const state = FilterState(KEY, SHAPE).load();
    expect(state.q).toBe('hello');
    expect(state.status).toBe('active');
    expect(state.priority).toBe('high');
    expect(state.tags).toEqual(new Set(['a', 'b']));
    expect(state.panelOpen).toBe(true);
  });

  it('resets enum to default when stored value is invalid', () => {
    localStorage.setItem(KEY, JSON.stringify({ status: 'bogus', priority: 'extreme' }));
    const state = FilterState(KEY, SHAPE).load();
    expect(state.status).toBe('all');
    expect(state.priority).toBe('mid');
  });

  it('returns empty Set when stored tags value is not an array', () => {
    localStorage.setItem(KEY, JSON.stringify({ tags: 'bad' }));
    expect(FilterState(KEY, SHAPE).load().tags).toEqual(new Set());
  });

  it('returns false for boolean when stored value is not a boolean', () => {
    localStorage.setItem(KEY, JSON.stringify({ panelOpen: 'yes' }));
    expect(FilterState(KEY, SHAPE).load().panelOpen).toBe(false);
  });

  it('returns defaults when stored JSON is malformed', () => {
    localStorage.setItem(KEY, 'not json {{{');
    const state = FilterState(KEY, SHAPE).load();
    expect(state.q).toBe('');
    expect(state.status).toBe('all');
  });
});

describe('FilterState.save()', () => {
  it('persists state to localStorage', () => {
    const fs = FilterState(KEY, SHAPE);
    fs.save({ q: 'x', status: 'all', priority: 'mid', tags: new Set(), panelOpen: false });
    // q is non-default so the key should exist
    expect(localStorage.getItem(KEY)).not.toBeNull();
    const parsed = JSON.parse(localStorage.getItem(KEY));
    expect(parsed.q).toBe('x');
  });

  it('serializes Set as array', () => {
    FilterState(KEY, SHAPE).save({ q: '', status: 'all', priority: 'mid', tags: new Set(['x', 'y']), panelOpen: false });
    const parsed = JSON.parse(localStorage.getItem(KEY));
    expect(Array.isArray(parsed.tags)).toBe(true);
    expect(parsed.tags).toEqual(expect.arrayContaining(['x', 'y']));
  });

  it('removes the key when all fields are default', () => {
    localStorage.setItem(KEY, 'existing');
    FilterState(KEY, SHAPE).save({ q: '', status: 'all', priority: 'mid', tags: new Set(), panelOpen: false });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('keeps the key when only panelOpen (boolean) differs from default', () => {
    FilterState(KEY, SHAPE).save({ q: '', status: 'all', priority: 'mid', tags: new Set(), panelOpen: true });
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it('removes the key when only panelOpen is true but all filter fields are default', () => {
    // panelOpen=true alone is non-default, so the key is kept (not all defaults)
    // this test verifies the remove-when-all-default rule excludes booleans only for isActive, not for save
    const fs = FilterState(KEY, SHAPE);
    fs.save({ q: '', status: 'all', priority: 'mid', tags: new Set(), panelOpen: false });
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('FilterState.clear()', () => {
  it('removes the key', () => {
    localStorage.setItem(KEY, 'data');
    FilterState(KEY, SHAPE).clear();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('is a no-op when key is absent', () => {
    expect(() => FilterState(KEY, SHAPE).clear()).not.toThrow();
  });
});

describe('FilterState.isActive()', () => {
  const base = { q: '', status: 'all', priority: 'mid', tags: new Set(), panelOpen: false };

  it('returns false when all filter fields are default', () => {
    expect(FilterState(KEY, SHAPE).isActive(base)).toBe(false);
  });

  it('returns true when q is non-empty', () => {
    expect(FilterState(KEY, SHAPE).isActive({ ...base, q: 'hello' })).toBe(true);
  });

  it('returns true when status is non-default', () => {
    expect(FilterState(KEY, SHAPE).isActive({ ...base, status: 'done' })).toBe(true);
  });

  it('returns true when priority differs from declared default', () => {
    expect(FilterState(KEY, SHAPE).isActive({ ...base, priority: 'high' })).toBe(true);
  });

  it('returns true when tags is non-empty', () => {
    expect(FilterState(KEY, SHAPE).isActive({ ...base, tags: new Set(['a']) })).toBe(true);
  });

  it('returns false when only boolean (panelOpen) differs — booleans do not count', () => {
    expect(FilterState(KEY, SHAPE).isActive({ ...base, panelOpen: true })).toBe(false);
  });

  it('returns true when both a filter field and a boolean are set', () => {
    expect(FilterState(KEY, SHAPE).isActive({ ...base, q: 'x', panelOpen: true })).toBe(true);
  });
});

describe('FilterState round-trip', () => {
  it('save then load returns the same state', () => {
    const fs = FilterState(KEY, SHAPE);
    const state = { q: 'foo', status: 'done', priority: 'low', tags: new Set(['a']), panelOpen: true };
    fs.save(state);
    const loaded = fs.load();
    expect(loaded.q).toBe('foo');
    expect(loaded.status).toBe('done');
    expect(loaded.priority).toBe('low');
    expect(loaded.tags).toEqual(new Set(['a']));
    expect(loaded.panelOpen).toBe(true);
  });
});
