// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { boot, setState, getState, reset } from '../../_lib/core/store/store.js';
import '../../app/strings.js';
import '../../app/pages/list-detail-page.js';
import { _resetToast } from '../../_lib/modules/toast/toast.js';

vi.mock('../../app/utils/handoff.js', () => ({
  buildListHandoff: vi.fn(list => ({ __telosHandoff: true, kind: 'list', lists: [list] })),
  buildItemHandoff: vi.fn(item => ({ __telosHandoff: true, kind: 'item', item })),
  buildItemsHandoff: vi.fn(items => ({ __telosHandoff: true, kind: 'items', items })),
  shareHandoff: vi.fn().mockResolvedValue(true),
}));

import { buildListHandoff, buildItemHandoff, buildItemsHandoff, shareHandoff } from '../../app/utils/handoff.js';

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
  // Stub the raw bulk <dialog> sheets so showModal()/close() don't throw in happy-dom
  for (const id of ['#bulk-status-sheet', '#bulk-more-sheet', '#bulk-tags-sheet']) {
    const sheet = el.shadowRoot.querySelector(id);
    if (sheet) { sheet.showModal = vi.fn(); sheet.close = vi.fn(); }
  }
  // Stub export-sheet internal dialog so showModal()/close() don't throw in happy-dom
  const exportSheet = el.shadowRoot.querySelector('#export-sheet');
  if (exportSheet) {
    const exportDialog = exportSheet.shadowRoot?.querySelector('#sheet');
    if (exportDialog) { exportDialog.showModal = vi.fn(); exportDialog.close = vi.fn(); }
  }
  // Stub import-text-dialog's inner modal-dialog so show()/close() are synchronous and close() fires modal-close
  const importDialog = el.shadowRoot.querySelector('#import-dialog');
  if (importDialog) {
    const importModal = importDialog.shadowRoot.querySelector('#modal');
    importModal.show  = vi.fn();
    importModal.close = vi.fn(() => {
      importModal.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
    });
  }
  return el;
}

beforeEach(() => {
  reset();
  localStorage.clear();
});
afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

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
  it('adds an item when item-created fires', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#add-row')).not.toBeNull());
    el.shadowRoot.querySelector('#add-row').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('item-created', {
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
    el.shadowRoot.dispatchEvent(new CustomEvent('item-created', {
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
    el.shadowRoot.dispatchEvent(new CustomEvent('item-created', {
      bubbles: true, composed: true, detail: { title: 'New item', status: 'open' },
    }));
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
  });
});

describe('list-detail-page — edit item (blur-save)', () => {
  it('updates title when item-title-changed fires after item-tap', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-title-changed', {
      bubbles: true, composed: true, detail: { title: 'Edited title' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].title).toBe('Edited title'));
  });

  it('updates note when item-note-changed fires after item-tap', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-note-changed', {
      bubbles: true, composed: true, detail: { note: 'Updated note' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].note).toBe('Updated note'));
  });

  it('updates url when item-url-changed fires after item-tap', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-url-changed', {
      bubbles: true, composed: true, detail: { url: 'https://new.example.com' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].url).toBe('https://new.example.com'));
  });

  it('updates dueDate when item-duedate-changed fires after item-tap', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-duedate-changed', {
      bubbles: true, composed: true, detail: { dueDate: '2026-09-01' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].dueDate).toBe('2026-09-01'));
  });

  it('updates colour when item-color-changed fires after item-tap', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-color-changed', {
      bubbles: true, composed: true, detail: { color: '#E5534B' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].color).toBe('#E5534B'));
  });

  it('removes colour when item-color-changed fires with null', async () => {
    const coloredItem = { ...ITEM, color: '#4A94D4' };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [coloredItem] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: coloredItem },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-color-changed', {
      bubbles: true, composed: true, detail: { color: null },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].color).toBeUndefined());
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

