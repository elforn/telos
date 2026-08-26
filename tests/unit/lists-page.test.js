// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { boot, setState, getState, setRuntimeState, reset } from '../../_lib/core/store/store.js';
import '../../app/strings.js';
import '../../app/pages/lists-page.js';
import '../../app/components/list-dialog/list-dialog.js';
import { COLOR_PALETTE } from '../../app/utils/color-palette.js';
import { _resetToast } from '../../_lib/modules/toast/toast.js';

HTMLElement.prototype.setPointerCapture    = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

let dbSeq = 0;
function freshName() { return `lists-page-test-${dbSeq++}`; }

function mount() {
  const el = document.createElement('lists-page');
  document.body.appendChild(el);
  // Stub modal-dialog's show/close so it doesn't try to call native dialog methods
  const dialog = el.shadowRoot.querySelector('#dialog');
  if (dialog?.shadowRoot) {
    const modal = dialog.shadowRoot.querySelector('#modal');
    if (modal) {
      modal.show  = vi.fn();
      modal.close = vi.fn(() =>
        modal.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }))
      );
    }
  }
  return el;
}

// Access helpers for lists-page-item internals
function getItems(el) {
  return [...el.shadowRoot.querySelector('#list-container').querySelectorAll('lists-page-item')];
}

function getItemInner(item, selector) {
  return item.shadowRoot.querySelector(selector);
}

beforeEach(() => reset());
afterEach(() => { document.body.innerHTML = ''; });

describe('lists-page — structure', () => {
  it('renders a <main> landmark', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('main')).not.toBeNull();
  });

  it('renders the list container', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#list-container')).not.toBeNull();
  });

  it('add row is present and has visible text', () => {
    const el = mount();
    const btn = el.shadowRoot.querySelector('#add-row');
    expect(btn).not.toBeNull();
    expect(btn.textContent.trim()).toContain('+');
  });
});

describe('lists-page — rendering', () => {
  it('renders a row for each list', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [
      { id: 'l1', name: 'Gift ideas', items: [] },
      { id: 'l2', name: 'Books', items: [] },
    ]);
    await vi.waitFor(() => expect(getItems(el).length).toBe(2));
  });

  it('renders list name in each row', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Gift ideas', items: [] }]);
    await vi.waitFor(() => {
      const item = getItems(el)[0];
      return expect(getItemInner(item, '.list-name')?.textContent).toBe('Gift ideas');
    });
  });

  it('reuses existing row element on update (reconciliation)', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Original', items: [] }]);
    await vi.waitFor(() => expect(getItems(el).length).toBe(1));
    const firstItem = getItems(el)[0];
    setState('lists', [{ id: 'l1', name: 'Renamed', items: [] }]);
    await vi.waitFor(() =>
      expect(getItemInner(firstItem, '.list-name')?.textContent).toBe('Renamed')
    );
    expect(getItems(el)[0]).toBe(firstItem);
  });

  it('removes row when list is deleted from state', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Gift ideas', items: [] }]);
    await vi.waitFor(() => expect(getItems(el).length).toBe(1));
    setState('lists', []);
    await vi.waitFor(() => expect(getItems(el).length).toBe(0));
  });
});

describe('lists-page — create list', () => {
  it('creates a new list when list-created fires after add click', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    el.shadowRoot.querySelector('#add-row').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('list-created', {
      bubbles: true, composed: true, detail: { name: 'Reading list' },
    }));
    await vi.waitFor(() => expect(getItems(el).length).toBe(1));
    const item = getItems(el)[0];
    expect(getItemInner(item, '.list-name')?.textContent).toBe('Reading list');
  });

  it('persists the new list to the store', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    el.shadowRoot.querySelector('#add-row').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('list-created', {
      bubbles: true, composed: true, detail: { name: 'Ideas' },
    }));
    await vi.waitFor(() => expect(getItems(el).length).toBe(1));
    const lists = getState().lists;
    expect(lists).toHaveLength(1);
    expect(lists[0].name).toBe('Ideas');
    expect(lists[0].items).toEqual([]);
  });
});


