import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, subscribe, unsubscribe } from '../../_lib/core/store/store.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import '../components/list-dialog/list-dialog.js';
import '../components/add-row/add-row.js';

class ListsPage extends AppElement {
  template() {
    return `
      <style>
        :host {
          display: block;
          --page-padding: var(--space-5);
        }

        /* ── Header — matches year-header compact style ──────────────────── */

        .page-header {
          position: sticky;
          inset-block-start: var(--update-banner-height, 0px);
          z-index: 100;
          background: var(--color-surface);
          border-block-end: 1px solid var(--color-border);
          padding-block-start: var(--safe-area-top);
          padding-inline: var(--page-padding);
        }

        .top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-block-size: 64px;
        }

        h1 {
          font-size: var(--font-size-title);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          line-height: 1;
          margin: 0;
          margin-inline-start: calc(var(--touch-target) - var(--page-padding));
        }

        /* ── Main content ────────────────────────────────────────────────── */

        main {
          display: flex;
          flex-direction: column;
          padding: var(--space-3) var(--page-padding);
          padding-block-end: calc(var(--bottom-nav-height) + var(--space-2));
        }

        #list-container {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .list-row {
          display: flex;
          align-items: center;
          min-block-size: var(--goal-item-height, 44px);
          background: var(--color-surface);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-card);
          padding-inline: var(--space-3);
          gap: var(--space-2);
          cursor: pointer;
          user-select: none;
        }

        .list-row:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .list-name {
          flex: 1;
          min-inline-size: 0;
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-count {
          flex-shrink: 0;
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          padding-inline-end: var(--space-1);
        }

        .edit-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .edit-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>

      <div class="page-header">
        <div class="top-row">
          <h1>${t('lists-page.heading')}</h1>
        </div>
      </div>
      <main>
        <div id="list-container" role="list"></div>
        <add-row id="add-row">+ ${t('lists-page.add')}</add-row>
      </main>
      <list-dialog id="dialog"></list-dialog>
    `;
  }

  subscribe() {
    this._container   = this.shadowRoot.querySelector('#list-container');
    this._dialog      = this.shadowRoot.querySelector('#dialog');
    this._editingList = null;

    this._onAddRow = () => {
      this._editingList = null;
      this._dialog.open(null);
    };
    this.shadowRoot.querySelector('#add-row').addEventListener('click', this._onAddRow);

    this._onListClick = e => {
      const editBtn = e.target.closest('.edit-btn');
      if (editBtn) {
        e.stopPropagation();
        const id = editBtn.closest('.list-row').dataset.id;
        this._editingList = (getState().lists ?? []).find(l => l.id === id) ?? null;
        this._dialog.open(this._editingList);
        return;
      }
      const row = e.target.closest('.list-row');
      if (row) navigate(`${BASE_PATH}lists/${row.dataset.id}`);
    };
    this._container.addEventListener('click', this._onListClick);

    this._onListKeyDown = e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('.edit-btn')) return;
      const row = e.target.closest('.list-row');
      if (!row) return;
      e.preventDefault();
      navigate(`${BASE_PATH}lists/${row.dataset.id}`);
    };
    this._container.addEventListener('keydown', this._onListKeyDown);

    this._onListSaved = e => {
      const { name } = e.detail;
      if (this._editingList) {
        this._rename(this._editingList.id, name);
      } else {
        this._create(name);
      }
      toast(t('lists.toast-list-saved'), 'success');
    };
    this.shadowRoot.addEventListener('list-saved', this._onListSaved);

    this._onListDelete = () => {
      if (this._editingList) {
        this._delete(this._editingList.id);
        toast(t('lists.toast-list-deleted'), 'info');
      }
    };
    this._dialog.addEventListener('list-delete', this._onListDelete);

    this._onLists = lists => this._renderLists(lists ?? []);
    subscribe('lists', this._onLists);
  }

  unsubscribe() {
    this.shadowRoot.querySelector('#add-row')?.removeEventListener('click', this._onAddRow);
    this._container?.removeEventListener('click', this._onListClick);
    this._container?.removeEventListener('keydown', this._onListKeyDown);
    this.shadowRoot?.removeEventListener('list-saved', this._onListSaved);
    this._dialog?.removeEventListener('list-delete', this._onListDelete);
    unsubscribe('lists', this._onLists);
  }

  // ── Store mutations ───────────────────────────────────────────────────────

  _create(name) {
    const list = { id: crypto.randomUUID(), name, items: [] };
    setState('lists', [...(getState().lists ?? []), list]);
  }

  _rename(id, name) {
    setState('lists', (getState().lists ?? []).map(l => l.id === id ? { ...l, name } : l));
  }

  _delete(id) {
    setState('lists', (getState().lists ?? []).filter(l => l.id !== id));
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _renderLists(lists) {
    const byId = new Map();
    this._container.querySelectorAll('.list-row').forEach(el => {
      if (el.dataset.id) byId.set(el.dataset.id, el);
    });

    const ordered = lists.map(list => {
      let row = byId.get(list.id);
      if (!row) {
        row = this._createRow(list);
      } else {
        byId.delete(list.id);
        this._updateRow(row, list);
      }
      return row;
    });

    byId.forEach(el => el.remove());
    ordered.forEach(el => this._container.appendChild(el));
  }

  _createRow(list) {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.dataset.id = list.id;
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.innerHTML = `
      <span class="list-name"></span>
      <span class="item-count"></span>
      <button class="edit-btn" type="button" aria-label="">···</button>
    `;
    this._updateRow(row, list);
    return row;
  }

  _updateRow(row, list) {
    row.querySelector('.list-name').textContent = list.name;
    row.querySelector('.item-count').textContent = list.items?.length ?? 0;
    row.querySelector('.edit-btn').setAttribute('aria-label', `${t('lists-page.edit')} ${list.name}`);
    row.setAttribute('aria-label', list.name);
  }
}

customElements.define('lists-page', ListsPage);
