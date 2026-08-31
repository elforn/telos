import { describe, it, expect } from 'vitest';
import { collectUpcoming, upcomingBadgeCount } from '../../app/utils/upcoming.js';

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
    const { overdue, today } = collectUpcoming({ goals, lists: [] });
    expect(overdue.map(e => e.id)).toEqual(['past-year']);
    expect(today.map(e => e.id)).toEqual(['future-year']);
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
