import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, subscribe, unsubscribe } from '../../_lib/core/store/store.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import '../components/list-dialog/list-dialog.js';
import '../components/add-row/add-row.js';
import { COLOR_PALETTE } from '../components/lists-page-item/lists-page-item.js';

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
          padding-block-start: calc(var(--update-banner-height, 0px) + var(--space-3));
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

    this._onListColorCycle = e => {
      const list = e.detail?.list;
      if (!list) return;
      const currentIdx = COLOR_PALETTE.findIndex(c => c === (list.color ?? null));
      const nextColor = COLOR_PALETTE[(currentIdx + 1) % COLOR_PALETTE.length];
      setState('lists', (getState().lists ?? []).map(l => {
        if (l.id !== list.id) return l;
        const { color: _, ...rest } = l;
        return nextColor ? { ...rest, color: nextColor } : rest;
      }));
    };
    this._container.addEventListener('list-color-cycle', this._onListColorCycle);

    this._initDrag();

    // ── Store ─────────────────────────────────────────────────────────────────

    this._onLists = lists => this._renderLists(lists ?? []);
    subscribe('lists', this._onLists);
  }

  _initDrag() {
    this._drag       = null;
    this._insertLine = null;

    this._onListDragStart = e => {
      const { list, element: dragEl, startX, startY } = e.detail;
      const items     = [...this._container.querySelectorAll('lists-page-item')];
      const fromIndex = items.indexOf(dragEl);
      const rect      = dragEl.getBoundingClientRect();

      dragEl.style.opacity = '0.4';

      const clone = this._createDragClone(rect, list.name);
      clone.style.left = `${rect.left}px`;
      clone.style.top  = `${rect.top}px`;
      document.body.appendChild(clone);

      if (!this._insertLine) {
        this._insertLine = document.createElement('div');
        this._insertLine.style.cssText = 'height:2px;border-radius:1px;margin-block:calc(var(--space-2)/2);pointer-events:none;background:var(--color-accent)';
      }

      this._drag = { list, fromIndex, dragEl, clone,
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

      const idx = this._insertIndexAt(this._container, e.clientY, dragEl);
      this._drag.targetIndex = idx;
      this._updateInsertLine(this._container, idx, dragEl);
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
      this._placeList(fromIndex, targetIndex);
    };

    this._onListReorderKey = e => {
      const { list, direction } = e.detail;
      const items = [...this._container.querySelectorAll('lists-page-item')];
      const fromIndex = items.findIndex(el => el._list?.id === list.id);
      if (fromIndex === -1) return;
      const toIndex = direction === -1 ? Math.max(0, fromIndex - 1) : fromIndex + 2;
      this._placeList(fromIndex, toIndex);
    };

    this._container.addEventListener('list-drag-start',  this._onListDragStart);
    this._container.addEventListener('list-reorder-key', this._onListReorderKey);
  }

  unsubscribe() {
    this.shadowRoot.querySelector('#add-row')?.removeEventListener('click', this._onAddRow);
    this._container?.removeEventListener('list-tap', this._onListTap);
    this._container?.removeEventListener('list-edit', this._onListEdit);
    this._container?.removeEventListener('list-delete', this._onSwipeDelete);
    this._container?.removeEventListener('list-color-cycle', this._onListColorCycle);
    this._container?.removeEventListener('list-drag-start',  this._onListDragStart);
    this._container?.removeEventListener('list-reorder-key', this._onListReorderKey);
    this.shadowRoot?.removeEventListener('list-saved', this._onListSaved);
    this._dialog?.removeEventListener('list-delete', this._onListDelete);
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

  // ── Drag helpers ──────────────────────────────────────────────────────────

  _insertIndexAt(container, y, ghostEl) {
    const items = [...container.querySelectorAll('lists-page-item')];
    for (const item of items.filter(el => el !== ghostEl)) {
      const r = item.getBoundingClientRect();
      if (y < r.top + r.height / 2) return items.indexOf(item);
    }
    return items.length;
  }

  _updateInsertLine(container, targetIndex, ghostEl) {
    const items = [...container.querySelectorAll('lists-page-item')];
    if (targetIndex >= items.length) container.appendChild(this._insertLine);
    else container.insertBefore(this._insertLine, items[targetIndex]);
  }

  _createDragClone(rect, name) {
    const clone = document.createElement('div');
    clone.setAttribute('aria-hidden', 'true');
    clone.style.cssText = [
      'position:fixed',
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      'background:var(--color-surface)',
      'border:0.5px solid var(--color-border)',
      'border-radius:var(--radius-md)',
      'box-shadow:var(--shadow-drag)',
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
    clone.textContent = name;
    return clone;
  }

  _placeList(fromIndex, toIndex) {
    // toIndex is the insertion slot after removal; dropping one slot below is a no-op.
    if (fromIndex === toIndex || fromIndex === toIndex - 1) return;
    const lists = [...(getState().lists ?? [])];
    const [list] = lists.splice(fromIndex, 1);
    lists.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, list);
    setState('lists', lists);
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
