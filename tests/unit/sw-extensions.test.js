// app/sw-extensions.js is a plain classic script (no import/export — see its
// own header comment for why), appended verbatim onto dist/sw.js by
// utils/build.js. It can't be imported like a normal ES module, so this test
// loads the raw source and evaluates it in a Node vm sandbox, then exercises
// the pure helper functions it declares as sandbox globals. The IDB-touching
// functions (openNotifDB, readMainState, checkDueDatesInBackground) and the
// two self.addEventListener registrations aren't covered here — they need a
// real service-worker environment, which is out of reach for a unit test;
// this only verifies the pure bucket/date logic that drives them.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const source = readFileSync(fileURLToPath(new URL('../../app/sw-extensions.js', import.meta.url)), 'utf8');

function loadSandbox() {
  const sandbox = {
    self: { addEventListener: () => {} },
    BASE_PATH: '/',
    indexedDB: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

describe('sw-extensions — daysUntil', () => {
  const { daysUntil } = loadSandbox();

  it('returns 0 for today', () => {
    expect(daysUntil('2026-08-31', '2026-08-31')).toBe(0);
  });

  it('returns 1 for tomorrow', () => {
    expect(daysUntil('2026-09-01', '2026-08-31')).toBe(1);
  });

  it('returns a negative number for a past date', () => {
    expect(daysUntil('2026-08-30', '2026-08-31')).toBe(-1);
  });

  it('crosses a month boundary correctly', () => {
    expect(daysUntil('2026-09-01', '2026-08-31')).toBe(1);
  });
});

describe('sw-extensions — bucketOf', () => {
  const { bucketOf } = loadSandbox();
  const today = '2026-08-31';

  it('returns none when there is no dueDate', () => {
    expect(bucketOf(null, true, today)).toBe('none');
  });

  it('returns none when inactive, even if overdue', () => {
    expect(bucketOf('2026-08-01', false, today)).toBe('none');
  });

  it('returns overdue for a past date', () => {
    expect(bucketOf('2026-08-30', true, today)).toBe('overdue');
  });

  it('returns today for the current date', () => {
    expect(bucketOf('2026-08-31', true, today)).toBe('today');
  });

  it('returns tomorrow for exactly one day out', () => {
    expect(bucketOf('2026-09-01', true, today)).toBe('tomorrow');
  });

  it('returns none for two or more days out', () => {
    expect(bucketOf('2026-09-02', true, today)).toBe('none');
  });
});

describe('sw-extensions — isActive', () => {
  const { isActive } = loadSandbox();

  it('treats a percentage goal under 100 as active', () => {
    expect(isActive({ tracking: { type: 'percentage', value: 40 } })).toBe(true);
  });

  it('treats a percentage goal at 100 as inactive', () => {
    expect(isActive({ tracking: { type: 'percentage', value: 100 } })).toBe(false);
  });

  it('treats a percentage goal with no value as active (defaults to 0)', () => {
    expect(isActive({ tracking: { type: 'percentage' } })).toBe(true);
  });

  it('treats any non-percentage tracking type as active — no replicated frequency-pace logic', () => {
    expect(isActive({ tracking: { type: 'weekly', value: 100 } })).toBe(true);
  });
});

describe('sw-extensions — collectDueDateUpcoming', () => {
  const { collectDueDateUpcoming } = loadSandbox();
  const today = '2026-08-31';

  it('returns empty buckets for an empty state', () => {
    expect(collectDueDateUpcoming({ goals: {}, lists: [] }, today)).toEqual({ overdue: [], today: [], tomorrow: [] });
  });

  it('sorts goals across years and sections into the right bucket', () => {
    const state = {
      goals: {
        2026: {
          capstone: [{ id: 'g1', dueDate: '2026-08-30', tracking: { type: 'percentage', value: 0 } }],
          milestones: [{ id: 'g2', dueDate: '2026-08-31', tracking: { type: 'percentage', value: 0 } }],
          wow: [{ id: 'g3', dueDate: '2026-09-01', tracking: { type: 'percentage', value: 0 } }],
        },
      },
      lists: [],
    };
    const result = collectDueDateUpcoming(state, today);
    expect(result.overdue.map(g => g.id)).toEqual(['g1']);
    expect(result.today.map(g => g.id)).toEqual(['g2']);
    expect(result.tomorrow.map(g => g.id)).toEqual(['g3']);
  });

  it('skips archived goals', () => {
    const state = {
      goals: { 2026: { capstone: [{ id: 'g1', dueDate: '2026-08-30', archived: true, tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [] } },
      lists: [],
    };
    expect(collectDueDateUpcoming(state, today)).toEqual({ overdue: [], today: [], tomorrow: [] });
  });

  it('skips goals already at 100%', () => {
    const state = {
      goals: { 2026: { capstone: [{ id: 'g1', dueDate: '2026-08-30', tracking: { type: 'percentage', value: 100 } }], milestones: [], wow: [] } },
      lists: [],
    };
    expect(collectDueDateUpcoming(state, today)).toEqual({ overdue: [], today: [], tomorrow: [] });
  });

  it('sorts list items into the right bucket', () => {
    const state = {
      goals: {},
      lists: [{ id: 'l1', items: [{ id: 'i1', dueDate: '2026-08-30', status: 'open' }] }],
    };
    const result = collectDueDateUpcoming(state, today);
    expect(result.overdue.map(i => i.id)).toEqual(['i1']);
  });

  it('skips done and closed list items regardless of dueDate', () => {
    const state = {
      goals: {},
      lists: [{
        id: 'l1',
        items: [
          { id: 'i1', dueDate: '2026-08-30', status: 'done' },
          { id: 'i2', dueDate: '2026-08-30', status: 'closed' },
        ],
      }],
    };
    expect(collectDueDateUpcoming(state, today)).toEqual({ overdue: [], today: [], tomorrow: [] });
  });

  it('includes items from an archived list — a due date stays meaningful regardless of the list being tucked away', () => {
    const state = {
      goals: {},
      lists: [{ id: 'l1', archived: true, items: [{ id: 'i1', dueDate: '2026-08-30', status: 'open' }] }],
    };
    const result = collectDueDateUpcoming(state, today);
    expect(result.overdue.map(i => i.id)).toEqual(['i1']);
  });
});