describe('list-detail-page — colour cycle', () => {
  it('cycles item colour from none to the first palette colour on item-color-cycle', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-color-cycle', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].color).toBe('#E5534B'));
  });

  it('cycles item colour back to none (no color key) after the last palette colour', async () => {
    const purpleItem = { ...ITEM, color: '#8B67D6' };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [purpleItem] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-color-cycle', {
      bubbles: true, composed: true, detail: { item: purpleItem },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items[0].color).toBeUndefined());
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
    // Reorder.attach locates the dragged element via composedPath(), matching
    // list-item's real dispatch (on itself) — fire on the item, not the container.
    el.shadowRoot.querySelectorAll('list-item')[0].dispatchEvent(new CustomEvent('item-reorder-key', {
      bubbles: true, composed: true, detail: { item: ITEM_A, direction: 1 },
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
    el.shadowRoot.querySelectorAll('list-item')[2].dispatchEvent(new CustomEvent('item-reorder-key', {
      bubbles: true, composed: true, detail: { item: ITEM_C, direction: -1 },
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
    el.shadowRoot.querySelectorAll('list-item')[0].dispatchEvent(new CustomEvent('item-reorder-key', {
      bubbles: true, composed: true, detail: { item: ITEM_A, direction: -1 },
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

  it('copying to same list duplicates the item with a new id', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-move', {
      bubbles: true, composed: true,
      detail: { title: ITEM.title, status: ITEM.status, note: undefined, url: undefined, tags: ITEM.tags, targetListIds: ['l1'], copy: true },
    }));

    await vi.waitFor(() => expect(getState().lists[0].items).toHaveLength(2));
    const [original, clone] = getState().lists[0].items;
    expect(original.id).toBe('i1');
    expect(clone.id).not.toBe('i1');
    expect(clone.title).toBe(ITEM.title);
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
      detail: { title: 'Flowers', status: 'open', note: undefined, url: undefined, dueDate: undefined, tags: [], year: '2026', section: 'milestones' },
    }));

    await vi.waitFor(() => {
      const goals = getState().goals?.['2026']?.milestones ?? [];
      expect(goals).toHaveLength(1);
      expect(goals[0].title).toBe('Flowers');
    });
  });

  it('new goal has the canonical percentage-tracking shape', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }], goals: {} } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-promote', {
      bubbles: true, composed: true,
      detail: { title: 'Flowers', status: 'open', note: undefined, url: undefined, dueDate: undefined, tags: [], year: '2026', section: 'capstone' },
    }));

    await vi.waitFor(() => {
      const goal = getState().goals?.['2026']?.capstone?.[0];
      expect(goal?.tracking).toEqual({ type: 'percentage', value: 0 });
      expect(goal && 'percentage' in goal).toBe(false);
    });
  });

  it('carries the item\'s tags and dueDate onto the created goal', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }], goals: {} } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());

    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-promote', {
      bubbles: true, composed: true,
      detail: { title: 'Flowers', status: 'open', note: undefined, url: undefined, dueDate: '2026-08-01', tags: ['garden', 'urgent'], year: '2026', section: 'capstone' },
    }));

    await vi.waitFor(() => {
      const goal = getState().goals?.['2026']?.capstone?.[0];
      expect(goal?.tags).toEqual(['garden', 'urgent']);
      expect(goal?.dueDate).toBe('2026-08-01');
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
      detail: { title: 'Flowers', status: 'open', note: undefined, url: undefined, dueDate: undefined, tags: [], year: '2026', section: 'wow' },
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
      detail: { title: 'Flowers', status: 'open', note: undefined, url: undefined, dueDate: undefined, tags: [], year: '2026', section: 'milestones' },
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
    el.shadowRoot.querySelector('#bulk-move-menu-btn').click();

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

  it('bulk-tag-apply adds the tag to every selected item', async () => {
    const ITEM2 = { id: 'i2', title: 'Book', status: 'open', tags: ['read'], inGoals: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM, ITEM2] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));
    enterSelectionMode(el);
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-select-toggle', {
      bubbles: true, composed: true, detail: { item: ITEM2 },
    }));

    el.shadowRoot.querySelector('#bulk-tag-editor').dispatchEvent(new CustomEvent('bulk-tag-apply', {
      bubbles: true, composed: true, detail: { tag: 'gift' },
    }));

    await vi.waitFor(() => {
      const items = getState().lists[0].items;
      expect(items.find(i => i.id === 'i1').tags).toContain('gift');
      expect(items.find(i => i.id === 'i2').tags).toEqual(expect.arrayContaining(['read', 'gift']));
    });
  });

  it('bulk-tag-remove removes the tag from every selected item', async () => {
    const A = { id: 'i1', title: 'A', status: 'open', tags: ['gift', 'read'], inGoals: [] };
    const B = { id: 'i2', title: 'B', status: 'open', tags: ['gift'], inGoals: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [A, B] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));
    enterSelectionMode(el, A);
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-select-toggle', {
      bubbles: true, composed: true, detail: { item: B },
    }));

    el.shadowRoot.querySelector('#bulk-tag-editor').dispatchEvent(new CustomEvent('bulk-tag-remove', {
      bubbles: true, composed: true, detail: { tag: 'gift' },
    }));

    await vi.waitFor(() => {
      const items = getState().lists[0].items;
      expect(items.find(i => i.id === 'i1').tags).toEqual(['read']);
      expect(items.find(i => i.id === 'i2').tags).toEqual([]);
    });
  });

  it('bulk-tag-apply leaves non-selected items untouched', async () => {
    const ITEM2 = { id: 'i2', title: 'Book', status: 'open', tags: [], inGoals: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM, ITEM2] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));
    enterSelectionMode(el); // selects only ITEM (i1)

    el.shadowRoot.querySelector('#bulk-tag-editor').dispatchEvent(new CustomEvent('bulk-tag-apply', {
      bubbles: true, composed: true, detail: { tag: 'gift' },
    }));

    await vi.waitFor(() => expect(getState().lists[0].items.find(i => i.id === 'i1').tags).toContain('gift'));
    expect(getState().lists[0].items.find(i => i.id === 'i2').tags).toEqual([]);
  });

  it('opening the tags sheet feeds the editor the selected items’ tags', async () => {
    const ITEM2 = { id: 'i2', title: 'Book', status: 'open', tags: ['read'], inGoals: [] };
    const A = { ...ITEM, tags: ['read'] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [A, ITEM2] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));
    enterSelectionMode(el, A);
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-select-toggle', {
      bubbles: true, composed: true, detail: { item: ITEM2 },
    }));

    el.shadowRoot.querySelector('#bulk-tags-btn').click();

    const editor = el.shadowRoot.querySelector('#bulk-tag-editor');
    expect(editor.selectedTags).toEqual([['read'], ['read']]);
    // 'read' is common to both → a solid chip, no partial marker
    expect(editor.shadowRoot.querySelector('.tag-chip.partial')).toBeNull();
    expect(editor.shadowRoot.querySelector('.tag-chip').dataset.tag).toBe('read');
  });

  it('closing the tags sheet exits selection mode', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);
    expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(false);

    el.shadowRoot.querySelector('#bulk-tags-sheet').dispatchEvent(new Event('close'));

    expect(el.shadowRoot.querySelector('#bulk-bar').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(false);
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

describe('list-detail-page — edit list (blur-save)', () => {
  it('updates list name in the store when list-name-changed fires from list-dialog', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#list-dialog').dispatchEvent(new CustomEvent('list-name-changed', {
      bubbles: true, composed: true, detail: { name: 'Renamed list' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].name).toBe('Renamed list'));
  });

  it('does not affect other lists when renaming', async () => {
    const LIST2 = { id: 'l2', name: 'Books', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [LIST, LIST2] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#list-dialog').dispatchEvent(new CustomEvent('list-name-changed', {
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

  it('removes the orphaned filter localStorage key when the list is deleted', async () => {
    localStorage.setItem('telos:filter:list:l1', JSON.stringify({ query: 'flowers' }));
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    el.shadowRoot.querySelector('#list-delete-btn').click();
    await vi.waitFor(() => expect(getState().lists).toHaveLength(0));
    expect(localStorage.getItem('telos:filter:list:l1')).toBeNull();
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

// ── Archive (menu segmented switch) ─────────────────────────────────────────

describe('list-detail-page — archive list (menu)', () => {
  it('defaults to Active for a non-archived list', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#archive-active-btn').classList.contains('active')).toBe(true));
    expect(el.shadowRoot.querySelector('#archive-archived-btn').classList.contains('active')).toBe(false);
  });

  it('shows Archived as active for an already-archived list', async () => {
    const archivedList = { ...LIST, archived: true };
    await boot({ dbName: freshName(), initialState: { lists: [archivedList] } });
    const el = mount();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#archive-archived-btn').classList.contains('active')).toBe(true));
    expect(el.shadowRoot.querySelector('#archive-active-btn').classList.contains('active')).toBe(false);
  });

  it('archives a non-archived list when Archived is clicked', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#archive-archived-btn').click();
    await vi.waitFor(() => expect(getState().lists[0].archived).toBe(true));
    expect(getState().lists[0].name).toBe('Gift ideas');
  });

  it('unarchives an archived list when Active is clicked', async () => {
    const archivedList = { ...LIST, archived: true };
    await boot({ dbName: freshName(), initialState: { lists: [archivedList] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#archive-active-btn').click();
    await vi.waitFor(() => expect(getState().lists[0].archived).toBe(false));
  });

  it('is a no-op clicking the already-active option', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#archive-active-btn').click();
    await new Promise(r => setTimeout(r, 20));
    expect(getState().lists[0].archived).toBeUndefined();
  });

  it('does not affect other lists when archiving', async () => {
    const LIST2 = { id: 'l2', name: 'Books', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [LIST, LIST2] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#archive-archived-btn').click();
    await vi.waitFor(() => expect(getState().lists[0].archived).toBe(true));
    expect(getState().lists[1].archived).toBeUndefined();
  });

  it('shows a success toast when a list is archived', async () => {
    _resetToast();
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#archive-archived-btn').click();
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-success');
      expect(toastEl?.textContent).toContain('List archived');
    });
  });

  it('shows a success toast when a list is unarchived', async () => {
    _resetToast();
    const archivedList = { ...LIST, archived: true };
    await boot({ dbName: freshName(), initialState: { lists: [archivedList] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#archive-active-btn').click();
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-success');
      expect(toastEl?.textContent).toContain('List unarchived');
    });
  });

  it('closes the menu on click', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#list-name').textContent).toBe('Gift ideas'));
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#archive-archived-btn').click();
    const dialog = el.shadowRoot.querySelector('#menu').shadowRoot.querySelector('dialog');
    expect(dialog.open).toBe(false);
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

  it('extract-confirm after an item-export-request writes just that item to clipboard', async () => {
    const other = { id: 'i2', title: 'Chocolates', status: 'open', tags: [], inGoals: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM, other] }] } });
    const el = mount();
    el.shadowRoot.dispatchEvent(new CustomEvent('item-export-request', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    el.shadowRoot.querySelector('#export-sheet').dispatchEvent(new CustomEvent('extract-confirm', {
      bubbles: true, composed: true, detail: { metadata: false, notes: false },
    }));

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain('Flowers');
    expect(writeText.mock.calls[0][0]).not.toContain('Chocolates');
  });

  it('toasts an error if the clipboard write rejects', async () => {
    _resetToast();
    writeText.mockRejectedValueOnce(new Error('denied'));
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();

    el.shadowRoot.querySelector('#export-sheet').dispatchEvent(new CustomEvent('extract-confirm', {
      bubbles: true, composed: true, detail: { metadata: false, notes: false },
    }));

    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-error');
      expect(toastEl).not.toBeNull();
    });
  });
});

// ── list-detail-page — import from text (wiring) ─────────────────────────────
//
// Draft-recovery/toggle mechanics now live in import-text-dialog and are
// tested there (tests/unit/import-text-dialog.test.js). This just checks
// list-detail-page's own wiring: the menu button opens the dialog scoped to
// this list, and a confirm event actually adds the items with an undo toast.

function openImportDialog(el) {
  el.shadowRoot.querySelector('#import-menu-btn').click();
}

describe('list-detail-page — import from text', () => {
  it('scopes the dialog draftKey to the current list', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount('l1');
    expect(el.shadowRoot.querySelector('#import-dialog').draftKey).toBe('l1');
  });

  it('opens the import-text-dialog from the menu button', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount('l1');
    const dialog = el.shadowRoot.querySelector('#import-dialog');
    const openSpy = vi.spyOn(dialog, 'open');
    openImportDialog(el);
    expect(openSpy).toHaveBeenCalledOnce();
  });

  it('adds the confirmed items to this list and shows an undo toast', async () => {
    _resetToast();
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount('l1');
    const dialog = el.shadowRoot.querySelector('#import-dialog');
    dialog.dispatchEvent(new CustomEvent('import-text-confirm', {
      detail: { items: [{ title: 'Buy flowers', note: undefined, url: undefined }] },
    }));

    await vi.waitFor(() => {
      const lists = getState().lists;
      expect(lists.find(l => l.id === 'l1').items.map(i => i.title)).toEqual(['Buy flowers']);
    });
    expect(document.querySelector('.socle-toast-msg')?.textContent).toBe('Imported 1 items');
  });
});

