import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectUpcoming, upcomingBadgeCount, collectHiddenUrgent } from '../../app/utils/upcoming.js';

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const goal = (over) => ({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 0 }, ...over });
const item = (over) => ({ id: 'i1', title: 'Item', status: 'open', ...over });

describe('upcoming — collectUpcoming buckets', () => {
  it('buckets an overdue goal', () => {
    const goals = { '2026': { capstone: [goal({ dueDate: isoDaysFromNow(-1) })], milestones: [], wow: [], focus: [] } };
    const { overdue, today, tomorrow } = collectUpcoming({ goals, lists: [] });
    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toMatchObject({ kind: 'goal', id: 'g1', title: 'Goal', year: '2026', section: 'capstone' });
    expect(today).toHaveLength(0);
    expect(tomorrow).toHaveLength(0);
  });

  it('attaches a days-overdue detail to an overdue goal', () => {
    const goals = { '2026': { capstone: [goal({ dueDate: isoDaysFromNow(-4) })], milestones: [], wow: [], focus: [] } };
    const { overdue } = collectUpcoming({ goals, lists: [] });
    expect(overdue[0].detail).toEqual({ kind: 'overdue', days: 4 });
  });

  it('attaches a days-overdue detail to an overdue list item too', () => {
    const lists = [{ id: 'l1', name: 'Admin', items: [item({ dueDate: isoDaysFromNow(-2) })] }];
    const { overdue } = collectUpcoming({ goals: {}, lists });
    expect(overdue[0].detail).toEqual({ kind: 'overdue', days: 2 });
  });

  it('attaches no detail to a goal or item with no due date and no frequency shortfall', () => {
    const goals = { '2026': { capstone: [goal({ dueDate: isoDaysFromNow(0) })], milestones: [], wow: [], focus: [] } };
    const lists = [{ id: 'l1', name: 'Admin', items: [item({ dueDate: isoDaysFromNow(0) })] }];
    const { today } = collectUpcoming({ goals, lists });
    expect(today.every(e => e.detail === undefined)).toBe(true);
  });

  it('buckets a today goal', () => {
    const goals = { '2026': { capstone: [], milestones: [goal({ dueDate: isoDaysFromNow(0) })], wow: [], focus: [] } };
    const { today } = collectUpcoming({ goals, lists: [] });
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ section: 'milestones' });
  });

  it('buckets a goal due tomorrow, distinct from the rest of the week bucket', () => {
    const goals = {
      '2026': {
        capstone: [
          goal({ id: 'tmr', dueDate: isoDaysFromNow(1) }),
          goal({ id: 'later-this-week', dueDate: isoDaysFromNow(5) }),
        ],
        milestones: [], wow: [], focus: [],
      },
    };
    const { tomorrow } = collectUpcoming({ goals, lists: [] });
    expect(tomorrow.map(e => e.id)).toEqual(['tmr']);
  });

  it('excludes archived goals entirely, even if overdue', () => {
    const goals = { '2026': { capstone: [goal({ dueDate: isoDaysFromNow(-1), archived: true })], milestones: [], wow: [], focus: [] } };
    const { overdue } = collectUpcoming({ goals, lists: [] });
    expect(overdue).toHaveLength(0);
  });

  it('excludes a 100%-complete goal even with a lapsed due date', () => {
    const goals = { '2026': { capstone: [goal({ dueDate: isoDaysFromNow(-1), tracking: { type: 'percentage', value: 100 } })], milestones: [], wow: [], focus: [] } };
    const { overdue } = collectUpcoming({ goals, lists: [] });
    expect(overdue).toHaveLength(0);
  });

  it('buckets an overdue list item', () => {
    const lists = [{ id: 'l1', name: 'Admin', items: [item({ dueDate: isoDaysFromNow(-2) })] }];
    const { overdue } = collectUpcoming({ goals: {}, lists });
    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toMatchObject({ kind: 'item', id: 'i1', title: 'Item', listId: 'l1', listName: 'Admin' });
  });

  it('includes overdue items from an archived list', () => {
    const lists = [{ id: 'l1', name: 'Old stuff', archived: true, items: [item({ dueDate: isoDaysFromNow(-2) })] }];
    const { overdue } = collectUpcoming({ goals: {}, lists });
    expect(overdue).toHaveLength(1);
  });

  it('excludes done and closed items', () => {
    const lists = [{ id: 'l1', name: 'Admin', items: [
      item({ id: 'a', status: 'done', dueDate: isoDaysFromNow(-1) }),
      item({ id: 'b', status: 'closed', dueDate: isoDaysFromNow(0) }),
    ] }];
    const { overdue, today } = collectUpcoming({ goals: {}, lists });
    expect(overdue).toHaveLength(0);
    expect(today).toHaveLength(0);
  });

  it('ignores items and goals with no due date, or due far in the future', () => {
    const goals = { '2026': { capstone: [goal({}), goal({ id: 'g2', dueDate: isoDaysFromNow(60) })], milestones: [], wow: [], focus: [] } };
    const lists = [{ id: 'l1', name: 'Admin', items: [item({}), item({ id: 'i2', dueDate: isoDaysFromNow(60) })] }];
    const { overdue, today, tomorrow } = collectUpcoming({ goals, lists });
    expect(overdue).toHaveLength(0);
    expect(today).toHaveLength(0);
    expect(tomorrow).toHaveLength(0);
  });

  it('spans multiple years', () => {
    const goals = {
      '2025': { capstone: [goal({ id: 'past-year', dueDate: isoDaysFromNow(-1) })], milestones: [], wow: [], focus: [] },
      '2027': { capstone: [goal({ id: 'future-year', dueDate: isoDaysFromNow(0) })], milestones: [], wow: [], focus: [] },
    };
    // Neither 2025 nor 2027 is the real current year, so both default to
    // deadlines-hidden (see deadline-visibility.js) unless explicitly shown —
    // this test is about cross-year aggregation itself, not the default.
    const goalsDeadlinesVisible = { '2025': 'full', '2027': 'full' };
    const { overdue, today } = collectUpcoming({ goals, lists: [], goalsDeadlinesVisible });
    expect(overdue.map(e => e.id)).toEqual(['past-year']);
    expect(today.map(e => e.id)).toEqual(['future-year']);
  });

  it('excludes a year whose deadlines are hidden, even if it has genuinely overdue goals', () => {
    const goals = {
      '2025': { capstone: [goal({ id: 'past-year', dueDate: isoDaysFromNow(-1) })], milestones: [], wow: [], focus: [] },
    };
    const { overdue } = collectUpcoming({ goals, lists: [], goalsDeadlinesVisible: { '2025': 'off' } });
    expect(overdue).toHaveLength(0);
  });

  it('excludes a list whose deadlines are hidden, even if it has genuinely overdue items', () => {
    const lists = [{ id: 'l1', name: 'Admin', items: [item({ dueDate: isoDaysFromNow(-1) })] }];
    const { overdue } = collectUpcoming({ goals: {}, lists, listsDeadlinesVisible: { l1: false } });
    expect(overdue).toHaveLength(0);
  });

  it('includes a year at \'warn\' — this function only ever reads the icon-facing bucket, which \'warn\' never suppresses', () => {
    const goals = {
      '2025': { capstone: [goal({ id: 'warn-year', dueDate: isoDaysFromNow(-1) })], milestones: [], wow: [], focus: [] },
    };
    const { overdue } = collectUpcoming({ goals, lists: [], goalsDeadlinesVisible: { '2025': 'warn' } });
    expect(overdue.map(e => e.id)).toEqual(['warn-year']);
  });
});