describe('lists-page — accessibility', () => {
  it('list rows have role="button"', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Gift ideas', items: [] }]);
    await vi.waitFor(() => expect(getItems(el).length).toBe(1));
    const row = getItemInner(getItems(el)[0], '.row');
    expect(row.getAttribute('role')).toBe('button');
  });

  it('list row aria-label matches the list name', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Gift ideas', items: [] }]);
    await vi.waitFor(() => expect(getItems(el).length).toBe(1));
    expect(getItemInner(getItems(el)[0], '.row').getAttribute('aria-label')).toBe('Gift ideas');
  });

  it('list row aria-label updates when list is renamed', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Original', items: [] }]);
    await vi.waitFor(() => expect(getItems(el).length).toBe(1));
    setState('lists', [{ id: 'l1', name: 'Renamed', items: [] }]);
    await vi.waitFor(() =>
      expect(getItemInner(getItems(el)[0], '.row').getAttribute('aria-label')).toBe('Renamed')
    );
  });

  it('item count is displayed in each row', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Ideas', items: [
      { id: 'i1', title: 'a', status: 'open', tags: [], inGoals: [] },
      { id: 'i2', title: 'b', status: 'open', tags: [], inGoals: [] },
    ] }]);
    await vi.waitFor(() => expect(getItems(el).length).toBe(1));
    expect(getItemInner(getItems(el)[0], '.item-count').textContent).toBe('2');
  });
});

// ── _placeList ────────────────────────────────────────────────────────────────

describe('lists-page — _placeList', () => {
  it('moves a list forward in the array', async () => {
    const LA = { id: 'la', name: 'A', items: [] };
    const LB = { id: 'lb', name: 'B', items: [] };
    const LC = { id: 'lc', name: 'C', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [LA, LB, LC] } });
    const el = mount();
    el._placeList(0, 2);
    expect(getState().lists.map(l => l.id)).toEqual(['lb', 'la', 'lc']);
  });

  it('moves a list backward in the array', async () => {
    const LA = { id: 'la', name: 'A', items: [] };
    const LB = { id: 'lb', name: 'B', items: [] };
    const LC = { id: 'lc', name: 'C', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [LA, LB, LC] } });
    const el = mount();
    el._placeList(2, 0);
    expect(getState().lists.map(l => l.id)).toEqual(['lc', 'la', 'lb']);
  });

  it('is a no-op when fromIndex === toIndex', async () => {
    const LA = { id: 'la', name: 'A', items: [] };
    const LB = { id: 'lb', name: 'B', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [LA, LB] } });
    const el = mount();
    el._placeList(0, 0);
    expect(getState().lists.map(l => l.id)).toEqual(['la', 'lb']);
  });

  it('is a no-op when fromIndex === toIndex - 1 (drop on the same slot)', async () => {
    const LA = { id: 'la', name: 'A', items: [] };
    const LB = { id: 'lb', name: 'B', items: [] };
    const LC = { id: 'lc', name: 'C', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [LA, LB, LC] } });
    const el = mount();
    el._placeList(1, 2);
    expect(getState().lists.map(l => l.id)).toEqual(['la', 'lb', 'lc']);
  });
});

// ── color cycling ─────────────────────────────────────────────────────────────