// ── list-detail-page — _applyFilter ──────────────────────────────────────────

describe('list-detail-page — _applyFilter', () => {
  const ITEM_OPEN   = { id: 'i1', title: 'Open task',   status: 'open',   tags: ['work'],   inGoals: [] };
  const ITEM_DONE   = { id: 'i2', title: 'Done task',   status: 'done',   tags: ['health'], inGoals: [] };
  const ITEM_PAUSED = { id: 'i3', title: 'Paused task', status: 'paused', tags: ['work'],   inGoals: [] };
  const ITEM_CLOSED = { id: 'i4', title: 'Closed task', status: 'closed', tags: [],         inGoals: [] };

  it('text query hides items whose title does not match', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_OPEN, ITEM_DONE] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));

    el._filter = { query: 'done', statuses: new Set(), dates: new Set(), tags: new Set() };
    el._applyFilter();

    const items = [...el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item')];
    expect(items.find(i => i._item.title === 'Done task').hidden).toBe(false);
    expect(items.find(i => i._item.title === 'Open task').hidden).toBe(true);
  });

  it('empty query shows all items', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_OPEN, ITEM_DONE] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));

    el._filter = { query: '', statuses: new Set(), dates: new Set(), tags: new Set() };
    el._applyFilter();

    const items = [...el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item')];
    expect(items.every(i => !i.hidden)).toBe(true);
  });

  it('status filter shows only matching-status items', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_OPEN, ITEM_DONE, ITEM_PAUSED] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));

    el._filter = { query: '', statuses: new Set(['paused']), dates: new Set(), tags: new Set() };
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

    el._filter = { query: '', statuses: new Set(), dates: new Set(), tags: new Set(['health']) };
    el._applyFilter();

    const items = [...el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item')];
    expect(items.find(i => i._item.id === 'i2').hidden).toBe(false); // health tag
    expect(items.find(i => i._item.id === 'i1').hidden).toBe(true);  // work tag only
  });

  it('closed items are hidden by default (no status filter)', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_OPEN, ITEM_CLOSED] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));

    el._filter = { query: '', statuses: new Set(), dates: new Set(), tags: new Set() };
    el._applyFilter();

    const items = [...el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item')];
    expect(items.find(i => i._item.status === 'open').hidden).toBe(false);
    expect(items.find(i => i._item.status === 'closed').hidden).toBe(true);
  });

  it('closed filter pill reveals closed items', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_OPEN, ITEM_CLOSED] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));

    el._filter = { query: '', statuses: new Set(['closed']), dates: new Set(), tags: new Set() };
    el._applyFilter();

    const items = [...el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item')];
    expect(items.find(i => i._item.status === 'closed').hidden).toBe(false);
    expect(items.find(i => i._item.status === 'open').hidden).toBe(true);
  });

  it('combines query and status filter (AND logic)', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM_OPEN, ITEM_DONE, ITEM_PAUSED] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));

    el._filter = { query: 'task', statuses: new Set(['open']), dates: new Set(), tags: new Set() };
    el._applyFilter();

    const items = [...el.shadowRoot.querySelector('#item-list').querySelectorAll('list-item')];
    expect(items.find(i => i._item.status === 'open').hidden).toBe(false);
    expect(items.find(i => i._item.status === 'done').hidden).toBe(true);
    expect(items.find(i => i._item.status === 'paused').hidden).toBe(true);
  });

  it('filters by due date: "overdue" and "none" pills', async () => {
    const iso = d => { const x = new Date(); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    const overdue = { id: 'o', title: 'Overdue', status: 'open', tags: [], inGoals: [], dueDate: iso(-2) };
    const soon    = { id: 's', title: 'Soon',    status: 'open', tags: [], inGoals: [], dueDate: iso(20) };
    const undated = { id: 'u', title: 'Undated', status: 'open', tags: [], inGoals: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [overdue, soon, undated] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(3));
    const byTitle = t => [...el.shadowRoot.querySelectorAll('list-item')].find(i => i._item.title === t);

    el._filter = { query: '', statuses: new Set(), dates: new Set(['overdue']), tags: new Set() };
    el._applyFilter();
    expect(byTitle('Overdue').hidden).toBe(false);
    expect(byTitle('Soon').hidden).toBe(true);
    expect(byTitle('Undated').hidden).toBe(true);

    el._filter = { query: '', statuses: new Set(), dates: new Set(['none']), tags: new Set() };
    el._applyFilter();
    expect(byTitle('Undated').hidden).toBe(false);
    expect(byTitle('Overdue').hidden).toBe(true);
  });
});

