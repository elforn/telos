// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { boot, setState, getState, reset } from '../../_lib/core/store/store.js';
import '../../app/strings.js';
import '../../app/pages/list-detail-page.js';

HTMLElement.prototype.setPointerCapture    = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

let dbSeq = 0;
function freshName() { return `list-detail-test-${dbSeq++}`; }

const LIST = { id: 'l1', name: 'Gift ideas', items: [] };
const ITEM = { id: 'i1', title: 'Flowers', status: 'open', tags: [], inGoals: [] };

function mount(listId = 'l1') {
  const el = document.createElement('list-detail-page');
  el.params = { listId };
  document.body.appendChild(el);
  // Stub item-dialog.open so native dialog methods don't throw in happy-dom
  const dialog = el.shadowRoot.querySelector('#dialog');
  if (dialog) dialog.open = vi.fn();
  // Stub list-dialog.open so native dialog methods don't throw in happy-dom
  const listDialog = el.shadowRoot.querySelector('#list-dialog');
  if (listDialog) listDialog.open = vi.fn();
  // Stub bulk-picker's internal modal so show()/close() don't throw in happy-dom
  const bulkPicker = el.shadowRoot.querySelector('#bulk-picker');
  if (bulkPicker) {
    const pickerModal = bulkPicker.shadowRoot.querySelector('#modal');
    if (pickerModal) { pickerModal.show = vi.fn(); pickerModal.close = vi.fn(); }
  }
  // Stub export-sheet internal dialog so showModal()/close() don't throw in happy-dom
  const exportSheet = el.shadowRoot.querySelector('#export-sheet');
  if (exportSheet) {
    const exportDialog = exportSheet.shadowRoot?.querySelector('#sheet');
    if (exportDialog) { exportDialog.showModal = vi.fn(); exportDialog.close = vi.fn(); }
  }
  return el;
}

beforeEach(() => {
  reset();
  localStorage.clear();
});
afterEach(() => { document.body.innerHTML = ''; });

// ── Structure ─────────────────────────────────────────────────────────────────

describe('list-detail-page — structure', () => {
  it('renders a <main> landmark', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    expect(el.shadowRoot.querySelector('main')).not.toBeNull();
  });

  it('shows the list name in the heading', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas')
    );
  });

  it('heading updates when list name changes in the store', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    setState('lists', [{ ...LIST, name: 'Updated name' }]);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Updated name')
    );
  });

  it('renders the add-row button', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    expect(el.shadowRoot.querySelector('#add-row')).not.toBeNull();
  });

  it('renders a back button with aria-label', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    const btn = el.shadowRoot.querySelector('#back-btn');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toBeTruthy();
  });

  it('renders a menu button', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    expect(el.shadowRoot.querySelector('#menu-btn')).not.toBeNull();
  });
});

// ── Item rendering ────────────────────────────────────────────────────────────

describe('list-detail-page — item rendering', () => {
  it('renders a list-item for each item in the list', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item').length).toBe(1)
    );
  });

  it('passes the correct item to each list-item', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    expect(el.shadowRoot.querySelector('list-item')._item.title).toBe('Flowers');
  });

  it('reuses existing list-item element on store update (reconciliation)', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    const original = el.shadowRoot.querySelector('list-item');
    setState('lists', [{ ...LIST, items: [{ ...ITEM, title: 'Updated' }] }]);
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')._item.title).toBe('Updated'));
    expect(el.shadowRoot.querySelector('list-item')).toBe(original);
  });

  it('removes list-item when item is deleted from store', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    setState('lists', [{ ...LIST, items: [] }]);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('list-item')).toBeNull()
    );
  });
});

// ── Status toggle preference ──────────────────────────────────────────────────

describe('list-detail-page — status toggle', () => {
  it('show pill is active by default (status visible)', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#status-show-btn').classList.contains('active')).toBe(true)
    );
  });

  it('hide pill is active when preference is off', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, showStatus: false }] } });
    const el = mount();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#status-hide-btn').classList.contains('active')).toBe(true)
    );
  });

  it('show pill is active and hide pill is inactive when status is visible', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => {
      expect(el.shadowRoot.querySelector('#status-show-btn').classList.contains('active')).toBe(true);
      expect(el.shadowRoot.querySelector('#status-hide-btn').classList.contains('active')).toBe(false);
    });
  });

  it('hide pill is active and show pill is inactive when status is hidden', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, showStatus: false }] } });
    const el = mount();
    await vi.waitFor(() => {
      expect(el.shadowRoot.querySelector('#status-hide-btn').classList.contains('active')).toBe(true);
      expect(el.shadowRoot.querySelector('#status-show-btn').classList.contains('active')).toBe(false);
    });
  });

  it('clicking hide pill hides badge via CSS custom property', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#status-hide-btn')).not.toBeNull());
    el.shadowRoot.querySelector('#status-hide-btn').click();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#item-list').style.getPropertyValue('--list-badge-display')).toBe('none')
    );
  });

  it('clicking hide then show pill restores badge', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#status-hide-btn')).not.toBeNull());
    el.shadowRoot.querySelector('#status-hide-btn').click();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#item-list').style.getPropertyValue('--list-badge-display')).toBe('none')
    );
    el.shadowRoot.querySelector('#status-show-btn').click();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#item-list').style.getPropertyValue('--list-badge-display')).toBe('')
    );
  });

  it('clicking hide pill sets showStatus: false on the list in the store', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#status-hide-btn')).not.toBeNull());
    el.shadowRoot.querySelector('#status-hide-btn').click();
    await vi.waitFor(() => expect(getState().lists[0].showStatus).toBe(false));
  });

  it('clicking show pill sets showStatus: true on the list in the store', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, showStatus: false }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#status-hide-btn').classList.contains('active')).toBe(true));
    el.shadowRoot.querySelector('#status-show-btn').click();
    await vi.waitFor(() => expect(getState().lists[0].showStatus).toBe(true));
  });

  it('preference is scoped per list — different lists are independent', async () => {
    const LIST2 = { id: 'l2', name: 'Books', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, showStatus: false }, LIST2] } });

    const el1 = document.createElement('list-detail-page');
    el1.params = { listId: 'l1' };
    document.body.appendChild(el1);

    const el2 = document.createElement('list-detail-page');
    el2.params = { listId: 'l2' };
    document.body.appendChild(el2);

    await vi.waitFor(() => {
      expect(el1.shadowRoot.querySelector('#status-hide-btn').classList.contains('active')).toBe(true);
      expect(el2.shadowRoot.querySelector('#status-show-btn').classList.contains('active')).toBe(true);
    });
  });
});