describe('upcoming — frequency goals feed the same buckets as dueDate', () => {
  // 2026-08-10 is a Monday, matching frequency-urgency.test.js's own fixture week.
  const MON = new Date(2026, 7, 10);

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('buckets an Nx-mode weekly goal as today at slack == 0 while still recoverable', () => {
    vi.setSystemTime(new Date(2026, 7, 14)); // Friday — 3 days left, target 3, slack 0, still fully catchable
    const goals = { '2026': { capstone: [goal({ id: 'g1', tracking: { type: 'weekly', target: 3, entries: [], reminderDays: 'any' } })], milestones: [], wow: [], focus: [] } };
    const { today, overdue } = collectUpcoming({ goals, lists: [] });
    expect(today.map(e => e.id)).toEqual(['g1']);
    expect(overdue).toHaveLength(0);
  });

  it('buckets an Nx-mode weekly goal as tomorrow at slack == 1, not counted toward the badge', () => {
    vi.setSystemTime(new Date(2026, 7, 13)); // Thursday — 4 days left, target 3, slack 1
    const goals = { '2026': { capstone: [goal({ id: 'g1', tracking: { type: 'weekly', target: 3, entries: [], reminderDays: 'any' } })], milestones: [], wow: [], focus: [] } };
    const { tomorrow, today, overdue } = collectUpcoming({ goals, lists: [] });
    expect(tomorrow.map(e => e.id)).toEqual(['g1']);
    expect(today).toHaveLength(0);
    expect(overdue).toHaveLength(0);
    expect(upcomingBadgeCount({ today, overdue })).toBe(0);
  });

  it('buckets a scheduled-days goal as today after a still-recoverable miss', () => {
    vi.setSystemTime(new Date(2026, 7, 11)); // Tuesday — Monday was scheduled and missed, but 6 days remain for the 3 needed
    const goals = { '2026': { capstone: [goal({ id: 'g1', tracking: { type: 'weekly', target: 3, entries: [], reminderDays: ['mon', 'wed', 'fri'] } })], milestones: [], wow: [], focus: [] } };
    const { today, overdue } = collectUpcoming({ goals, lists: [] });
    expect(today.map(e => e.id)).toEqual(['g1']);
    expect(overdue).toHaveLength(0);
  });

  it('attaches a "count" detail for an Any-mode frequency shortfall even while bucketed as today, with no dueDate involved', () => {
    vi.setSystemTime(new Date(2026, 7, 14)); // Friday — 3 days left, target 3, slack 0
    const goals = { '2026': { capstone: [goal({ id: 'g1', tracking: { type: 'weekly', target: 3, entries: [], reminderDays: 'any' } })], milestones: [], wow: [], focus: [] } };
    const { today } = collectUpcoming({ goals, lists: [] });
    expect(today[0].detail).toEqual({ kind: 'count', count: 3 });
  });

  it('attaches a "days" detail for a scheduled-days frequency miss even while bucketed as today', () => {
    vi.setSystemTime(new Date(2026, 7, 11)); // Tuesday — Monday was scheduled and missed
    const goals = { '2026': { capstone: [goal({ id: 'g1', tracking: { type: 'weekly', target: 3, entries: [], reminderDays: ['mon', 'wed', 'fri'] } })], milestones: [], wow: [], focus: [] } };
    const { today } = collectUpcoming({ goals, lists: [] });
    expect(today[0].detail.kind).toBe('days');
    expect(today[0].detail.days.find(d => d.wd === 'mon').state).toBe('missed');
  });

  it('prefers the dueDate detail over the frequency one when a goal is overdue by both', () => {
    vi.setSystemTime(new Date(2026, 7, 14)); // Friday — Any-mode slack 0 too
    const goals = { '2026': { capstone: [goal({
      id: 'g1', dueDate: '2026-08-10', // 4 days overdue by Friday
      tracking: { type: 'weekly', target: 3, entries: [], reminderDays: 'any' },
    })], milestones: [], wow: [], focus: [] } };
    const { overdue } = collectUpcoming({ goals, lists: [] });
    expect(overdue[0].detail).toEqual({ kind: 'overdue', days: 4 });
  });

  it('buckets a scheduled-days goal as today when today itself is scheduled', () => {
    vi.setSystemTime(MON);
    const goals = { '2026': { capstone: [goal({ id: 'g1', tracking: { type: 'weekly', target: 3, entries: [], reminderDays: ['mon', 'wed', 'fri'] } })], milestones: [], wow: [], focus: [] } };
    const { today } = collectUpcoming({ goals, lists: [] });
    expect(today.map(e => e.id)).toEqual(['g1']);
  });

  it('buckets a scheduled-days goal as tomorrow when nothing is missed and tomorrow is scheduled', () => {
    vi.setSystemTime(new Date(2026, 7, 13)); // Thursday, tomorrow (Friday) scheduled
    const goals = { '2026': { capstone: [goal({ id: 'g1', tracking: { type: 'weekly', target: 1, entries: [], reminderDays: ['fri'] } })], milestones: [], wow: [], focus: [] } };
    const { tomorrow } = collectUpcoming({ goals, lists: [] });
    expect(tomorrow.map(e => e.id)).toEqual(['g1']);
  });

  it('buckets a scheduled-days goal as overdue even once recovery is mathematically impossible — the dialog no longer distinguishes', () => {
    vi.setSystemTime(new Date(2026, 7, 15)); // Saturday — mon/wed/fri all missed, target 3, only 2 days left
    const goals = { '2026': { capstone: [goal({ id: 'g1', tracking: { type: 'weekly', target: 3, entries: [], reminderDays: ['mon', 'wed', 'fri'] } })], milestones: [], wow: [], focus: [] } };
    const { overdue, today, tomorrow } = collectUpcoming({ goals, lists: [] });
    expect(overdue.map(e => e.id)).toEqual(['g1']); // still actionable — logging today clears it, see notification-digest/row-facing tests
    expect(today).toHaveLength(0);
    expect(tomorrow).toHaveLength(0);
  });

  it('shows the worse of dueDate and frequency pace — a lapsed deadline wins even when frequency pace itself is quiet', () => {
    vi.setSystemTime(MON); // plenty of frequency slack (quiet), but the deadline already passed
    const goals = { '2026': { capstone: [goal({ id: 'g1', dueDate: '2026-08-01', tracking: { type: 'weekly', target: 3, entries: [], reminderDays: 'any' } })], milestones: [], wow: [], focus: [] } };
    const { overdue } = collectUpcoming({ goals, lists: [] });
    expect(overdue.map(e => e.id)).toEqual(['g1']);
  });

  it('a monthly goal participates without ever setting reminderDays — unconditional, no opt-in', () => {
    vi.setSystemTime(new Date(2026, 7, 22)); // Aug 22: 10 days left, target 10, slack 0, still exactly recoverable
    const goals = { '2026': { capstone: [goal({ id: 'g1', tracking: { type: 'monthly', target: 10, entries: [] } })], milestones: [], wow: [], focus: [] } };
    const { today, overdue } = collectUpcoming({ goals, lists: [] });
    expect(today.map(e => e.id)).toEqual(['g1']);
    expect(overdue).toHaveLength(0);
  });
});

