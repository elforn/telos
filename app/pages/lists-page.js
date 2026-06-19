import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, subscribe, unsubscribe } from '../../_lib/core/store/store.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import '../components/list-dialog/list-dialog.js';
import '../components/add-row/add-row.js';
import '../components/lists-page-item/lists-page-item.js';

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

    this._onListTap = e => {
      navigate(`${BASE_PATH}lists/${e.detail.list.id}`);
    };
    this._container.addEventListener('list-tap', this._onListTap);

    this._onListEdit = e => {
      this._editingList = e.detail.list;
      this._dialog.open(this._editingList);
    };
    this._container.addEventListener('list-edit', this._onListEdit);

    this._onSwipeDelete = e => {
      const list = e.detail?.list;
      if (!list) return;
      this._delete(list.id);
      toast(t('lists.toast-list-deleted'), 'info');
    };
    this._container.addEventListener('list-delete', this._onSwipeDelete);

    this._onListSaved = e => {
      const { name, color } = e.detail;
      if (this._editingList) {
        this._update(this._editingList.id, name, color);
      } else {
        this._create(name, color);
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
    this._container?.removeEventListener('list-tap', this._onListTap);
    this._container?.removeEventListener('list-edit', this._onListEdit);
    this._container?.removeEventListener('list-delete', this._onSwipeDelete);
    this.shadowRoot?.removeEventListener('list-saved', this._onListSaved);
    this._dialog?.removeEventListener('list-delete', this._onListDelete);
    unsubscribe('lists', this._onLists);
  }

  // ── Store mutations ───────────────────────────────────────────────────────

  _create(name, color) {
    const list = { id: crypto.randomUUID(), name, items: [] };
    if (color) list.color = color;
    setState('lists', [...(getState().lists ?? []), list]);
  }

  _update(id, name, color) {
    setState('lists', (getState().lists ?? []).map(l => {
      if (l.id !== id) return l;
      const { color: _, ...rest } = l;
      return color ? { ...rest, name, color } : { ...rest, name };
    }));
  }

  _delete(id) {
    setState('lists', (getState().lists ?? []).filter(l => l.id !== id));
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _renderLists(lists) {
    const byId = new Map();
    this._container.querySelectorAll('lists-page-item').forEach(el => {
      if (el.dataset.id) byId.set(el.dataset.id, el);
    });

    const ordered = lists.map(list => {
      let el = byId.get(list.id);
      if (!el) {
        el = document.createElement('lists-page-item');
        el.dataset.id = list.id;
      } else {
        byId.delete(list.id);
      }
      el.list = list;
      return el;
    });

    byId.forEach(el => el.remove());
    ordered.forEach(el => this._container.appendChild(el));
  }
}

customElements.define('lists-page', ListsPage);
