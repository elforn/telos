import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../../app/strings.js';
import { buildDigest } from '../../app/utils/build-telos-digest.js';
import { setNotifyAfterHour } from '../../app/utils/notification-prefs.js';

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function stateWithOverdueGoal(year = '2026', dueDate = yesterday()) {
  return {
    goals: { [year]: { capstone: [{ id: 'g1', title: 'X', tracking: { type: 'percentage', value: 0 }, dueDate }], milestones: [], wow: [] } },
    lists: [],
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

// This is the app-specific glue digest-notifier.js's buildDigest property
// points at — the hour-gate and hidden-count wiring, plus the actual text.
// The generic mount/permission/dedup/refresh mechanics live in
// _lib/modules/notifications/digest-notifier.test.js.
describe('build-telos-digest', () => {
  it('returns null when there is nothing overdue/due today', () => {
    expect(buildDigest({ goals: {}, lists: [] })).toBeNull();
  });

  it('returns a digest when something is overdue', () => {
    const digest = buildDigest(stateWithOverdueGoal());
    expect(digest.title).toBe('1 items need attention');
  });

  it('does not fire before the configured "notify after" hour', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 15, 8, 0, 0));
    setNotifyAfterHour(9);
    expect(buildDigest(stateWithOverdueGoal('2026', '2026-01-14'))).toBeNull();
  });

  it('fires once past the configured "notify after" hour', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 15, 9, 0, 0));
    setNotifyAfterHour(9);
    expect(buildDigest(stateWithOverdueGoal('2026', '2026-01-14'))).not.toBeNull();
  });

  it('fires regardless of hour when no restriction is configured (the default)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 15, 0, 30, 0));
    expect(buildDigest(stateWithOverdueGoal('2026', '2026-01-14'))).not.toBeNull();
  });

  it('appends a hidden-count clause when a suppressed year also has an overdue goal', () => {
    const state = {
      goals: {
        2026: stateWithOverdueGoal().goals['2026'],
        2020: { capstone: [{ id: 'g2', title: 'Old', tracking: { type: 'percentage', value: 0 }, dueDate: '2020-01-01' }], milestones: [], wow: [] },
      },
      lists: [],
      // 2020 defaults hidden (not the real current year) — no explicit entry needed.
    };
    const digest = buildDigest(state);
    expect(digest.body).toBe('Overdue (1) · 1 hidden');
  });

  it('does not append a hidden-count clause when nothing is hidden', () => {
    const digest = buildDigest(stateWithOverdueGoal());
    expect(digest.body).toBe('Overdue (1)');
  });

  it('still fires a minimal digest when everything visible is quiet but a hidden year has an overdue goal', () => {
    const state = {
      goals: { 2020: { capstone: [{ id: 'g2', title: 'Old', tracking: { type: 'percentage', value: 0 }, dueDate: '2020-01-01' }], milestones: [], wow: [] } },
      lists: [],
    };
    const digest = buildDigest(state);
    expect(digest.title).toBe('1 hidden');
    expect(digest.body).toBe('Tap to review');
  });
});