describe('upcoming — upcomingBadgeCount', () => {
  it('sums overdue and today, excluding tomorrow', () => {
    const count = upcomingBadgeCount({
      overdue: [{ id: '1' }, { id: '2' }],
      today: [{ id: '3' }],
      tomorrow: [{ id: '4' }, { id: '5' }, { id: '6' }],
    });
    expect(count).toBe(3);
  });

  it('is zero when nothing is upcoming', () => {
    expect(upcomingBadgeCount({ overdue: [], today: [], tomorrow: [] })).toBe(0);
  });
});

describe('upcoming — collectHiddenUrgent (the exact inverse gating of collectUpcoming)', () => {
  it('is empty when nothing is hidden', () => {
    const goals = { '2026': { capstone: [goal({ dueDate: isoDaysFromNow(-1) })], milestones: [], wow: [], focus: [] } };
    expect(collectHiddenUrgent({ goals, lists: [], goalsDeadlinesVisible: { 2026: 'full' } })).toEqual([]);
  });

  it('includes an overdue goal from a year whose deadlines are hidden', () => {
    const goals = { '2025': { capstone: [goal({ dueDate: isoDaysFromNow(-1) })], milestones: [], wow: [], focus: [] } };
    const hidden = collectHiddenUrgent({ goals, lists: [], goalsDeadlinesVisible: { 2025: 'off' } });
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toMatchObject({ kind: 'goal', id: 'g1', title: 'Goal', year: '2025', section: 'capstone' });
  });

  it('is empty for a year at \'warn\' — not "hidden" in this sense, it already gets full normal placement in collectUpcoming', () => {
    const goals = { '2025': { capstone: [goal({ dueDate: isoDaysFromNow(-1) })], milestones: [], wow: [], focus: [] } };
    expect(collectHiddenUrgent({ goals, lists: [], goalsDeadlinesVisible: { 2025: 'warn' } })).toEqual([]);
  });

  it('includes a today goal too, not just overdue', () => {
    const goals = { '2025': { capstone: [goal({ dueDate: isoDaysFromNow(0) })], milestones: [], wow: [], focus: [] } };
    const hidden = collectHiddenUrgent({ goals, lists: [], goalsDeadlinesVisible: { 2025: 'off' } });
    expect(hidden).toHaveLength(1);
  });

  it('excludes a tomorrow goal — second-class list is overdue/today only', () => {
    const goals = { '2025': { capstone: [goal({ dueDate: isoDaysFromNow(1) })], milestones: [], wow: [], focus: [] } };
    const hidden = collectHiddenUrgent({ goals, lists: [], goalsDeadlinesVisible: { 2025: 'off' } });
    expect(hidden).toHaveLength(0);
  });

  it('never attaches entry.detail — deliberately simpler than collectUpcoming\'s entries', () => {
    const goals = { '2025': { capstone: [goal({ dueDate: isoDaysFromNow(-4) })], milestones: [], wow: [], focus: [] } };
    const hidden = collectHiddenUrgent({ goals, lists: [], goalsDeadlinesVisible: { 2025: 'off' } });
    expect(hidden[0].detail).toBeUndefined();
  });

  it('includes an overdue item from a list whose deadlines are hidden', () => {
    const lists = [{ id: 'l1', name: 'Admin', items: [item({ dueDate: isoDaysFromNow(-1) })] }];
    const hidden = collectHiddenUrgent({ goals: {}, lists, listsDeadlinesVisible: { l1: false } });
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toMatchObject({ kind: 'item', id: 'i1', title: 'Item', listId: 'l1', listName: 'Admin' });
  });

  it('excludes an overdue item from a list whose deadlines are visible', () => {
    const lists = [{ id: 'l1', name: 'Admin', items: [item({ dueDate: isoDaysFromNow(-1) })] }];
    const hidden = collectHiddenUrgent({ goals: {}, lists, listsDeadlinesVisible: { l1: true } });
    expect(hidden).toHaveLength(0);
  });

  it('respects the same defaults as collectUpcoming — a year/list absent from the map uses yearDeadlinesVisible/listDeadlinesVisible defaults', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
    // 2020 isn't the real current year, so it defaults hidden — no explicit map entry needed.
    const goals = { '2020': { capstone: [goal({ dueDate: '2020-01-01' })], milestones: [], wow: [], focus: [] } };
    const hidden = collectHiddenUrgent({ goals, lists: [] });
    expect(hidden).toHaveLength(1);
    vi.useRealTimers();
  });
});
