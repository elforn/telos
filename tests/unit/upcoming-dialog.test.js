// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import '../../app/strings.js';
import '../../app/components/upcoming-dialog/upcoming-dialog.js';

function mount() {
  const el = document.createElement('upcoming-dialog');
  document.body.appendChild(el);
  el._dialog.show  = vi.fn();
  el._dialog.close = vi.fn();
  return el;
}

const GOAL_ENTRY = { kind: 'goal', id: 'g1', title: 'Ship investor deck', year: '2026', section: 'capstone' };
const ITEM_ENTRY = { kind: 'item', id: 'i1', title: 'Renew passport', listId: 'l1', listName: 'Admin' };

afterEach(() => { document.body.innerHTML = ''; });

describe('upcoming-dialog — structure', () => {
  it('renders a real heading for the dialog title', () => {
    const el = mount();
    const title = el.shadowRoot.querySelector('.upcoming-title');
    expect(title.tagName).toBe('H2');
    expect(title.textContent).toBe('Upcoming');
  });

  it('shows the empty state when nothing is upcoming', () => {
    const el = mount();
    el.open({ overdue: [], today: [], tomorrow: [] });
    expect(el.shadowRoot.querySelector('#upcoming-empty').hidden).toBe(false);
    expect(el.shadowRoot.querySelectorAll('.upcoming-row')).toHaveLength(0);
  });

  it('hides the empty state and renders a section + row when something is overdue', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    expect(el.shadowRoot.querySelector('#upcoming-empty').hidden).toBe(true);
    const heads = el.shadowRoot.querySelectorAll('.upcoming-section-head');
    expect(heads).toHaveLength(1);
    expect(heads[0].querySelector('.upcoming-section-label').textContent).toBe('Overdue');
    expect(heads[0].querySelector('.upcoming-section-count').textContent).toBe('1');
    expect(el.shadowRoot.querySelectorAll('.upcoming-row')).toHaveLength(1);
  });

  it('only renders sections that have entries, in overdue/today/tomorrow order', () => {
    const el = mount();
    el.open({ overdue: [], today: [{ ...GOAL_ENTRY, id: 'g2' }], tomorrow: [ITEM_ENTRY] });
    const labels = [...el.shadowRoot.querySelectorAll('.upcoming-section-label')].map(l => l.textContent);
    expect(labels).toEqual(['Today', 'Tomorrow']);
  });

  it('renders a goal row with a title and a Goal/year/section sublabel', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    const row = el.shadowRoot.querySelector('.upcoming-row');
    expect(row.querySelector('.upcoming-row-title').textContent).toBe('Ship investor deck');
    expect(row.querySelector('.upcoming-row-sub').textContent).toBe('Goal · 2026 · Capstone');
  });

  it('renders an item row with a title and a List/name sublabel', () => {
    const el = mount();
    el.open({ overdue: [ITEM_ENTRY], today: [], tomorrow: [] });
    const row = el.shadowRoot.querySelector('.upcoming-row');
    expect(row.querySelector('.upcoming-row-title').textContent).toBe('Renew passport');
    expect(row.querySelector('.upcoming-row-sub').textContent).toBe('List · Admin');
  });

  it('open() shows the wrapped modal-dialog', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    expect(el._dialog.show).toHaveBeenCalledOnce();
  });
});

describe('upcoming-dialog — row tap', () => {
  it('tapping a goal row dispatches upcoming-row-tap with kind/id/year/section', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    let detail = null;
    el.addEventListener('upcoming-row-tap', e => { detail = e.detail; });
    el.shadowRoot.querySelector('.upcoming-row').click();
    expect(detail).toEqual({ kind: 'goal', id: 'g1', year: '2026', section: 'capstone' });
  });

  it('tapping an item row dispatches upcoming-row-tap with kind/id/listId', () => {
    const el = mount();
    el.open({ overdue: [ITEM_ENTRY], today: [], tomorrow: [] });
    let detail = null;
    el.addEventListener('upcoming-row-tap', e => { detail = e.detail; });
    el.shadowRoot.querySelector('.upcoming-row').click();
    expect(detail).toEqual({ kind: 'item', id: 'i1', listId: 'l1' });
  });

  it('tapping a row closes the dialog', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    el.shadowRoot.querySelector('.upcoming-row').click();
    expect(el._dialog.close).toHaveBeenCalledOnce();
  });

  it('the Close button closes the dialog', () => {
    const el = mount();
    el.open({ overdue: [], today: [], tomorrow: [] });
    el.shadowRoot.querySelector('#upcoming-close-btn').click();
    expect(el._dialog.close).toHaveBeenCalledOnce();
  });
});
