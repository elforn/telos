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
    localStorage.setItem('lists.showStatus.l1', 'false');
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
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
    localStorage.setItem('lists.showStatus.l1', 'false');
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
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
    expect(el.shadowRoot.querySelector('#item-list').style.getPropertyValue('--list-badge-display')).toBe('none');
  });

  it('clicking hide then show pill restores badge', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [{ ...LIST, items: [ITEM] }] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#status-hide-btn')).not.toBeNull());
    el.shadowRoot.querySelector('#status-hide-btn').click();
    el.shadowRoot.querySelector('#status-show-btn').click();
    expect(el.shadowRoot.querySelector('#item-list').style.getPropertyValue('--list-badge-display')).toBe('');
  });

  it('clicking hide pill persists false to localStorage', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [LIST] } });
    const el = mount();
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('#status-hide-btn')).not.toBeNull());
    el.shadowRoot.querySelector('#status-hide-btn').click();
    expect(localStorage.getItem('lists.showStatus.l1')).toBe('false');
  });

  it('preference is scoped per list — different lists are independent', async () => {
    localStorage.setItem('lists.showStatus.l1', 'false');
    const LIST2 = { id: 'l2', name: 'Books', items: [] };
    await boot({ dbName: freshName(), initialState: { lists: [LIST, LIST2] } });

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

// ── E2E deferred ─────────────────────────────────────────────────────────────
// The following behaviours require a real browser and are covered by tests/e2e/lists.spec.js:
// - Back button navigates to /lists
// - Swipe gestures on list-item (Pointer Events not fully simulated in happy-dom)
// - IDB persistence of toggle preference across page reload
// - Menu dialog open/close (native <dialog> showModal() not available in happy-dom)
