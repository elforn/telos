// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import '../../app/strings.js';
import '../../app/components/hidden-items-dialog/hidden-items-dialog.js';

function mount() {
  const el = document.createElement('hidden-items-dialog');
  document.body.appendChild(el);
  el._dialog.show  = vi.fn();
  el._dialog.close = vi.fn();
  return el;
}

const GOAL_ENTRY = { kind: 'goal', id: 'g1', title: 'Ship investor deck', year: '2025', section: 'capstone' };
const ITEM_ENTRY = { kind: 'item', id: 'i1', title: 'Renew passport', listId: 'l1', listName: 'Admin' };

afterEach(() => { document.body.innerHTML = ''; });

describe('hidden-items-dialog — structure', () => {
  it('renders a real heading for the dialog title', () => {
    const el = mount();
    const title = el.shadowRoot.querySelector('.hidden-title');
    expect(title.tagName).toBe('H2');
    expect(title.textContent).toBe('Hidden items');
  });

  it('shows the empty state when opened with nothing', () => {
    const el = mount();
    el.open([]);
    expect(el.shadowRoot.querySelector('#hidden-empty').hidden).toBe(false);
    expect(el.shadowRoot.querySelectorAll('.hidden-row')).toHaveLength(0);
  });

  it('hides the empty state and renders a row per entry', () => {
    const el = mount();
    el.open([GOAL_ENTRY, ITEM_ENTRY]);
    expect(el.shadowRoot.querySelector('#hidden-empty').hidden).toBe(true);
    expect(el.shadowRoot.querySelectorAll('.hidden-row')).toHaveLength(2);
  });

  it('renders a goal row with a title and a Goal/year/section sublabel', () => {
    const el = mount();
    el.open([GOAL_ENTRY]);
    const row = el.shadowRoot.querySelector('.hidden-row');
    expect(row.querySelector('.hidden-row-title').textContent).toBe('Ship investor deck');
    expect(row.querySelector('.hidden-row-sub').textContent).toBe('Goal · 2025 · Capstone');
  });

  it('renders an item row with a title and a List/name sublabel', () => {
    const el = mount();
    el.open([ITEM_ENTRY]);
    const row = el.shadowRoot.querySelector('.hidden-row');
    expect(row.querySelector('.hidden-row-title').textContent).toBe('Renew passport');
    expect(row.querySelector('.hidden-row-sub').textContent).toBe('List · Admin');
  });

  it('open() shows the wrapped modal-dialog', () => {
    const el = mount();
    el.open([GOAL_ENTRY]);
    expect(el._dialog.show).toHaveBeenCalledOnce();
  });

  it('does not render any per-row urgency colour or icon — deliberately plain, unlike upcoming-dialog', () => {
    const el = mount();
    el.open([GOAL_ENTRY]);
    const row = el.shadowRoot.querySelector('.hidden-row');
    expect(row.querySelector('svg')).toBeNull();
    expect(row.dataset.urgency).toBeUndefined();
  });
});

describe('hidden-items-dialog — row tap', () => {
  it('tapping a goal row dispatches upcoming-row-tap with kind/id/year/section — same event name upcoming-dialog uses', () => {
    const el = mount();
    el.open([GOAL_ENTRY]);
    const spy = vi.fn();
    el.addEventListener('upcoming-row-tap', e => spy(e.detail));
    el.shadowRoot.querySelector('.hidden-row').click();
    expect(spy).toHaveBeenCalledWith({ kind: 'goal', id: 'g1', year: '2025', section: 'capstone' });
  });

  it('tapping an item row dispatches upcoming-row-tap with kind/id/listId', () => {
    const el = mount();
    el.open([ITEM_ENTRY]);
    const spy = vi.fn();
    el.addEventListener('upcoming-row-tap', e => spy(e.detail));
    el.shadowRoot.querySelector('.hidden-row').click();
    expect(spy).toHaveBeenCalledWith({ kind: 'item', id: 'i1', listId: 'l1' });
  });

  it('tapping a row closes the dialog', () => {
    const el = mount();
    el.open([GOAL_ENTRY]);
    el.shadowRoot.querySelector('.hidden-row').click();
    expect(el._dialog.close).toHaveBeenCalledOnce();
  });
});

describe('hidden-items-dialog — close', () => {
  it('the Close button closes the dialog', () => {
    const el = mount();
    el.open([GOAL_ENTRY]);
    el.shadowRoot.querySelector('#hidden-close-btn').click();
    expect(el._dialog.close).toHaveBeenCalledOnce();
  });
});
