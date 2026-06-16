// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { boot, setState, reset } from '../../_lib/core/store/store.js';
import '../../app/strings.js';
import '../../app/pages/lists-page.js';
import '../../app/components/list-dialog/list-dialog.js';

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
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#list-container').querySelectorAll('.list-row').length).toBe(2)
    );
  });

  it('renders list name in each row', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Gift ideas', items: [] }]);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('.list-name').textContent).toBe('Gift ideas')
    );
  });

  it('reuses existing row element on update (reconciliation)', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Original', items: [] }]);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('.list-row')).not.toBeNull()
    );
    const firstRow = el.shadowRoot.querySelector('.list-row');
    setState('lists', [{ id: 'l1', name: 'Renamed', items: [] }]);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('.list-name').textContent).toBe('Renamed')
    );
    expect(el.shadowRoot.querySelector('.list-row')).toBe(firstRow);
  });

  it('removes row when list is deleted from state', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Gift ideas', items: [] }]);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('.list-row')).not.toBeNull()
    );
    setState('lists', []);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('.list-row')).toBeNull()
    );
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
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#list-container').querySelectorAll('.list-row').length).toBe(1)
    );
    expect(el.shadowRoot.querySelector('.list-name').textContent).toBe('Reading list');
  });

  it('persists the new list to the store', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    el.shadowRoot.querySelector('#add-row').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('list-saved', {
      bubbles: true, composed: true, detail: { name: 'Ideas' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('.list-row')).not.toBeNull()
    );
    const { lists } = (await import('../../_lib/core/store/store.js')).getState();
    expect(lists).toHaveLength(1);
    expect(lists[0].name).toBe('Ideas');
    expect(lists[0].items).toEqual([]);
  });
});

describe('lists-page — rename list', () => {
  it('renames a list when list-saved fires after edit click', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Old name', items: [] }]);
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('.edit-btn')).not.toBeNull());

    el.shadowRoot.querySelector('.edit-btn').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('list-saved', {
      bubbles: true, composed: true, detail: { name: 'New name' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('.list-name').textContent).toBe('New name')
    );
  });
});

describe('lists-page — delete list', () => {
  it('removes a list when list-delete fires on dialog', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'To delete', items: [] }]);
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('.edit-btn')).not.toBeNull());

    el.shadowRoot.querySelector('.edit-btn').click();
    el.shadowRoot.querySelector('#dialog').dispatchEvent(
      new CustomEvent('list-delete', { bubbles: true, composed: true })
    );
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('.list-row')).toBeNull()
    );
  });
});

describe('lists-page — accessibility', () => {
  it('list rows have role="button"', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Gift ideas', items: [] }]);
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('.list-row')).not.toBeNull());
    expect(el.shadowRoot.querySelector('.list-row').getAttribute('role')).toBe('button');
  });

  it('list row aria-label matches the list name', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Gift ideas', items: [] }]);
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('.list-row')).not.toBeNull());
    expect(el.shadowRoot.querySelector('.list-row').getAttribute('aria-label')).toBe('Gift ideas');
  });

  it('list row aria-label updates when list is renamed', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Original', items: [] }]);
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('.list-row')).not.toBeNull());
    setState('lists', [{ id: 'l1', name: 'Renamed', items: [] }]);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('.list-row').getAttribute('aria-label')).toBe('Renamed')
    );
  });

  it('edit button aria-label includes the list name', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Gift ideas', items: [] }]);
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('.edit-btn')).not.toBeNull());
    expect(el.shadowRoot.querySelector('.edit-btn').getAttribute('aria-label')).toContain('Gift ideas');
  });

  it('item count is displayed in each row', async () => {
    await boot({ dbName: freshName(), initialState: { lists: [] } });
    const el = mount();
    setState('lists', [{ id: 'l1', name: 'Ideas', items: [
      { id: 'i1', title: 'a', status: 'open', tags: [], inGoals: [] },
      { id: 'i2', title: 'b', status: 'open', tags: [], inGoals: [] },
    ] }]);
    await vi.waitFor(() => expect(el.shadowRoot.querySelector('.item-count')).not.toBeNull());
    expect(el.shadowRoot.querySelector('.item-count').textContent).toBe('2');
  });
});