describe('lists-page — color cycling', () => {
  it('advances color to the next palette entry on list-color-cycle event', async () => {
    const la = { id: 'la', name: 'A', items: [], color: COLOR_PALETTE[1] };
    await boot({ dbName: freshName(), initialState: { lists: [la] } });
    const el = mount();
    el._container.dispatchEvent(new CustomEvent('list-color-cycle', {
      bubbles: true, composed: true, detail: { list: la },
    }));
    expect(getState().lists[0].color).toBe(COLOR_PALETTE[2]);
  });

  it('wraps from last palette entry back to null', async () => {
    const lastColor = COLOR_PALETTE[COLOR_PALETTE.length - 1];
    const la = { id: 'la', name: 'A', items: [], color: lastColor };
    await boot({ dbName: freshName(), initialState: { lists: [la] } });
    const el = mount();
    el._container.dispatchEvent(new CustomEvent('list-color-cycle', {
      bubbles: true, composed: true, detail: { list: la },
    }));
    expect(getState().lists[0]).not.toHaveProperty('color');
  });

  it('advances from null (no color) to the first non-null color', async () => {
    const la = { id: 'la', name: 'A', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [la] } });
    const el = mount();
    el._container.dispatchEvent(new CustomEvent('list-color-cycle', {
      bubbles: true, composed: true, detail: { list: la },
    }));
    expect(getState().lists[0].color).toBe(COLOR_PALETTE[1]);
  });

  it('does not affect other lists when cycling one', async () => {
    const la = { id: 'la', name: 'A', items: [], color: COLOR_PALETTE[1] };
    const lb = { id: 'lb', name: 'B', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [la, lb] } });
    const el = mount();
    el._container.dispatchEvent(new CustomEvent('list-color-cycle', {
      bubbles: true, composed: true, detail: { list: la },
    }));
    expect(getState().lists.find(l => l.id === 'lb')).not.toHaveProperty('color');
  });
});

describe('lists-page — pending list undo toast', () => {
  it('shows the deleted list name in the toast and restores the snapshot on undo', async () => {
    _resetToast(); // drop the container cached from earlier tests (detached by afterEach)
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const snapshot = [{ id: 'l1', name: 'Groceries', items: [] }];
    mount();

    setRuntimeState('pendingListUndo', { snapshot, listName: 'Groceries' });

    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-info');
      expect(toastEl?.textContent).toContain('“Groceries” deleted');
    });

    document.querySelector('#toast-container .socle-toast-btn').click();
    expect(getState().lists).toEqual(snapshot);
    // handoff consumed so the toast doesn't re-fire on next mount
    expect(getState().pendingListUndo).toBeNull();
  });
});

describe('lists-page — create with active filter', () => {
  it('shows a hidden-by-filter toast whose Show action reveals the new list', async () => {
    _resetToast();
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    el._filter = { query: '', states: new Set(['not-empty']), dates: new Set() }; // a new list is empty → hidden
    el.shadowRoot.dispatchEvent(new CustomEvent('list-created', {
      bubbles: true, composed: true, detail: { name: 'Fresh list' },
    }));

    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-info');
      expect(toastEl?.textContent).toContain('hidden by the current filter');
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#list-container lists-page-item')?.hidden).toBe(true)
    );

    document.querySelector('#toast-container .socle-toast-btn').click();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#list-container lists-page-item')?.hidden).toBe(false)
    );
  });
});

describe('lists-page — date filter', () => {
  const iso = d => { const x = new Date(); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

  it('shows a list containing an item in the selected date bucket', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [
      { id: 'l1', name: 'Overdue list', items: [{ id: 'i1', title: 'x', status: 'open', tags: [], inGoals: [], dueDate: iso(-2) }] },
      { id: 'l2', name: 'Soon list',    items: [{ id: 'i2', title: 'y', status: 'open', tags: [], inGoals: [], dueDate: iso(20) }] },
      { id: 'l3', name: 'Undated list', items: [{ id: 'i3', title: 'z', status: 'open', tags: [], inGoals: [] }] },
    ] } });
    const el = mount();
    await vi.waitFor(() => expect(getItems(el).length).toBe(3));
    const byName = name => getItems(el).find(i => i._list?.name === name);

    el._filter = { query: '', states: new Set(), dates: new Set(['overdue']) };
    el._applyFilter();
    expect(byName('Overdue list').hidden).toBe(false);
    expect(byName('Soon list').hidden).toBe(true);
    expect(byName('Undated list').hidden).toBe(true);

    el._filter = { query: '', states: new Set(), dates: new Set(['none']) };
    el._applyFilter();
    expect(byName('Undated list').hidden).toBe(false);
    expect(byName('Overdue list').hidden).toBe(true);
  });

  it('ignores done/closed items when matching a date bucket', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [
      { id: 'l1', name: 'Done-overdue list', items: [{ id: 'i1', title: 'x', status: 'done', tags: [], inGoals: [], dueDate: iso(-2) }] },
    ] } });
    const el = mount();
    await vi.waitFor(() => expect(getItems(el).length).toBe(1));

    el._filter = { query: '', states: new Set(), dates: new Set(['overdue']) };
    el._applyFilter();
    expect(getItems(el)[0].hidden).toBe(true);
  });
});