// ── Store mutations ───────────────────────────────────────────────────────────

describe('list-detail-page — add item', () => {
  it('adds an item when item-saved fires with no editing item', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#add-row')).not.toBeNull());
    el.shadowRoot.querySelector('#add-row').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('item-saved', {
      bubbles: true, composed: true, detail: { title: 'New item', status: 'open' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items).toHaveLength(1));
    expect(getState().lists[0].items[0].title).toBe('New item');
    expect(getState().lists[0].items[0].status).toBe('open');
    expect(getState().lists[0].items[0].tags).toEqual([]);
    expect(getState().lists[0].items[0].inGoals).toEqual([]);
  });

  it('persists note and url when adding an item', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#add-row')).not.toBeNull());
    el.shadowRoot.dispatchEvent(new CustomEvent('item-saved', {
      bubbles: true, composed: true,
      detail: { title: 'Item', status: 'open', note: 'My note', url: 'https://example.com' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items).toHaveLength(1));
    expect(getState().lists[0].items[0].note).toBe('My note');
    expect(getState().lists[0].items[0].url).toBe('https://example.com');
  });

  it('new item appears as list-item in the DOM', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#add-row')).not.toBeNull());
    el.shadowRoot.querySelector('#add-row').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('item-saved', {
      bubbles: true, composed: true, detail: { title: 'New item', status: 'open' },
    }));
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
  });
});

describe('list-detail-page — edit item', () => {
  it('edits an item when item-saved fires after item-tap sets editing context', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.dispatchEvent(new CustomEvent('item-saved', {
      bubbles: true, composed: true, detail: { title: 'Edited title', status: 'done' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].title).toBe('Edited title'));
    expect(getState().lists[0].items[0].status).toBe('done');
  });

  it('persists note and url when editing an item', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.dispatchEvent(new CustomEvent('item-saved', {
      bubbles: true, composed: true,
      detail: { title: 'Item', status: 'open', note: 'Updated note', url: 'https://example.com' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].note).toBe('Updated note'));
    expect(getState().lists[0].items[0].url).toBe('https://example.com');
  });
});

describe('list-detail-page — delete item', () => {
  it('removes an item when item-delete fires from the item list', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-delete', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items).toHaveLength(0));
  });

  it('removes an item when item-delete fires from the dialog', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    // Set editing context via item-tap first
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(
      new CustomEvent('item-delete', { bubbles: true, composed: true })
    );
    await vi.waitFor(() => expect(getState().lists[0].items).toHaveLength(0));
  });
});

describe('list-detail-page — done toggle', () => {
  it('toggles item status from open to done on item-done-toggle', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-done-toggle', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].status).toBe('done'));
  });

  it('toggles item status from done back to open on item-done-toggle', async () => {
    const doneItem = { ...ITEM, status: 'done' };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [doneItem] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-done-toggle', {
      bubbles: true, composed: true, detail: { item: doneItem },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].status).toBe('open'));
  });
});

// ── Drag reorder ─────────────────────────────────────────────────────────────

const ITEM_A = { id: 'a', title: 'A', status: 'open', tags: [], inGoals: [] };
const ITEM_B = { id: 'b', title: 'B', status: 'open', tags: [], inGoals: [] };
const ITEM_C = { id: 'c', title: 'C', status: 'open', tags: [], inGoals: [] };

