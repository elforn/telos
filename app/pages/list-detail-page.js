import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, subscribe, unsubscribe } from '../../_lib/core/store/store.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import '../components/list-item/list-item.js';
import '../components/item-dialog/item-dialog.js';
import '../components/add-row/add-row.js';

const lsKey = id => `lists.showStatus.${id}`;

class ListDetailPage extends AppElement {
  template() {
    return `
      <style>
        @media (prefers-reduced-motion: reduce) {
          dialog[open], dialog::backdrop { animation: none; }
        }

        :host {
          display: block;
          --page-padding: var(--space-5);
        }

        /* ── Header — matches year-header style ──────────────────────────── */

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

        .back-btn,
        .menu-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-heading);
          color: var(--color-text-secondary);
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
        }

        .back-btn {
          margin-inline-start: calc(-1 * var(--page-padding));
        }

        .back-btn:focus-visible,
        .menu-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        h1 {
          flex: 1;
          min-inline-size: 0;
          font-size: var(--font-size-heading);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          line-height: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: start;
          margin: 0;
        }

        /* ── Main content ────────────────────────────────────────────────── */

        main {
          display: flex;
          flex-direction: column;
          padding: var(--space-3) var(--page-padding);
          padding-block-end: calc(var(--bottom-nav-height) + var(--space-2));
        }

        #item-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        /* ── Menu dialog — matches year-header sheet exactly ─────────────── */

        dialog {
          position: fixed;
          inset-block-end: 0;
          inset-inline-start: 0;
          inset-block-start: auto;
          margin: 0;
          inline-size: 100%;
          max-inline-size: 100%;
          background: var(--color-surface);
          border: none;
          border-start-start-radius: var(--radius-lg);
          border-start-end-radius: var(--radius-lg);
          border-end-start-radius: 0;
          border-end-end-radius: 0;
          padding: 0;
          padding-block-end: calc(var(--space-3) + var(--safe-area-bottom, 0px));
          box-shadow: var(--shadow-sheet);
          color: var(--color-text-primary);
          font-family: var(--font-family);
        }

        dialog[open] {
          animation: menu-in 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }

        dialog::backdrop {
          background: var(--color-overlay);
          animation: fade-in 0.2s ease-out;
        }

        .menu-handle {
          inline-size: 36px;
          block-size: 4px;
          border-radius: var(--radius-full);
          background: var(--color-border);
          margin: var(--space-3) auto var(--space-1);
        }

        .menu-section {
          padding: var(--space-4) var(--space-5);
        }

        .menu-section-label {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0;
          margin-block-end: var(--space-2);
        }

        .status-pill-group {
          display: flex;
          gap: var(--space-1);
          background: var(--color-surface-raised);
          border-radius: var(--radius-full);
          padding: var(--pill-inset);
        }

        .status-pill {
          flex: 1;
          min-block-size: var(--touch-target);
          border: none;
          border-radius: var(--radius-full);
          background: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          text-align: center;
        }

        .status-pill.active {
          background: var(--color-surface);
          color: var(--color-text-primary);
          box-shadow: var(--shadow-card);
        }

        .status-pill:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>

      <div class="page-header">
        <div class="top-row">
          <button class="back-btn" id="back-btn" aria-label="${t('list-detail.back')}">‹</button>
          <h1 id="list-name"></h1>
          <button class="menu-btn" id="menu-btn" aria-label="${t('list-detail.menu')}" aria-expanded="false">···</button>
        </div>
      </div>

      <main>
        <div id="item-list" role="list"></div>
        <add-row id="add-row">+ ${t('list-detail.add')}</add-row>
      </main>

      <dialog id="menu">
        <div class="menu-handle"></div>
        <div class="menu-section">
          <p class="menu-section-label">${t('list-detail.status-label')}</p>
          <div class="status-pill-group" role="group" aria-label="${t('list-detail.status-label')}">
            <button class="status-pill" id="status-show-btn">${t('list-detail.status-show')}</button>
            <button class="status-pill" id="status-hide-btn">${t('list-detail.status-hide')}</button>
          </div>
        </div>
      </dialog>

      <item-dialog id="dialog"></item-dialog>
    `;
  }

