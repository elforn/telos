import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, subscribe, unsubscribe } from '../../_lib/core/store/store.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import '../components/list-item/list-item.js';
import '../components/item-dialog/item-dialog.js';
import '../components/add-row/add-row.js';
import '../components/list-picker-dialog/list-picker-dialog.js';

const lsKey = id => `lists.showStatus.${id}`;
const DRAG_CLONE_SHADOW = '0 8px 24px rgba(0,0,0,0.18)';

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

        /* ── Bulk action bar ─────────────────────────────────────────────── */

        #bulk-bar {
          position: fixed;
          inset-inline: 0;
          inset-block-end: 0;
          z-index: 300;
          background: var(--color-surface);
          border-block-start: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding-inline: var(--page-padding);
          padding-block: var(--space-2);
          padding-block-end: calc(var(--space-2) + var(--safe-area-bottom, 0px));
        }

        @keyframes bulk-bar-in {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        @media (prefers-reduced-motion: no-preference) {
          #bulk-bar:not([hidden]) { animation: bulk-bar-in 0.22s cubic-bezier(0.32, 0.72, 0, 1); }
        }

        #bulk-close-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
        }

        #bulk-close-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
          border-radius: var(--radius-full);
        }

        #bulk-count {
          flex: 1;
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          min-inline-size: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bulk-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          padding-inline: var(--space-4);
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          touch-action: manipulation;
        }

        #bulk-delete-btn {
          background: none;
          color: var(--color-danger);
          border: 1px solid var(--color-danger);
        }

        #bulk-move-btn {
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
        }

        #bulk-copy-btn {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        .bulk-btn:focus-visible {
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

      <div id="bulk-bar" hidden role="toolbar" aria-label="${t('list-detail.cancel-selection')}">
        <button type="button" id="bulk-close-btn" aria-label="${t('list-detail.cancel-selection')}">✕</button>
        <span id="bulk-count"></span>
        <button type="button" class="bulk-btn" id="bulk-delete-btn">${t('list-detail.bulk-delete')}</button>
        <button type="button" class="bulk-btn" id="bulk-move-btn">${t('list-detail.bulk-move')}</button>
        <button type="button" class="bulk-btn" id="bulk-copy-btn">${t('list-detail.bulk-copy')}</button>
      </div>

      <list-picker-dialog id="bulk-picker"></list-picker-dialog>
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
    this._selectionMode = false;
    this._selectedIds   = new Set();

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
      this._prepareDialog(null);
      this._dialog.open(null);
    };
    this.shadowRoot.querySelector('#add-row').addEventListener('click', this._onAddRow);

    this._onItemTap = e => {
      if (this._selectionMode) return;
      const cleanItem = this._prepareDialog(e.detail.item);
      this._editingItem = cleanItem;
      this._dialog.open(cleanItem);
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

    this._onItemMove = e => {
      if (!this._editingItem) return;
      const { title, status, note, url, targetListIds, newListName, copy } = e.detail;
      const item         = this._editingItem;
      const updatedItem  = { ...item, title, status, note, url };
      const currentLists = getState().lists ?? [];
      const targetNames  = currentLists
        .filter(l => targetListIds.includes(l.id))
        .map(l => l.name);
      if (newListName) targetNames.unshift(newListName);

      const updatedLists = currentLists.map(l => {
        if (l.id === this._listId) {
          const items = (l.items ?? []).map(i => i.id === item.id ? updatedItem : i);
          return { ...l, items: copy ? items : items.filter(i => i.id !== item.id) };
        }
        if (targetListIds.includes(l.id)) {
          return { ...l, items: [...(l.items ?? []), { ...updatedItem, id: crypto.randomUUID() }] };
        }
        return l;
      });
      if (newListName) {
        updatedLists.push({ id: crypto.randomUUID(), name: newListName, items: [{ ...updatedItem, id: crypto.randomUUID() }] });
      }
      setState('lists', updatedLists);

      const n = targetListIds.length + (newListName ? 1 : 0);
      const msg = copy
        ? (n === 1 ? t('item-dialog.copy-toast', { name: targetNames[0] }) : t('item-dialog.copy-toast-many', { n }))
        : (n === 1 ? t('item-dialog.move-toast', { name: targetNames[0] }) : t('item-dialog.move-toast-many', { n }));
      toast(msg, 'success');
    };
    this._dialog.addEventListener('item-move', this._onItemMove);

    this._onItemPromote = e => {
      if (!this._editingItem) return;
      const { title, status, note, url, year, section } = e.detail;
      const item    = this._editingItem;
      const goalId  = crypto.randomUUID();
      const goal    = { id: goalId, title, description: '', tags: [], tracking: { type: 'percentage', value: 0 } };
      const state   = getState();
      const yearStr = String(year);
      const existing = state.goals?.[yearStr] ?? { capstone: [], milestones: [], wow: [], focus: [] };

      setState('goals', {
        ...state.goals,
        [yearStr]: { ...existing, [section]: [...(existing[section] ?? []), goal] },
      });

      const updatedItem = {
        ...item, title, status, note, url,
        inGoals: [...(item.inGoals ?? []), { year: yearStr, section, goalId }],
      };
      setState('lists', (getState().lists ?? []).map(l =>
        l.id === this._listId
          ? { ...l, items: (l.items ?? []).map(i => i.id === item.id ? updatedItem : i) }
          : l
      ));

      const sectionLabel = t(`item-dialog.goal-section-${section}`);
      toast(t('item-dialog.promote-toast', { year: yearStr, section: sectionLabel }), 'success');
    };
    this._dialog.addEventListener('item-promote', this._onItemPromote);

    // ── Drag-to-reorder ───────────────────────────────────────────────────────

    this._onItemDragStart = e => {
      if (this._selectionMode) return;
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

    this._onBulkClose = () => this._exitSelectionMode();
    this.shadowRoot.querySelector('#bulk-close-btn').addEventListener('click', this._onBulkClose);

    this._bulkCountEl    = this.shadowRoot.querySelector('#bulk-count');
    this._bulkPickerDialog = this.shadowRoot.querySelector('#bulk-picker');

    this._onBulkDelete = () => {
      const ids = [...this._selectedIds];
      this._mutateItems(items => items.filter(i => !ids.includes(i.id)));
      toast(t('list-detail.bulk-delete-toast', { n: ids.length }), 'info');
      this._exitSelectionMode();
    };
    this.shadowRoot.querySelector('#bulk-delete-btn').addEventListener('click', this._onBulkDelete);

    const openBulkPicker = mode => {
      this._bulkPickerDialog.lists = (getState().lists ?? []).filter(l => l.id !== this._listId);
      this._bulkPickerDialog.mode  = mode;
      this._bulkPickerDialog.show();
    };
    this._onBulkMove = () => openBulkPicker('move');
    this._onBulkCopy = () => openBulkPicker('copy');
    this.shadowRoot.querySelector('#bulk-move-btn').addEventListener('click', this._onBulkMove);
    this.shadowRoot.querySelector('#bulk-copy-btn').addEventListener('click', this._onBulkCopy);

    this._onBulkListPick = e => {
      const { targetListIds, newListName, copy } = e.detail;
      const ids          = [...this._selectedIds];
      const currentLists = getState().lists ?? [];
      const sourceItems  = (currentLists.find(l => l.id === this._listId)?.items ?? [])
        .filter(i => ids.includes(i.id));
      const targetNames  = currentLists
        .filter(l => targetListIds.includes(l.id))
        .map(l => l.name);
      if (newListName) targetNames.unshift(newListName);

      const updatedLists = currentLists.map(l => {
        if (l.id === this._listId) {
          return { ...l, items: copy
            ? (l.items ?? [])
            : (l.items ?? []).filter(i => !ids.includes(i.id)) };
        }
        if (targetListIds.includes(l.id)) {
          const clones = sourceItems.map(i => ({ ...i, id: crypto.randomUUID() }));
          return { ...l, items: [...(l.items ?? []), ...clones] };
        }
        return l;
      });
      if (newListName) {
        const clones = sourceItems.map(i => ({ ...i, id: crypto.randomUUID() }));
        updatedLists.push({ id: crypto.randomUUID(), name: newListName, items: clones });
      }
      setState('lists', updatedLists);

      const n   = targetListIds.length + (newListName ? 1 : 0);
      const msg = copy
        ? (n === 1 ? t('item-dialog.copy-toast', { name: targetNames[0] }) : t('item-dialog.copy-toast-many', { n }))
        : (n === 1 ? t('item-dialog.move-toast', { name: targetNames[0] }) : t('item-dialog.move-toast-many', { n }));
      toast(msg, 'success');
      this._exitSelectionMode();
    };
    this._bulkPickerDialog.addEventListener('list-pick', this._onBulkListPick);

    this._onItemLongPress = e => {
      if (!this._selectionMode) this._enterSelectionMode(e.detail.item.id);
    };
    this._itemList.addEventListener('item-long-press', this._onItemLongPress);

    this._onItemSelectToggle = e => {
      const id = e.detail.item.id;
      if (this._selectedIds.has(id)) this._selectedIds.delete(id);
      else this._selectedIds.add(id);
      if (this._selectedIds.size === 0) { this._exitSelectionMode(); return; }
      this._syncSelectionUI();
    };
    this._itemList.addEventListener('item-select-toggle', this._onItemSelectToggle);

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
    this.shadowRoot?.querySelector('#bulk-close-btn')?.removeEventListener('click', this._onBulkClose);
    this.shadowRoot?.querySelector('#bulk-delete-btn')?.removeEventListener('click', this._onBulkDelete);
    this.shadowRoot?.querySelector('#bulk-move-btn')?.removeEventListener('click', this._onBulkMove);
    this.shadowRoot?.querySelector('#bulk-copy-btn')?.removeEventListener('click', this._onBulkCopy);
    this._bulkPickerDialog?.removeEventListener('list-pick', this._onBulkListPick);
    this._itemList?.removeEventListener('item-long-press',     this._onItemLongPress);
    this._itemList?.removeEventListener('item-select-toggle',  this._onItemSelectToggle);
    this._itemList?.removeEventListener('item-drag-start',  this._onItemDragStart);
    this._itemList?.removeEventListener('item-reorder-key', this._onItemReorderKey);
    this.shadowRoot?.removeEventListener('item-saved', this._onItemSaved);
    this._dialog?.removeEventListener('item-delete', this._onDialogDelete);
    this._dialog?.removeEventListener('item-move',   this._onItemMove);
    this._dialog?.removeEventListener('item-promote', this._onItemPromote);
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

  // ── Selection mode ────────────────────────────────────────────────────────

  _enterSelectionMode(firstItemId) {
    this._selectionMode = true;
    this._selectedIds   = new Set([firstItemId]);
    // Raise host to a document-level stacking context above bottom-nav (z-index: 200)
    this.style.position = 'relative';
    this.style.zIndex   = '201';
    this.shadowRoot.querySelector('#menu-btn').hidden = true;
    this.shadowRoot.querySelector('#bulk-bar').hidden = false;
    this._syncSelectionUI();
  }

  _exitSelectionMode() {
    this._selectionMode = false;
    this._selectedIds.clear();
    this.style.position = '';
    this.style.zIndex   = '';
    this.shadowRoot.querySelector('#menu-btn').hidden = false;
    this.shadowRoot.querySelector('#bulk-bar').hidden = true;
    this._syncSelectionUI();
  }

  _syncSelectionUI() {
    this._itemList?.querySelectorAll('list-item').forEach(el => {
      el.selectionMode = this._selectionMode;
      el.selected      = this._selectionMode && this._selectedIds.has(el._item?.id);
    });
    if (this._bulkCountEl) {
      this._bulkCountEl.textContent = t('list-detail.selection-count', { n: this._selectedIds.size });
    }
  }

  // ── Dialog setup ─────────────────────────────────────────────────────────

  _prepareDialog(item = null) {
    const state = getState();
    this._dialog.availableLists = (state.lists ?? []).filter(l => l.id !== this._listId);
    this._dialog.currentYear    = new Date().getFullYear();

    if (!item || !(item.inGoals ?? []).length) return item;
    // Prune inGoals entries whose goal no longer exists — writes to store if any are found.

    const goals = state.goals ?? {};
    const validInGoals = item.inGoals.filter(({ year, section, goalId }) =>
      (goals[year]?.[section] ?? []).some(g => g.id === goalId)
    );
    if (validInGoals.length === item.inGoals.length) return item;

    const cleanItem = { ...item, inGoals: validInGoals };
    setState('lists', (state.lists ?? []).map(l =>
      l.id === this._listId
        ? { ...l, items: (l.items ?? []).map(i => i.id === item.id ? cleanItem : i) }
        : l
    ));
    return cleanItem;
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
      `box-shadow:${DRAG_CLONE_SHADOW}`,
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
      el.item          = item;
      el.selectionMode = this._selectionMode;
      el.selected      = this._selectionMode && this._selectedIds.has(item.id);
      return el;
    });

    byId.forEach(el => el.remove());
    ordered.forEach(el => this._itemList.appendChild(el));
  }
}

customElements.define('list-detail-page', ListDetailPage);
