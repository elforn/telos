// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { boot, setState, getState, reset } from '../../_lib/core/store/store.js';
import '../../app/strings.js';
import '../../app/pages/lists-page.js';
import '../../app/components/list-dialog/list-dialog.js';
import { COLOR_PALETTE } from '../../app/components/lists-page-item/lists-page-item.js';

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
  it('creates a new list when list-saved fires after add click', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    el.shadowRoot.querySelector('#add-row').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('list-saved', {
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
    el.shadowRoot.dispatchEvent(new CustomEvent('list-saved', {
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