  subscribe() {
    this._listId = this.params?.listId;
    if (!this._listId) { navigate(`${BASE_PATH}lists`); return; }


    this._itemList    = this.shadowRoot.querySelector('#item-list');
    this._nameEl      = this.shadowRoot.querySelector('#list-name');
    this._dialog      = this.shadowRoot.querySelector('#dialog');
    this._menuDialog  = this.shadowRoot.querySelector('#menu');
    this._editingItem = null;
    this._drag        = null;
    this._insertLine  = null;

    // Status preference — per list
    this._showStatus = localStorage.getItem(lsKey(this._listId)) !== 'false';
    this._applyStatusPref();

    this._onBack = () => navigate(`${BASE_PATH}lists`);
    this.shadowRoot.querySelector('#back-btn').addEventListener('click', this._onBack);

    const menuBtn = this.shadowRoot.querySelector('#menu-btn');
    this._onMenuBtn = () => {
      this._menuDialog.showModal();
      menuBtn.setAttribute('aria-expanded', 'true');
    };
    menuBtn.addEventListener('click', this._onMenuBtn);

    this._onMenuClose = () => menuBtn.setAttribute('aria-expanded', 'false');
    this._menuDialog.addEventListener('close', this._onMenuClose);

    this._onBackdrop = e => { if (e.target === this._menuDialog) this._menuDialog.close(); };
    this._menuDialog.addEventListener('click', this._onBackdrop);

    this._onStatusShow = () => {
      if (this._showStatus) return;
      this._showStatus = true;
      localStorage.setItem(lsKey(this._listId), 'true');
      this._applyStatusPref();
    };
    this._onStatusHide = () => {
      if (!this._showStatus) return;
      this._showStatus = false;
      localStorage.setItem(lsKey(this._listId), 'false');
      this._applyStatusPref();
    };
    this.shadowRoot.querySelector('#status-show-btn').addEventListener('click', this._onStatusShow);
    this.shadowRoot.querySelector('#status-hide-btn').addEventListener('click', this._onStatusHide);

    this._onAddRow = () => {
      this._editingItem = null;
      this._dialog.open(null);
    };
    this.shadowRoot.querySelector('#add-row').addEventListener('click', this._onAddRow);

    this._onItemTap = e => {
      this._editingItem = e.detail.item;
      this._dialog.open(this._editingItem);
    };
    this._itemList.addEventListener('item-tap', this._onItemTap);

    this._onItemDelete = e => {
      this._deleteItem(e.detail.item.id);
      toast(t('lists.toast-item-deleted'), 'info');
    };
    this._itemList.addEventListener('item-delete', this._onItemDelete);

    this._onItemDoneToggle = e => {
      const item = e.detail.item;
      const newStatus = item.status === 'done' ? 'open' : 'done';
      this._editItem(item.id, { title: item.title, status: newStatus });
    };
    this._itemList.addEventListener('item-done-toggle', this._onItemDoneToggle);

    this._onItemSaved = e => {
      const { title, status, note, url } = e.detail;
      if (this._editingItem) {
        this._editItem(this._editingItem.id, { title, status, note, url });
      } else {
        this._addItem({ title, status, note, url });
      }
      toast(t('lists.toast-item-saved'), 'success');
    };
    this.shadowRoot.addEventListener('item-saved', this._onItemSaved);

    this._onDialogDelete = () => {
      if (this._editingItem) {
        this._deleteItem(this._editingItem.id);
        toast(t('lists.toast-item-deleted'), 'info');
      }
    };
    this._dialog.addEventListener('item-delete', this._onDialogDelete);

    // ── Drag-to-reorder ───────────────────────────────────────────────────────

    this._onItemDragStart = e => {
      const { item, element: dragEl, startX, startY } = e.detail;
      const items     = [...this._itemList.querySelectorAll('list-item')];
      const fromIndex = items.indexOf(dragEl);
      const rect      = dragEl.getBoundingClientRect();

      dragEl.style.opacity = '0.4';

      const clone = this._createDragClone(rect, item.title);
      clone.style.left = `${rect.left}px`;
      clone.style.top  = `${rect.top}px`;
      document.body.appendChild(clone);

      if (!this._insertLine) {
        this._insertLine = document.createElement('div');
        this._insertLine.style.cssText = 'height:2px;border-radius:1px;margin-block:calc(var(--space-2)/2);pointer-events:none;background:var(--color-accent)';
      }

      this._drag = { item, fromIndex, dragEl, clone,
        offsetX: startX - rect.left, offsetY: startY - rect.top,
        targetIndex: fromIndex, scrollSpeed: 0, scrollRaf: null };

      const scrollLoop = () => {
        if (!this._drag) return;
        if (this._drag.scrollSpeed !== 0) window.scrollBy(0, this._drag.scrollSpeed);
        this._drag.scrollRaf = requestAnimationFrame(scrollLoop);
      };
      this._drag.scrollRaf = requestAnimationFrame(scrollLoop);

      dragEl.addEventListener('pointermove',   this._onDragMove);
      dragEl.addEventListener('pointerup',     this._onDragEnd);
      dragEl.addEventListener('pointercancel', this._onDragEnd);
    };

    this._onDragMove = e => {
      if (!this._drag) return;
      const { dragEl, clone, offsetX, offsetY } = this._drag;
      clone.style.left = `${e.clientX - offsetX}px`;
      clone.style.top  = `${e.clientY - offsetY}px`;

      const SCROLL_ZONE = 100;
      const MAX_SPEED   = 14;
      const vh = window.innerHeight;
      if (e.clientY < SCROLL_ZONE)
        this._drag.scrollSpeed = -MAX_SPEED * (1 - e.clientY / SCROLL_ZONE);
      else if (e.clientY > vh - SCROLL_ZONE)
        this._drag.scrollSpeed =  MAX_SPEED * (1 - (vh - e.clientY) / SCROLL_ZONE);
      else
        this._drag.scrollSpeed = 0;

      const idx = this._insertIndexAt(this._itemList, e.clientY, dragEl);
      this._drag.targetIndex = idx;
      this._updateInsertLine(this._itemList, idx, dragEl);
    };

    this._onDragEnd = () => {
      if (!this._drag) return;
      const { fromIndex, dragEl, clone, targetIndex } = this._drag;
      dragEl.removeEventListener('pointermove',   this._onDragMove);
      dragEl.removeEventListener('pointerup',     this._onDragEnd);
      dragEl.removeEventListener('pointercancel', this._onDragEnd);
      dragEl.style.opacity = '';
      cancelAnimationFrame(this._drag.scrollRaf);
      clone.remove();
      this._insertLine?.remove();
      this._drag = null;
      this._placeItem(fromIndex, targetIndex);
    };

    this._onItemReorderKey = e => {
      const { item, direction } = e.detail;
      const items = [...this._itemList.querySelectorAll('list-item')];
      const fromIndex = items.findIndex(el => el._item?.id === item.id);
      if (fromIndex === -1) return;
      const toIndex = direction === -1 ? Math.max(0, fromIndex - 1) : fromIndex + 2;
      this._placeItem(fromIndex, toIndex);
    };

    this._itemList.addEventListener('item-drag-start',  this._onItemDragStart);
    this._itemList.addEventListener('item-reorder-key', this._onItemReorderKey);

    // ── Store ─────────────────────────────────────────────────────────────────

    this._onLists = lists => {
      const list = (lists ?? []).find(l => l.id === this._listId);
      if (!list) { navigate(`${BASE_PATH}lists`); return; }
      this._nameEl.textContent = list.name;
      this._renderItems(list.items ?? []);
    };
    subscribe('lists', this._onLists);
  }