describe('list-detail-page — _placeItem', () => {
  it('moves an item forward in the list', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_A, ITEM_B, ITEM_C] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));
    el._placeItem(0, 2); // move A after B → [B, A, C]
    await vi.waitFor(() => {
      const ids = getState().lists[0].items.map(i => i.id);
      expect(ids).toEqual(['b', 'a', 'c']);
    });
  });

  it('moves an item backward in the list', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_A, ITEM_B, ITEM_C] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));
    el._placeItem(2, 0); // move C before A → [C, A, B]
    await vi.waitFor(() => {
      const ids = getState().lists[0].items.map(i => i.id);
      expect(ids).toEqual(['c', 'a', 'b']);
    });
  });

  it('moves an item to the end of the list', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_A, ITEM_B, ITEM_C] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));
    el._placeItem(0, 3); // move A to end → [B, C, A]
    await vi.waitFor(() => {
      const ids = getState().lists[0].items.map(i => i.id);
      expect(ids).toEqual(['b', 'c', 'a']);
    });
  });

  it('is a no-op when fromIndex equals toIndex', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_A, ITEM_B, ITEM_C] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));
    el._placeItem(1, 1);
    const ids = getState().lists[0].items.map(i => i.id);
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op when dropping one position below its current slot', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_A, ITEM_B, ITEM_C] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));
    el._placeItem(1, 2); // adjacent — no real move
    const ids = getState().lists[0].items.map(i => i.id);
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

describe('list-detail-page — item-reorder-key', () => {
  it('ArrowDown on first item moves it down one slot', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_A, ITEM_B, ITEM_C] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-reorder-key', {
      bubbles: true, detail: { item: ITEM_A, direction: 1 },
    }));
    await vi.waitFor(() => {
      const ids = getState().lists[0].items.map(i => i.id);
      expect(ids).toEqual(['b', 'a', 'c']);
    });
  });

  it('ArrowUp on last item moves it up one slot', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_A, ITEM_B, ITEM_C] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-reorder-key', {
      bubbles: true, detail: { item: ITEM_C, direction: -1 },
    }));
    await vi.waitFor(() => {
      const ids = getState().lists[0].items.map(i => i.id);
      expect(ids).toEqual(['a', 'c', 'b']);
    });
  });

  it('ArrowUp on first item is a no-op', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_A, ITEM_B] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-reorder-key', {
      bubbles: true, detail: { item: ITEM_A, direction: -1 },
    }));
    const ids = getState().lists[0].items.map(i => i.id);
    expect(ids).toEqual(['a', 'b']);
  });
});

// ── item-move ─────────────────────────────────────────────────────────────────

const LIST2 = { id: 'l2', name: 'Wishlist', items: [] };

describe('list-detail-page — item-move (move)', () => {
  it('removes item from current list on move', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }, LIST2] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-move', {
      bubbles: true, composed: true,
      detail: { title: ITEM.title, status: ITEM.status, note: undefined, url: undefined, targetListIds: ['l2'], copy: false },
    }));

    await vi.waitFor(() => expect(getState().lists.find(l => l.id === 'l1').items).toHaveLength(0));
  });

  it('adds a clone to each target list on move', async () => {
    const LIST3 = { id: 'l3', name: 'Later', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }, LIST2, LIST3] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-move', {
      bubbles: true, composed: true,
      detail: { title: ITEM.title, status: ITEM.status, note: undefined, url: undefined, targetListIds: ['l2', 'l3'], copy: false },
    }));

    await vi.waitFor(() => {
      expect(getState().lists.find(l => l.id === 'l2').items).toHaveLength(1);
      expect(getState().lists.find(l => l.id === 'l3').items).toHaveLength(1);
    });
  });

  it('clones in target lists have new UUIDs', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }, LIST2] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-move', {
      bubbles: true, composed: true,
      detail: { title: ITEM.title, status: ITEM.status, note: undefined, url: undefined, targetListIds: ['l2'], copy: false },
    }));

    await vi.waitFor(() => expect(getState().lists.find(l => l.id === 'l2').items).toHaveLength(1));
    expect(getState().lists.find(l => l.id === 'l2').items[0].id).not.toBe(ITEM.id);
  });
});

describe('list-detail-page — item-move (copy)', () => {
  it('keeps item in current list on copy', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }, LIST2] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-move', {
      bubbles: true, composed: true,
      detail: { title: ITEM.title, status: ITEM.status, note: undefined, url: undefined, targetListIds: ['l2'], copy: true },
    }));

    await vi.waitFor(() => expect(getState().lists.find(l => l.id === 'l2').items).toHaveLength(1));
    expect(getState().lists.find(l => l.id === 'l1').items).toHaveLength(1);
  });

  it('adds clones to all target lists on copy', async () => {
    const LIST3 = { id: 'l3', name: 'Later', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }, LIST2, LIST3] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-move', {
      bubbles: true, composed: true,
      detail: { title: ITEM.title, status: ITEM.status, note: undefined, url: undefined, targetListIds: ['l2', 'l3'], copy: true },
    }));

    await vi.waitFor(() => {
      expect(getState().lists.find(l => l.id === 'l1').items).toHaveLength(1);
      expect(getState().lists.find(l => l.id === 'l2').items).toHaveLength(1);
      expect(getState().lists.find(l => l.id === 'l3').items).toHaveLength(1);
    });
  });
});

// ── item-promote ──────────────────────────────────────────────────────────────

