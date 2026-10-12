// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/goal-picker-dialog/goal-picker-dialog.js';

function g(id, title, value = 0) {
  return { id, title, tags: [], tracking: { type: 'percentage', value } };
}
function group(id, title, memberIds, year = '2026', section = 'focus') {
  return {
    id, title, tags: [],
    tracking: { type: 'aggregate', members: memberIds.map(goalId => ({ year, section, goalId })) },
  };
}

function mount(availableGoals, { selfId = null, existingMembers = [] } = {}) {
  const el = document.createElement('goal-picker-dialog');
  document.body.appendChild(el);
  const modal = el.shadowRoot.querySelector('#modal');
  modal.show = vi.fn();
  modal.close = vi.fn();
  el.availableGoals = availableGoals;
  el.selfId = selfId;
  el.existingMembers = existingMembers;
  el.show();
  return el;
}

const rows = el => [...el.shadowRoot.querySelectorAll('.row')];
const titles = el => rows(el).map(r => r.querySelector('.row-title').textContent);

const FLAT = [
  { year: '2026', section: 'milestones', goal: g('m1', 'Outline', 100) },
  { year: '2026', section: 'focus',      goal: g('f1', 'First draft', 42) },
  { year: '2027', section: 'capstone',   goal: g('c1', 'Publish', 0) },
];

describe('goal-picker-dialog', () => {
  it('lists every available goal with its context and percentage', () => {
    const el = mount(FLAT);
    expect(titles(el)).toEqual(['Publish', 'Outline', 'First draft']);
    const first = rows(el)[0];
    expect(first.querySelector('.row-sub').textContent).toBe('Goal · 2027 · Capstone');
    expect(first.querySelector('.row-pct').textContent).toBe('0%');
  });

  it('groups rows under a year heading, newest year first', () => {
    const el = mount(FLAT);
    const heads = [...el.shadowRoot.querySelectorAll('.year-head')].map(h => h.textContent);
    expect(heads).toEqual(['2027', '2026']);
  });

  it('excludes the goal being edited', () => {
    const avail = [...FLAT, { year: '2026', section: 'capstone', goal: group('agg1', 'Ship it', []) }];
    const el = mount(avail, { selfId: 'agg1' });
    expect(titles(el)).not.toContain('Ship it');
  });

  it('excludes goals that are already members', () => {
    const el = mount(FLAT, { existingMembers: [{ year: '2026', section: 'focus', goalId: 'f1' }] });
    expect(titles(el)).toEqual(['Publish', 'Outline']);
  });

  it('excludes a candidate that would close a cycle', () => {
    // outer already contains inner; offering outer as a member of inner
    // would make inner -> outer -> inner.
    const avail = [
      { year: '2026', section: 'focus',    goal: g('leaf', 'Leaf', 10) },
      { year: '2026', section: 'focus',    goal: group('inner', 'Inner', ['leaf']) },
      { year: '2026', section: 'capstone', goal: group('outer', 'Outer', ['inner']) },
    ];
    const el = mount(avail, { selfId: 'inner' });
    expect(titles(el)).toContain('Leaf');
    expect(titles(el)).not.toContain('Outer');
    expect(titles(el)).not.toContain('Inner');
  });

  it('allows a diamond — sharing a member is not a cycle', () => {
    const avail = [
      { year: '2026', section: 'focus',      goal: g('leaf', 'Leaf', 10) },
      { year: '2026', section: 'focus',      goal: group('mine', 'Mine', ['leaf']) },
      { year: '2026', section: 'milestones', goal: group('sibling', 'Sibling', ['leaf']) },
    ];
    const el = mount(avail, { selfId: 'mine' });
    expect(titles(el)).toContain('Sibling');
  });

  it('shows an empty message when nothing is pickable', () => {
    const el = mount([{ year: '2026', section: 'focus', goal: group('agg1', 'Only me', []) }], { selfId: 'agg1' });
    expect(el.shadowRoot.querySelector('#empty-msg').hidden).toBe(false);
    expect(rows(el)).toHaveLength(0);
  });

  it('starts with the Add button disabled and no count row', () => {
    const el = mount(FLAT);
    expect(el.shadowRoot.querySelector('#add-btn').disabled).toBe(true);
    expect(el.shadowRoot.querySelector('#count-row').hidden).toBe(true);
  });

  it('toggles selection, reflects it in aria-selected, and counts it', () => {
    const el = mount(FLAT);
    const row = rows(el)[0];
    row.click();
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(row.classList.contains('selected')).toBe(true);
    expect(el.shadowRoot.querySelector('#add-btn').disabled).toBe(false);
    expect(el.shadowRoot.querySelector('#count').textContent).toBe('1 selected');

    row.click();
    expect(row.getAttribute('aria-selected')).toBe('false');
    expect(el.shadowRoot.querySelector('#add-btn').disabled).toBe(true);
  });

  it('clears every selection', () => {
    const el = mount(FLAT);
    rows(el)[0].click();
    rows(el)[1].click();
    el.shadowRoot.querySelector('#clear-btn').click();
    expect(rows(el).every(r => r.getAttribute('aria-selected') === 'false')).toBe(true);
    expect(el.shadowRoot.querySelector('#add-btn').disabled).toBe(true);
  });

  it('emits the picked references and closes', () => {
    const el = mount(FLAT);
    const seen = [];
    el.addEventListener('goal-pick', e => seen.push(e.detail));
    rows(el)[0].click(); // 2027 Publish
    rows(el)[2].click(); // 2026 First draft
    el.shadowRoot.querySelector('#add-btn').click();

    expect(seen).toHaveLength(1);
    expect(seen[0].refs).toEqual([
      { year: '2027', section: 'capstone', goalId: 'c1' },
      { year: '2026', section: 'focus', goalId: 'f1' },
    ]);
    expect(el.shadowRoot.querySelector('#modal').close).toHaveBeenCalled();
  });

  it('resets its selection between opens', () => {
    const el = mount(FLAT);
    rows(el)[0].click();
    el.show();
    expect(el.shadowRoot.querySelector('#add-btn').disabled).toBe(true);
    expect(rows(el).every(r => r.getAttribute('aria-selected') === 'false')).toBe(true);
  });

  it('treats a brand-new goal with no id as having no cycle risk', () => {
    const avail = [{ year: '2026', section: 'focus', goal: group('other', 'Other', []) }];
    const el = mount(avail, { selfId: null });
    expect(titles(el)).toEqual(['Other']);
  });
});


describe('goal-picker-dialog — listbox keyboard model', () => {
  const rows = el => [...el.shadowRoot.querySelectorAll('.row')];
  const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  it('is one tab stop for the whole list, not one per row', () => {
    const el = mount(FLAT);
    expect(rows(el).map(r => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it('arrows move within the list', () => {
    const el = mount(FLAT);
    key(rows(el)[0], 'ArrowDown');
    expect(rows(el).map(r => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('a year heading between groups does not break the arrow path', () => {
    // The headings are not options, so stepping past one must still land on
    // the next real row.
    const el = mount(FLAT);
    key(rows(el)[0], 'End');
    expect(rows(el).map(r => r.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('re-syncs the tab stop on every open', () => {
    const el = mount(FLAT);
    key(rows(el)[0], 'End');
    el.show();
    expect(rows(el).map(r => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it('leaves Enter and Space to the button, so selection still works', () => {
    const el = mount(FLAT);
    rows(el)[0].click(); // what Enter/Space dispatch natively
    expect(rows(el)[0].getAttribute('aria-selected')).toBe('true');
    expect(el.shadowRoot.querySelector('#add-btn').disabled).toBe(false);
  });
});