  unsubscribe() {
    this.shadowRoot?.querySelector('#back-btn')?.removeEventListener('click', this._onBack);
    this.shadowRoot?.querySelector('#menu-btn')?.removeEventListener('click', this._onMenuBtn);
    this._menuDialog?.removeEventListener('close', this._onMenuClose);
    this._menuDialog?.removeEventListener('click', this._onBackdrop);
    this.shadowRoot?.querySelector('#status-show-btn')?.removeEventListener('click', this._onStatusShow);
    this.shadowRoot?.querySelector('#status-hide-btn')?.removeEventListener('click', this._onStatusHide);
    this.shadowRoot?.querySelector('#add-row')?.removeEventListener('click', this._onAddRow);
    this._itemList?.removeEventListener('item-tap', this._onItemTap);
    this._itemList?.removeEventListener('item-delete', this._onItemDelete);
    this._itemList?.removeEventListener('item-done-toggle', this._onItemDoneToggle);
    this._itemList?.removeEventListener('item-drag-start',  this._onItemDragStart);
    this._itemList?.removeEventListener('item-reorder-key', this._onItemReorderKey);
    this.shadowRoot?.removeEventListener('item-saved', this._onItemSaved);
    this._dialog?.removeEventListener('item-delete', this._onDialogDelete);
    if (this._drag) {
      const { dragEl, clone } = this._drag;
      dragEl.removeEventListener('pointermove',   this._onDragMove);
      dragEl.removeEventListener('pointerup',     this._onDragEnd);
      dragEl.removeEventListener('pointercancel', this._onDragEnd);
      dragEl.style.opacity = '';
      cancelAnimationFrame(this._drag.scrollRaf);
      clone.remove();
      this._insertLine?.remove();
      this._drag = null;
    }
    if (this._onLists) unsubscribe('lists', this._onLists);
  }