describe('list-detail-page — item-promote', () => {
  it('creates a new goal in the correct year and section', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }], goals: {} } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-promote', {
      bubbles: true, composed: true,
      detail: { title: 'Flowers', status: 'open', note: undefined, url: undefined, year: '2026', section: 'milestones' },
    }));

    await vi.waitFor(() => {
      const goals = getState().goals?.['2026']?.milestones ?? [];
      expect(goals).toHaveLength(1);
      expect(goals[0].title).toBe('Flowers');
    });
  });

  it('new goal has percentage tracking with value 0', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }], goals: {} } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-promote', {
      bubbles: true, composed: true,
      detail: { title: 'Flowers', status: 'open', note: undefined, url: undefined, year: '2026', section: 'capstone' },
    }));

    await vi.waitFor(() => {
      const goal = getState().goals?.['2026']?.capstone?.[0];
      expect(goal?.tracking).toEqual({ type: 'percentage', value: 0 });
    });
  });

  it('appends entry to item inGoals with correct year, section, and goalId', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }], goals: {} } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-promote', {
      bubbles: true, composed: true,
      detail: { title: 'Flowers', status: 'open', note: undefined, url: undefined, year: '2026', section: 'wow' },
    }));

    await vi.waitFor(() => {
      const item = getState().lists[0].items[0];
      expect(item.inGoals).toHaveLength(1);
      expect(item.inGoals[0].year).toBe('2026');
      expect(item.inGoals[0].section).toBe('wow');
    });
    const goalId = getState().goals?.['2026']?.wow?.[0]?.id;
    expect(getState().lists[0].items[0].inGoals[0].goalId).toBe(goalId);
  });

  it('does not overwrite existing goals in the same year+section', async () => {
    const existingGoal = { id: 'eg1', title: 'Existing', tags: [], tracking: { type: 'percentage', value: 50 } };
    await boot({
      dbName: freshName(),
      initialState: { lists: [{ ...LIST, items: [ITEM] }], goals: { '2026': { capstone: [], milestones: [existingGoal], wow: [], focus: [] } } },
    });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-promote', {
      bubbles: true, composed: true,
      detail: { title: 'Flowers', status: 'open', note: undefined, url: undefined, year: '2026', section: 'milestones' },
    }));

    await vi.waitFor(() => {
      const goals = getState().goals?.['2026']?.milestones ?? [];
      expect(goals).toHaveLength(2);
      expect(goals[0].id).toBe('eg1');
    });
  });
});

// ── stale inGoals reconciliation ──────────────────────────────────────────────

describe('list-detail-page — stale inGoals reconciliation', () => {
  it('prunes inGoals entries for goals that no longer exist when item dialog is opened', async () => {
    const staleItem = { id: 'i1', title: 'Flowers', status: 'open', tags: [],
      inGoals: [{ year: '2026', section: 'milestones', goalId: 'g-gone' }] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [staleItem] }], goals: {} } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: staleItem },
    }));

    await vi.waitFor(() => {
      expect(getState().lists[0].items[0].inGoals).toHaveLength(0);
    });
  });

  it('keeps valid inGoals entries intact', async () => {
    const goal = { id: 'g1', title: 'Flowers', tags: [], tracking: { type: 'percentage', value: 0 } };
    const linkedItem = { id: 'i1', title: 'Flowers', status: 'open', tags: [],
      inGoals: [{ year: '2026', section: 'milestones', goalId: 'g1' }] };
    await boot({
      dbName: freshName(),
      initialState: { lists: [{ ...LIST, items: [linkedItem] }], goals: { '2026': { capstone: [], milestones: [goal], wow: [], focus: [] } } },
    });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: linkedItem },
    }));

    await new Promise(r => setTimeout(r, 50));
    expect(getState().lists[0].items[0].inGoals).toHaveLength(1);
  });
});

// ── Selection mode ────────────────────────────────────────────────────────────

describe('list-detail-page — selection mode', () => {
  it('long-press enters selection mode: menu-btn hidden, bulk-bar visible', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-long-press', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));

    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(false);
  });

  it('long-press auto-selects the pressed item', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-long-press', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));

    const listItem = el.shadowRoot.querySelector('list-item');
    expect(listItem.selected).toBe(true);
    expect(listItem.selectionMode).toBe(true);
  });

  it('✕ close button exits selection mode: menu-btn restored, bulk-bar hidden', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-long-press', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#bulk-close-btn').click();

    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(true);
  });

  it('✕ close button clears selection state on all items', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-long-press', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#bulk-close-btn').click();

    const listItem = el.shadowRoot.querySelector('list-item');
    expect(listItem.selected).toBe(false);
    expect(listItem.selectionMode).toBe(false);
  });

  it('deselecting the last selected item auto-exits selection mode', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-long-press', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-select-toggle', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));

    expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('list-item').selectionMode).toBe(false);
  });

  it('item-select-toggle toggles item into selected state', async () => {
    const ITEM2 = { id: 'i2', title: 'Book', status: 'open', tags: [], inGoals: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM, ITEM2] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));

    // Enter selection mode with item1 selected
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-long-press', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));

    // Toggle item2 in
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-select-toggle', {
      bubbles: true, composed: true, detail: { item: ITEM2 },
    }));

    const items = [...el.shadowRoot.querySelectorAll('list-item')];
    expect(items[0].selected).toBe(true);
    expect(items[1].selected).toBe(true);
  });

  it('item-select-toggle deselects an already-selected item (with multiple items)', async () => {
    const ITEM2 = { id: 'i2', title: 'Book', status: 'open', tags: [], inGoals: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM, ITEM2] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-long-press', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));

    // Also select item2 so deselecting item1 doesn't empty the set
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-select-toggle', {
      bubbles: true, composed: true, detail: { item: ITEM2 },
    }));

    // Now deselect item1
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-select-toggle', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));

    const items = [...el.shadowRoot.querySelectorAll('list-item')];
    expect(items[0].selected).toBe(false);
    expect(items[1].selected).toBe(true);
  });

  it('item-tap is ignored while in selection mode', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-long-press', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));

    const dialog = el.shadowRoot.querySelector('#dialog');
    dialog.open = vi.fn();
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    expect(dialog.open).not.toHaveBeenCalled();
  });
});