// ── list-detail-page — inbound ?q= filter ────────────────────────────────────

describe('list-detail-page — inbound ?q= filter', () => {
  afterEach(() => { history.pushState({}, '', location.pathname); });

  it('?q= param pre-fills the query filter and hides non-matching items on mount', async () => {
    const items = [
      { id: 'i1', title: 'Flowers',    status: 'open', tags: [], inGoals: [] },
      { id: 'i2', title: 'Chocolates', status: 'open', tags: [], inGoals: [] },
    ];
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items }] } });
    history.pushState({}, '', '?q=flowers');
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));
    const listItems = [...el.shadowRoot.querySelectorAll('list-item')];
    expect(listItems.find(i => i._item.title === 'Flowers').hidden).toBe(false);
    expect(listItems.find(i => i._item.title === 'Chocolates').hidden).toBe(true);
  });

  it('no ?q= param shows all items normally', async () => {
    const items = [
      { id: 'i1', title: 'Flowers',    status: 'open', tags: [], inGoals: [] },
      { id: 'i2', title: 'Chocolates', status: 'open', tags: [], inGoals: [] },
    ];
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));
    const listItems = [...el.shadowRoot.querySelectorAll('list-item')];
    expect(listItems.every(i => !i.hidden)).toBe(true);
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

describe('list-detail-page — create with active filter', () => {
  it('shows a hidden-by-filter toast on close whose Show action reveals the new item', async () => {
    _resetToast();
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#add-row')).not.toBeNull());
    el._filter = { query: '', statuses: new Set(['done']), dates: new Set(), tags: new Set() };
    el.shadowRoot.querySelector('#add-row').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('item-created', {
      bubbles: true, composed: true, detail: { id: 'n1', title: 'Invisible item', status: 'open' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items).toHaveLength(1));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-closed', {
      bubbles: true, composed: true,
    }));

    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-info');
      expect(toastEl?.textContent).toContain('hidden by the current filter');
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#item-list list-item')?.hidden).toBe(true)
    );

    document.querySelector('#toast-container .socle-toast-btn').click();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#item-list list-item')?.hidden).toBe(false)
    );
  });

  it('keeps the saved toast when the new item matches the active filter', async () => {
    _resetToast();
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#add-row')).not.toBeNull());
    el._filter = { query: '', statuses: new Set(['open']), dates: new Set(), tags: new Set() };
    el.shadowRoot.querySelector('#add-row').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('item-created', {
      bubbles: true, composed: true, detail: { id: 'n2', title: 'Visible item', status: 'open' },
    }));
    await vi.waitFor(() => expect(getState().lists[0].items).toHaveLength(1));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('item-closed', {
      bubbles: true, composed: true,
    }));

    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-success');
      expect(toastEl?.textContent).toContain('Item saved');
    });
  });
});