  // ── Store mutations ───────────────────────────────────────────────────────

  _mutateItems(fn) {
    setState('lists', (getState().lists ?? []).map(l =>
      l.id === this._listId ? { ...l, items: fn(l.items ?? []) } : l
    ));
  }

  _addItem({ title, status, note, url }) {
    const item = {
      id: crypto.randomUUID(), title, status,
      note, url, dueDate: undefined,
      tags: [], inGoals: [],
    };
    this._mutateItems(items => [...items, item]);
  }

  _editItem(id, { title, status, note, url }) {
    this._mutateItems(items => items.map(i => i.id === id ? { ...i, title, status, note, url } : i));
  }

  _deleteItem(id) {
    this._mutateItems(items => items.filter(i => i.id !== id));
  }

  // ── Drag helpers ──────────────────────────────────────────────────────────

  _insertIndexAt(list, y, ghostEl) {
    const items = [...list.querySelectorAll('list-item')];
    for (const item of items.filter(el => el !== ghostEl)) {
      const r = item.getBoundingClientRect();
      if (y < r.top + r.height / 2) return items.indexOf(item);
    }
    return items.length;
  }

  _updateInsertLine(list, targetIndex, ghostEl) {
    const items = [...list.querySelectorAll('list-item')];
    if (targetIndex >= items.length) list.appendChild(this._insertLine);
    else list.insertBefore(this._insertLine, items[targetIndex]);
  }

  _createDragClone(rect, title) {
    const clone = document.createElement('div');
    clone.setAttribute('aria-hidden', 'true');
    clone.style.cssText = [
      'position:fixed',
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      'background:var(--color-surface)',
      'border:0.5px solid var(--color-border)',
      'border-radius:var(--radius-md)',
      'box-shadow:0 8px 24px rgba(0,0,0,0.18)',
      'display:flex',
      'align-items:center',
      'padding:0 var(--space-3)',
      'pointer-events:none',
      'z-index:9999',
      'overflow:hidden',
      'white-space:nowrap',
      'text-overflow:ellipsis',
      'font-family:var(--font-family)',
      'font-size:var(--font-size-body)',
      'font-weight:var(--font-weight-medium)',
      'color:var(--color-text-primary)',
    ].join(';');
    clone.textContent = title;
    return clone;
  }

  _placeItem(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex === toIndex - 1) return;
    this._mutateItems(items => {
      const arr = [...items];
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, item);
      return arr;
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _applyStatusPref() {
    if (this._itemList) {
      if (this._showStatus) {
        this._itemList.style.removeProperty('--list-badge-display');
      } else {
        this._itemList.style.setProperty('--list-badge-display', 'none');
      }
    }
    const showBtn = this.shadowRoot?.querySelector('#status-show-btn');
    const hideBtn = this.shadowRoot?.querySelector('#status-hide-btn');
    if (showBtn) showBtn.classList.toggle('active', this._showStatus);
    if (hideBtn) hideBtn.classList.toggle('active', !this._showStatus);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _renderItems(items) {
    const byId = new Map();
    this._itemList.querySelectorAll('list-item').forEach(el => {
      if (el._item?.id) byId.set(el._item.id, el);
    });

    const ordered = items.map(item => {
      const el = byId.get(item.id) ?? document.createElement('list-item');
      byId.delete(item.id);
      el.item = item;
      return el;
    });

    byId.forEach(el => el.remove());
    ordered.forEach(el => this._itemList.appendChild(el));
  }
}

customElements.define('list-detail-page', ListDetailPage);