// ── Bulk action bar ───────────────────────────────────────────────────────────

function enterSelectionMode(el, item = ITEM) {
  el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-long-press', {
    bubbles: true, composed: true, detail: { item },
  }));
}

describe('list-detail-page — bulk action bar', () => {
  it('bulk bar is hidden initially', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(true);
  });

  it('bulk bar becomes visible on long-press', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);
    expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(false);
  });

  it('bulk count shows number of selected items', async () => {
    const ITEM2 = { id: 'i2', title: 'Book', status: 'open', tags: [], inGoals: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM, ITEM2] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));
    enterSelectionMode(el);
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-select-toggle', {
      bubbles: true, composed: true, detail: { item: ITEM2 },
    }));
    expect(el.shadowRoot.querySelector('#bulk-count').textContent).toContain('2');
  });

  it('bulk bar hides after ✕ close button', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);
    el.shadowRoot.querySelector('#bulk-close-btn').click();
    expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(true);
  });

  it('bulk delete removes selected items from the store', async () => {
    const ITEM2 = { id: 'i2', title: 'Book', status: 'open', tags: [], inGoals: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM, ITEM2] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));

    enterSelectionMode(el);
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-select-toggle', {
      bubbles: true, composed: true, detail: { item: ITEM2 },
    }));
    el.shadowRoot.querySelector('#bulk-delete-btn').click();

    await vi.waitFor(() => {
      const items = getState().lists[0].items;
      expect(items).toHaveLength(0);
    });
  });

  it('bulk delete exits selection mode', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);
    el.shadowRoot.querySelector('#bulk-delete-btn').click();
    expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(false);
  });

  it('bulk Move opens list-picker-dialog with mode=null (shows both Move and Copy)', async () => {
    const OTHER_LIST = { id: 'l2', name: 'Other', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }, OTHER_LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);

    const picker = el.shadowRoot.querySelector('#bulk-picker');
    const pickerModal = picker.shadowRoot.querySelector('#modal');
    el.shadowRoot.querySelector('#bulk-move-btn').click();

    expect(pickerModal.show).toHaveBeenCalledOnce();
    expect(picker.mode).toBeNull();
  });

  it('list-pick(copy=false) moves selected items to target lists', async () => {
    const OTHER_LIST = { id: 'l2', name: 'Other', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }, OTHER_LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);

    el.shadowRoot.querySelector('#bulk-picker').dispatchEvent(new CustomEvent('list-pick', {
      bubbles: true, composed: true,
      detail: { targetListIds: ['l2'], copy: false },
    }));

    await vi.waitFor(() => {
      const lists = getState().lists;
      expect(lists.find(l => l.id === 'l1').items).toHaveLength(0);
      expect(lists.find(l => l.id === 'l2').items).toHaveLength(1);
      expect(lists.find(l => l.id === 'l2').items[0].title).toBe('Flowers');
    });
  });

  it('list-pick(copy=true) copies selected items, keeps originals', async () => {
    const OTHER_LIST = { id: 'l2', name: 'Other', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }, OTHER_LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);

    el.shadowRoot.querySelector('#bulk-picker').dispatchEvent(new CustomEvent('list-pick', {
      bubbles: true, composed: true,
      detail: { targetListIds: ['l2'], copy: true },
    }));

    await vi.waitFor(() => {
      const lists = getState().lists;
      expect(lists.find(l => l.id === 'l1').items).toHaveLength(1);
      expect(lists.find(l => l.id === 'l2').items).toHaveLength(1);
      expect(lists.find(l => l.id === 'l2').items[0].id).not.toBe(ITEM.id);
    });
  });

  it('list-pick with newListName creates the new list and moves items to it', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);

    el.shadowRoot.querySelector('#bulk-picker').dispatchEvent(new CustomEvent('list-pick', {
      bubbles: true, composed: true,
      detail: { targetListIds: [], newListName: 'New List', copy: false },
    }));

    await vi.waitFor(() => {
      const lists = getState().lists;
      expect(lists.find(l => l.id === 'l1').items).toHaveLength(0);
      const newList = lists.find(l => l.name === 'New List');
      expect(newList).toBeTruthy();
      expect(newList.items).toHaveLength(1);
      expect(newList.items[0].title).toBe('Flowers');
    });
  });

  it('list-pick(copy=false) exits selection mode', async () => {
    const OTHER_LIST = { id: 'l2', name: 'Other', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }, OTHER_LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);

    el.shadowRoot.querySelector('#bulk-picker').dispatchEvent(new CustomEvent('list-pick', {
      bubbles: true, composed: true,
      detail: { targetListIds: ['l2'], copy: false },
    }));

    await vi.waitFor(() => {
      expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(true);
      expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(false);
    });
  });

  it('list-pick(copy=true) keeps selection mode active', async () => {
    const OTHER_LIST = { id: 'l2', name: 'Other', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }, OTHER_LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);

    el.shadowRoot.querySelector('#bulk-picker').dispatchEvent(new CustomEvent('list-pick', {
      bubbles: true, composed: true,
      detail: { targetListIds: ['l2'], copy: true },
    }));

    await vi.waitFor(() => expect(getState().lists[1].items).toHaveLength(1));
    expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(true);
  });
});