describe('lists-page — state filter (Empty / Not empty / Archived, additive)', () => {
  afterEach(() => localStorage.removeItem('telos:filter:lists'));

  it('hides archived lists by default', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [
      { id: 'l1', name: 'Active', items: [] },
      { id: 'l2', name: 'Old', items: [], archived: true },
    ] } });
    const el = mount();
    await vi.waitFor(() => expect(getItems(el).length).toBe(2));
    const byName = name => getItems(el).find(i => i._list?.name === name);
    expect(byName('Active').hidden).toBe(false);
    expect(byName('Old').hidden).toBe(true);
  });

  it('shows only archived lists when the Archived pill alone is active', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [
      { id: 'l1', name: 'Active', items: [] },
      { id: 'l2', name: 'Old', items: [], archived: true },
    ] } });
    const el = mount();
    await vi.waitFor(() => expect(getItems(el).length).toBe(2));
    el._filter = { query: '', states: new Set(['archived']), dates: new Set() };
    el._applyFilter();
    const byName = name => getItems(el).find(i => i._list?.name === name);
    expect(byName('Old').hidden).toBe(false);
    expect(byName('Active').hidden).toBe(true);
  });

  it('Empty excludes archived lists regardless of their own emptiness', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [
      { id: 'l1', name: 'Empty active', items: [] },
      { id: 'l2', name: 'Empty archived', items: [], archived: true },
    ] } });
    const el = mount();
    await vi.waitFor(() => expect(getItems(el).length).toBe(2));
    el._filter = { query: '', states: new Set(['empty']), dates: new Set() };
    el._applyFilter();
    const byName = name => getItems(el).find(i => i._list?.name === name);
    expect(byName('Empty active').hidden).toBe(false);
    expect(byName('Empty archived').hidden).toBe(true);
  });

  it('Empty and Not empty are OR: selecting both shows every non-archived list', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [
      { id: 'l1', name: 'Empty list', items: [] },
      { id: 'l2', name: 'Full list', items: [{ id: 'i1', title: 'x', status: 'open', tags: [], inGoals: [] }] },
    ] } });
    const el = mount();
    await vi.waitFor(() => expect(getItems(el).length).toBe(2));
    el._filter = { query: '', states: new Set(['empty', 'not-empty']), dates: new Set() };
    el._applyFilter();
    const byName = name => getItems(el).find(i => i._list?.name === name);
    expect(byName('Empty list').hidden).toBe(false);
    expect(byName('Full list').hidden).toBe(false);
  });

  it('Archived + Empty pills are OR: shows archived lists and empty non-archived lists', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [
      { id: 'l1', name: 'Empty active', items: [] },
      { id: 'l2', name: 'Full active', items: [{ id: 'i1', title: 'x', status: 'open', tags: [], inGoals: [] }] },
      { id: 'l3', name: 'Full archived', items: [{ id: 'i2', title: 'y', status: 'open', tags: [], inGoals: [] }], archived: true },
    ] } });
    const el = mount();
    await vi.waitFor(() => expect(getItems(el).length).toBe(3));
    el._filter = { query: '', states: new Set(['empty', 'archived']), dates: new Set() };
    el._applyFilter();
    const byName = name => getItems(el).find(i => i._list?.name === name);
    expect(byName('Empty active').hidden).toBe(false);
    expect(byName('Full active').hidden).toBe(true);
    expect(byName('Full archived').hidden).toBe(false); // archived pill shows it regardless of emptiness
  });

  it('clicking the Archived chip reveals archived lists and sets aria-pressed', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [
      { id: 'l1', name: 'Active', items: [] },
      { id: 'l2', name: 'Old', items: [], archived: true },
    ] } });
    const el = mount();
    await vi.waitFor(() => expect(getItems(el).length).toBe(2));
    const btn = el.shadowRoot.querySelector('#fstate-archived');
    btn.click();
    expect(btn.classList.contains('active')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    const byName = name => getItems(el).find(i => i._list?.name === name);
    expect(byName('Old').hidden).toBe(false);
    expect(byName('Active').hidden).toBe(true);
  });

  it('shows the filter-dot indicator when the archived filter alone is active', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    el.shadowRoot.querySelector('#fstate-archived').click();
    expect(el.shadowRoot.querySelector('.filter-btn-dot').hidden).toBe(false);
  });

  it('resets the state filter on Clear filters', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [
      { id: 'l2', name: 'Old', items: [], archived: true },
    ] } });
    const el = mount();
    await vi.waitFor(() => expect(getItems(el).length).toBe(1));
    el.shadowRoot.querySelector('#fstate-archived').click();
    expect(getItems(el)[0].hidden).toBe(false);
    el.shadowRoot.querySelector('#filter-clear-btn').click();
    expect(getItems(el)[0].hidden).toBe(true);
  });
});