describe('list-detail-page — share', () => {
  it('shares the whole current list via the ⋮ menu', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#share-list-menu-btn')).not.toBeNull());
    el.shadowRoot.querySelector('#share-list-menu-btn').click();
    await vi.waitFor(() => expect(shareHandoff).toHaveBeenCalledOnce());
    expect(buildListHandoff).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1', name: 'Gift ideas' }));
    expect(shareHandoff.mock.calls[0][1]).toBe('Gift ideas');
  });

  it('shares a single item via item-share-request', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    el.shadowRoot.dispatchEvent(new CustomEvent('item-share-request', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    await vi.waitFor(() => expect(shareHandoff).toHaveBeenCalledOnce());
    expect(buildItemHandoff).toHaveBeenCalledWith(ITEM);
    expect(shareHandoff.mock.calls[0][1]).toBe('Flowers');
  });

  it('toasts an error if sharing the list fails', async () => {
    _resetToast();
    shareHandoff.mockRejectedValueOnce(new Error('share failed'));
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#share-list-menu-btn')).not.toBeNull());
    el.shadowRoot.querySelector('#share-list-menu-btn').click();
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-error');
      expect(toastEl).not.toBeNull();
    });
  });

  it('toasts an error if sharing a single item fails', async () => {
    _resetToast();
    shareHandoff.mockRejectedValueOnce(new Error('share failed'));
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    el.shadowRoot.dispatchEvent(new CustomEvent('item-share-request', {
      bubbles: true, composed: true, detail: { item: ITEM },
    }));
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-error');
      expect(toastEl).not.toBeNull();
    });
  });

  it('shares the bulk-selected items via the bulk ⋮ menu', async () => {
    const ITEM2 = { id: 'i2', title: 'Book', status: 'open', tags: [], inGoals: [] };
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM, ITEM2] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelectorAll('list-item').length).toBe(2));
    enterSelectionMode(el);
    el.shadowRoot.querySelector('#item-list').dispatchEvent(new CustomEvent('item-select-toggle', {
      bubbles: true, composed: true, detail: { item: ITEM2 },
    }));

    el.shadowRoot.querySelector('#bulk-share-btn').click();

    await vi.waitFor(() => expect(shareHandoff).toHaveBeenCalledOnce());
    expect(buildItemsHandoff).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'i1' }), expect.objectContaining({ id: 'i2' }),
    ]));
    expect(shareHandoff.mock.calls[0][1]).toBe('Gift ideas');
  });

  it('toasts an error if sharing the bulk selection fails', async () => {
    _resetToast();
    shareHandoff.mockRejectedValueOnce(new Error('share failed'));
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('list-item')).not.toBeNull());
    enterSelectionMode(el);
    el.shadowRoot.querySelector('#bulk-share-btn').click();
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-error');
      expect(toastEl).not.toBeNull();
    });
  });
});