// ── Name edit button ──────────────────────────────────────────────────────────

describe('list-detail-page — name edit button', () => {
  it('renders a name-edit-btn with an aria-label', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    const btn = el.shadowRoot.querySelector('#name-edit-btn');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toBeTruthy();
  });

  it('name-edit-btn aria-label includes the list name after store resolves', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#name-edit-btn')?.getAttribute('aria-label')).toContain('Gift ideas')
    );
  });

  it('name-edit-btn aria-label updates when list name changes in the store', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#name-edit-btn')?.getAttribute('aria-label')).toContain('Gift ideas')
    );
    setState('lists', [{ ...LIST, name: 'Travel plans' }]);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#name-edit-btn')?.getAttribute('aria-label')).toContain('Travel plans')
    );
  });

  it('clicking name-edit-btn calls list-dialog.open with the current list', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    const listDialog = el.shadowRoot.querySelector('#list-dialog');
    el.shadowRoot.querySelector('#name-edit-btn').click();
    expect(listDialog.open).toHaveBeenCalledOnce();
    expect(listDialog.open).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1', name: 'Gift ideas' }));
  });
});

// ── Edit list via list-dialog ─────────────────────────────────────────────────

describe('list-detail-page — edit list (list-saved)', () => {
  it('updates list name in the store when list-saved fires from list-dialog', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#list-dialog').dispatchEvent(new CustomEvent('list-saved', {
      bubbles: true, composed: true, detail: { name: 'Renamed list' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].name).toBe('Renamed list'));
  });

  it('updates list color in the store when list-saved fires with a color', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#list-dialog').dispatchEvent(new CustomEvent('list-saved', {
      bubbles: true, composed: true, detail: { name: 'Gift ideas', color: '#ff0000' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].color).toBe('#ff0000'));
  });

  it('removes color from list in the store when list-saved fires without a color', async () => {
    const listWithColor = { ...LIST, color: '#ff0000' };
    await boot({ dbName: freshName(), initialState: { lists: [listWithColor] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#list-dialog').dispatchEvent(new CustomEvent('list-saved', {
      bubbles: true, composed: true, detail: { name: 'Gift ideas' },
    }));
    await vi.waitFor(() => expect(getState().lists[0]).not.toHaveProperty('color'));
  });

  it('does not affect other lists when renaming', async () => {
    const LIST2 = { id: 'l2', name: 'Books', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [LIST, LIST2] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#list-dialog').dispatchEvent(new CustomEvent('list-saved', {
      bubbles: true, composed: true, detail: { name: 'Renamed' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].name).toBe('Renamed'));
    expect(getState().lists[1].name).toBe('Books');
  });
});

// ── Delete list via menu ──────────────────────────────────────────────────────

describe('list-detail-page — delete list (menu)', () => {
  it('renders a list-delete-btn in the menu', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    expect(el.shadowRoot.querySelector('#list-delete-btn')).not.toBeNull();
  });

  it('first click on list-delete-btn removes the list from the store', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    const btn = el.shadowRoot.querySelector('#list-delete-btn');
    btn.click();
    await vi.waitFor(() => expect(getState().lists).toHaveLength(0));
  });

  it('first click does not affect other lists', async () => {
    const LIST2 = { id: 'l2', name: 'Books', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [LIST, LIST2] } });
    const el = mount('l2');
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Books'));
    const btn = el.shadowRoot.querySelector('#list-delete-btn');
    btn.click();
    await vi.waitFor(() => expect(getState().lists).toHaveLength(1));
    expect(getState().lists[0].id).toBe('l1');
  });
});

// ── Delete list via list-dialog ───────────────────────────────────────────────

describe('list-detail-page — delete list (list-dialog list-delete)', () => {
  it('removes the list from the store when list-delete fires from list-dialog', async () => {
    const LIST2 = { id: 'l2', name: 'Books', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [LIST, LIST2] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#list-dialog').dispatchEvent(new CustomEvent('list-delete', {
      bubbles: true, composed: true,
    }));
    await vi.waitFor(() => expect(getState().lists).toHaveLength(1));
    expect(getState().lists[0].id).toBe('l2');
  });
});

// ── Immediate status commit ───────────────────────────────────────────────────