// Each menu is a <modal-dialog>; happy-dom supports native <dialog> well enough
// to test show()/close() directly, without stubbing (mirrors year-header.test.js).
function nativeDialog(modalDialogEl) {
  return modalDialogEl.shadowRoot.querySelector('dialog');
}

describe('lists-page — menu', () => {
  it('opens the menu on menu-btn click', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    expect(nativeDialog(el.shadowRoot.querySelector('#menu')).open).toBe(true);
  });

  it('resets aria-expanded on the menu button when the dialog closes', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    const btn = el.shadowRoot.querySelector('#menu-btn');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    el.shadowRoot.querySelector('#menu').close();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('lists-page — date-indicator roll-up toggle', () => {
  it('defaults to shown when nothing is stored', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    expect(el.shadowRoot.querySelector('#rollup-show-btn').classList.contains('active')).toBe(true);
    expect(el.shadowRoot.querySelector('#rollup-hide-btn').classList.contains('active')).toBe(false);
  });

  it('clicking rollup-hide-btn sets listsRollupVisible to false and closes the menu', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#rollup-hide-btn').click();
    expect(getState().listsRollupVisible).toBe(false);
    expect(nativeDialog(el.shadowRoot.querySelector('#menu')).open).toBe(false);
  });

  it('clicking rollup-show-btn sets listsRollupVisible back to true', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    setState('listsRollupVisible', false);
    const el = mount();
    el.shadowRoot.querySelector('#rollup-show-btn').click();
    expect(getState().listsRollupVisible).toBe(true);
  });

  it('suppresses the roll-up dot on every list card when hidden', async () => {
    const iso = d => { const x = new Date(); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    await boot({ dbName: freshName(), initialState: { lists: [
      { id: 'l1', name: 'Overdue list', items: [{ id: 'i1', title: 'x', status: 'open', tags: [], inGoals: [], dueDate: iso(-2) }] },
    ] } });
    const el = mount();
    const dot = () => getItems(el)[0].shadowRoot.querySelector('.urgency');
    expect(dot().hidden).toBe(false);

    setState('listsRollupVisible', false);
    expect(dot().hidden).toBe(true);

    setState('listsRollupVisible', true);
    expect(dot().hidden).toBe(false);
  });
});