describe('list-detail-page — item-status-changed (immediate commit)', () => {
  it('updates only the item status when item-status-changed fires from the dialog', async () => {
    const item = { ...ITEM, note: 'Keep this note', url: 'https://example.com' };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [item] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-status-changed', {
      bubbles: true, composed: true, detail: { status: 'done' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].status).toBe('done'));
    expect(getState().lists[0].items[0].note).toBe('Keep this note');
    expect(getState().lists[0].items[0].url).toBe('https://example.com');
  });

  it('does not mutate other items when item-status-changed fires', async () => {
    const ITEM2 = { id: 'i2', title: 'Other', status: 'open', tags: [], inGoals: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM, ITEM2] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-status-changed', {
      bubbles: true, composed: true, detail: { status: 'paused' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].status).toBe('paused'));
    expect(getState().lists[0].items[1].status).toBe('open');
  });

  it('is a no-op when item-status-changed fires with no editing context', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-status-changed', {
      bubbles: true, composed: true, detail: { status: 'done' },
    }));
    await new Promise(r => setTimeout(r, 20));
    expect(getState().lists[0].items[0].status).toBe('open');
  });
});

// ── Immediate colour commit ───────────────────────────────────────────────────

describe('list-detail-page — list-color-changed (immediate commit)', () => {
  it('updates the list colour when list-color-changed fires from the list-dialog', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#list-dialog').dispatchEvent(new CustomEvent('list-color-changed', {
      bubbles: true, composed: true, detail: { color: '#E5534B' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].color).toBe('#E5534B'));
    expect(getState().lists[0].name).toBe('Gift ideas');
  });

  it('removes the list colour when list-color-changed fires with null', async () => {
    const coloredList = { ...LIST, color: '#4A94D4' };
    await boot({ dbName: freshName(), initialState: { lists: [coloredList] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#list-dialog').dispatchEvent(new CustomEvent('list-color-changed', {
      bubbles: true, composed: true, detail: { color: null },
    }));
    await vi.waitFor(() => expect(getState().lists[0].color).toBeUndefined());
  });
});

// ── Export (extract-confirm) ───────────────────────────────────────────────────

describe('list-detail-page — extract-confirm', () => {
  let writeText;
  beforeEach(() => {
    writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('extract-confirm writes markdown containing the list name to clipboard', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();

    el.shadowRoot.querySelector('#export-sheet').dispatchEvent(new CustomEvent('extract-confirm', {
      bubbles: true, composed: true, detail: { metadata: false, notes: false },
    }));

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain('Gift ideas');
  });

  it('extract-confirm does not exit selection mode', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);

    el.shadowRoot.querySelector('#export-sheet').dispatchEvent(new CustomEvent('extract-confirm', {
      bubbles: true, composed: true, detail: { metadata: false, notes: false },
    }));

    expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(true);
  });
});

// ── list-detail-page — _parseImportText ──────────────────────────────────────

describe('list-detail-page — _parseImportText', () => {
  let el;
  beforeEach(() => { el = document.createElement('list-detail-page'); });

  it('parses non-empty lines as separate items', () => {
    const items = el._parseImportText('Alpha\nBeta\nGamma');
    expect(items.map(i => i.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('skips empty lines between items', () => {
    const items = el._parseImportText('Alpha\n\nBeta');
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Alpha');
    expect(items[1].title).toBe('Beta');
  });

  it('strips leading bullet (- )', () => {
    const items = el._parseImportText('- Buy milk\n* Read book\n• Exercise');
    expect(items[0].title).toBe('Buy milk');
    expect(items[1].title).toBe('Read book');
    expect(items[2].title).toBe('Exercise');
  });

  it('attaches indented lines as a note on the preceding item', () => {
    const items = el._parseImportText('Alpha\n  a continuation line\nBeta');
    expect(items[0].title).toBe('Alpha');
    expect(items[0].note).toBe('a continuation line');
    expect(items[1].note).toBeUndefined();
  });

  it('joins multiple indented lines with newline in note', () => {
    const items = el._parseImportText('Alpha\n  line one\n  line two');
    expect(items[0].note).toBe('line one\nline two');
  });

  it('truncates title at 120 chars at a word boundary', () => {
    const long = 'word '.repeat(30).trim(); // 149 chars
    const items = el._parseImportText(long);
    expect(items[0].title.length).toBeLessThanOrEqual(120);
    expect(items[0].title.endsWith(' ')).toBe(false);
  });

  it('overflowed title text goes into note', () => {
    const long = 'word '.repeat(30).trim();
    const items = el._parseImportText(long);
    expect(items[0].note).toBe(long);
  });

  it('extracts a URL from the title text', () => {
    const items = el._parseImportText('Read this https://example.com article');
    expect(items[0].url).toBe('https://example.com');
  });

  it('extracts a URL from an indented continuation line', () => {
    const items = el._parseImportText('Check docs\n  see https://docs.example.com for details');
    expect(items[0].url).toBe('https://docs.example.com');
  });

  it('uses the last URL when multiple URLs appear in text', () => {
    const items = el._parseImportText('See https://first.com and https://second.com');
    expect(items[0].url).toBe('https://second.com');
  });

  it('strips trailing punctuation from extracted URL', () => {
    const items = el._parseImportText('Read https://example.com.');
    expect(items[0].url).toBe('https://example.com');
  });

  it('returns undefined url when no URL is present', () => {
    const items = el._parseImportText('No link here');
    expect(items[0].url).toBeUndefined();
  });

  it('returns empty array for blank input', () => {
    expect(el._parseImportText('')).toHaveLength(0);
    expect(el._parseImportText('   \n\n  ')).toHaveLength(0);
  });
});

// ── list-detail-page — _applyFilter ──────────────────────────────────────────

describe('list-detail-page — _applyFilter', () => {
  const ITEM_OPEN   = { id: 'i1', title: 'Open task',   status: 'open',   tags: ['work'],   inGoals: [] };
  const ITEM_DONE   = { id: 'i2', title: 'Done task',   status: 'done',   tags: ['health'], inGoals: [] };
  const ITEM_PAUSED = { id: 'i3', title: 'Paused task', status: 'paused', tags: ['work'],   inGoals: [] };

  it('text query hides items whose title does not match', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_OPEN, ITEM_DONE] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));

    el._filter = { query: 'done', statuses: new Set(), tags: new Set() };
    el._applyFilter();

    const items = [...el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item')];
    expect(items.find(i => i._item.title === 'Done task').hidden).toBe(false);
    expect(items.find(i => i._item.title === 'Open task').hidden).toBe(true);
  });

  it('empty query shows all items', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_OPEN, ITEM_DONE] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));

    el._filter = { query: '', statuses: new Set(), tags: new Set() };
    el._applyFilter();

    const items = [...el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item')];
    expect(items.every(i => !i.hidden)).toBe(true);
  });

  it('status filter shows only matching-status items', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_OPEN, ITEM_DONE, ITEM_PAUSED] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));

    el._filter = { query: '', statuses: new Set(['paused']), tags: new Set() };
    el._applyFilter();

    const items = [...el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item')];
    expect(items.find(i => i._item.status === 'paused').hidden).toBe(false);
    expect(items.find(i => i._item.status === 'open').hidden).toBe(true);
    expect(items.find(i => i._item.status === 'done').hidden).toBe(true);
  });

  it('tag filter hides items that do not carry the tag', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_OPEN, ITEM_DONE] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));

    el._filter = { query: '', statuses: new Set(), tags: new Set(['health']) };
    el._applyFilter();

    const items = [...el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item')];
    expect(items.find(i => i._item.id === 'i2').hidden).toBe(false); // health tag
    expect(items.find(i => i._item.id === 'i1').hidden).toBe(true);  // work tag only
  });

  it('combines query and status filter (AND logic)', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_OPEN, ITEM_DONE, ITEM_PAUSED] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));

    el._filter = { query: 'task', statuses: new Set(['open']), tags: new Set() };
    el._applyFilter();

    const items = [...el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item')];
    expect(items.find(i => i._item.status === 'open').hidden).toBe(false);
    expect(items.find(i => i._item.status === 'done').hidden).toBe(true);
    expect(items.find(i => i._item.status === 'paused').hidden).toBe(true);
  });
});

// ── list-detail-page — listsTagsVisible toggle ────────────────────────────────

describe('list-detail-page — listsTagsVisible toggle', () => {
  it('clicking tags-show-btn sets listsTagsVisible[listId] to true', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    el.shadowRoot.querySelector('#tags-show-btn').click();
    expect(getState().listsTagsVisible?.['l1']).toBe(true);
  });

  it('clicking tags-hide-btn sets listsTagsVisible[listId] to false', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    setState('listsTagsVisible', { l1: true });
    const el = mount();
    el.shadowRoot.querySelector('#tags-hide-btn').click();
    expect(getState().listsTagsVisible?.['l1']).toBe(false);
  });

  it('tags-show-btn gets active class when strip is visible', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    setState('listsTagsVisible', { l1: true });
    const el = mount();
    expect(el.shadowRoot.querySelector('#tags-show-btn').classList.contains('active')).toBe(true);
    expect(el.shadowRoot.querySelector('#tags-hide-btn').classList.contains('active')).toBe(false);
  });

  it('tags-hide-btn gets active class when strip is hidden', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    setState('listsTagsVisible', { l1: false });
    const el = mount();
    expect(el.shadowRoot.querySelector('#tags-show-btn').classList.contains('active')).toBe(false);
    expect(el.shadowRoot.querySelector('#tags-hide-btn').classList.contains('active')).toBe(true);
  });

  it('does not affect other list IDs', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    el.shadowRoot.querySelector('#tags-show-btn').click();
    expect(getState().listsTagsVisible?.['l2']).toBeUndefined();
  });
});

// ── E2E deferred ─────────────────────────────────────────────────────────────
// The following behaviours require a real browser and are covered by tests/e2e/lists.spec.js:
// - Back button navigates to /lists
// - Swipe gestures on list-item (Pointer Events not fully simulated in happy-dom)
// - IDB persistence of toggle preference across page reload
// - Menu dialog open/close (native <dialog> showModal() not available in happy-dom)
// - list-delete-btn second click navigates back to /lists (navigation tested in E2E)
