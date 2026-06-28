import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, setRuntimeState, subscribe, unsubscribe } from '../../_lib/core/store/store.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import '../components/list-dialog/list-dialog.js';
import '../components/add-row/add-row.js';
import { COLOR_PALETTE } from '../components/lists-page-item/lists-page-item.js';
import { icons } from '../icons.js';

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
          border-block-end: var(--header-strip-height) solid var(--color-border);
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
          margin-inline-start: calc(var(--touch-target) - var(--page-padding) + 6px);
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

        /* ── Filter button ───────────────────────────────────────────────── */

        .filter-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-secondary);
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
          position: relative;
          margin-inline-end: var(--edge-btn-bleed);
        }

        .filter-btn svg {
          inline-size: 22px;
          block-size: 22px;
          pointer-events: none;
        }

        .filter-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .filter-btn-dot {
          position: absolute;
          inset-block-start: 10px;
          inset-inline-end: 10px;
          inline-size: 6px;
          block-size: 6px;
          border-radius: var(--radius-full);
          background: var(--color-accent);
        }

        /* ── Filter bar ──────────────────────────────────────────────────── */

        #filter-bar {
          padding-block: var(--space-2);
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          border-block-start: 0.5px solid var(--color-border);
        }

        #filter-bar[hidden] { display: none; }

        .filter-bar-row {
          display: flex;
          align-items: center;
        }

        .filter-search-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-surface-raised);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding-inline: var(--space-3);
        }

        .filter-search-wrap:focus-within {
          border-color: var(--color-accent);
        }

        .filter-search-icon {
          flex-shrink: 0;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
        }

        .filter-search-icon svg {
          inline-size: 16px;
          block-size: 16px;
          pointer-events: none;
        }

        #filter-search {
          flex: 1;
          min-block-size: 34px;
          background: none;
          border: none;
          outline: none;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          color: var(--color-text-primary);
        }

        #filter-search::-webkit-search-cancel-button { display: none; }

        #filter-search::placeholder {
          color: var(--color-text-muted);
        }

        .filter-clear-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          border: none;
          background: none;
          cursor: pointer;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          touch-action: manipulation;
          margin-inline-end: var(--edge-btn-bleed);
        }

        .filter-clear-btn svg {
          inline-size: 20px;
          block-size: 20px;
          pointer-events: none;
        }

        .filter-clear-btn.active {
          color: var(--color-danger);
        }

        .filter-clear-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .filter-chip-row {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .filter-chip-row[hidden] { display: none; }

        .filter-chip {
          min-block-size: var(--touch-target-small);
          padding-inline: var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          touch-action: manipulation;
        }

        .filter-chip.active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: var(--color-text-on-accent);
        }

        .filter-chip:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        #filter-empty {
          text-align: center;
          padding-block: var(--space-8);
          color: var(--color-text-muted);
          font-size: var(--font-size-body);
        }

      </style>

      <div class="page-header">
        <div class="top-row">
          <h1>${t('lists-page.heading')}</h1>
          <button class="filter-btn" id="filter-btn" aria-label="${t('lists-page.filter-toggle')}" aria-expanded="false">${icons.funnel}<span class="filter-btn-dot" hidden aria-hidden="true"></span></button>
        </div>
        <div id="filter-bar" hidden>
          <div class="filter-bar-row">
            <div class="filter-search-wrap">
              <span class="filter-search-icon" aria-hidden="true">${icons.magnifyingGlass}</span>
              <input type="search" id="filter-search" placeholder="${t('lists-page.filter-search')}" aria-label="${t('lists-page.filter-search')}" autocomplete="off" />
            </div>
            <button class="filter-clear-btn" id="filter-clear-btn" aria-label="${t('lists-page.filter-clear')}">${icons.funnelX}</button>
          </div>
          <div class="filter-chip-row" id="chip-row" hidden>
            <button class="filter-chip" id="empty-only-btn" aria-pressed="false">${t('lists-page.filter-empty-only')}</button>
          </div>
        </div>
      </div>
      <main>
        <div id="list-container" role="list"></div>
        <p id="filter-empty" hidden>${t('lists-page.filter-empty')}</p>
        <add-row id="add-row">+ ${t('lists-page.add')}</add-row>
      </main>
      <list-dialog id="dialog"></list-dialog>
    `;
  }

  subscribe() {
    this._container = this.shadowRoot.querySelector('#list-container');
    this._dialog    = this.shadowRoot.querySelector('#dialog');

    this._onAddRow = () => this._dialog.open(null);
    this.shadowRoot.querySelector('#add-row').addEventListener('click', this._onAddRow);

    this._onListTap = e => {
      navigate(`${BASE_PATH}lists/${e.detail.list.id}`);
    };
    this._container.addEventListener('list-tap', this._onListTap);

    this._onListSaved = e => {
      const { name, color } = e.detail;
      this._create(name, color);
      toast(t('lists.toast-list-saved'), 'success');
    };
    this.shadowRoot.addEventListener('list-saved', this._onListSaved);

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

    // ── Filter bar ────────────────────────────────────────────────────────────

    this._filterBar    = this.shadowRoot.querySelector('#filter-bar');
    this._filterBtnDot = this.shadowRoot.querySelector('.filter-btn-dot');
    this._filterSearch = this.shadowRoot.querySelector('#filter-search');
    this._filterEmpty  = this.shadowRoot.querySelector('#filter-empty');

    this._filter = { query: '', emptyOnly: false };
    this._barExpanded = false;
    this._emptyOnlyBtn = this.shadowRoot.querySelector('#empty-only-btn');
    this._chipRow      = this.shadowRoot.querySelector('#chip-row');
    this._loadFilter();

    const filterBtn = this.shadowRoot.querySelector('#filter-btn');
    this._onFilterBtn = () => {
      const nowOpen = this._filterBar.hidden;
      this._filterBar.hidden = !nowOpen;
      filterBtn.setAttribute('aria-expanded', String(nowOpen));
      this._barExpanded = nowOpen;
      this._saveFilter();
      if (nowOpen) requestAnimationFrame(() => this._filterSearch?.focus());
    };
    filterBtn.addEventListener('click', this._onFilterBtn);

    this._onFilterSearch = () => {
      this._filter.query = this._filterSearch.value;
      this._saveFilter();
      this._applyFilter();
      this._syncFilterUI();
    };
    this._filterSearch.addEventListener('input', this._onFilterSearch);

    this._onEmptyOnly = () => {
      this._filter.emptyOnly = !this._filter.emptyOnly;
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this._emptyOnlyBtn.addEventListener('click', this._onEmptyOnly);

    this._onFilterClear = () => {
      this._filter = { query: '', emptyOnly: false };
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this.shadowRoot.querySelector('#filter-clear-btn').addEventListener('click', this._onFilterClear);

    if (this._barExpanded) {
      this._filterBar.hidden = false;
      filterBtn.setAttribute('aria-expanded', 'true');
    }

    // ── Store ─────────────────────────────────────────────────────────────────

    this._onLists = lists => {
      this._renderLists(lists ?? []);
      this._syncFilterUI();
      this._applyFilter();
    };
    subscribe('lists', this._onLists);

    this._onPendingListUndo = value => {
      if (!value) return;
      const { snapshot, listName } = value;
      setRuntimeState('pendingListUndo', null);
      toast(t('lists.toast-list-deleted'), 'info', { action: { label: t('undo.button'), onClick: () => setState('lists', snapshot) } });
    };
    subscribe('pendingListUndo', this._onPendingListUndo);
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
    this._container?.removeEventListener('list-color-cycle', this._onListColorCycle);
    this._container?.removeEventListener('list-drag-start',  this._onListDragStart);
    this._container?.removeEventListener('list-reorder-key', this._onListReorderKey);
    this.shadowRoot?.removeEventListener('list-saved', this._onListSaved);
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
    unsubscribe('pendingListUndo', this._onPendingListUndo);
    this.shadowRoot?.querySelector('#filter-btn')?.removeEventListener('click', this._onFilterBtn);
    this._filterSearch?.removeEventListener('input', this._onFilterSearch);
    this.shadowRoot?.querySelector('#filter-clear-btn')?.removeEventListener('click', this._onFilterClear);
    this._emptyOnlyBtn?.removeEventListener('click', this._onEmptyOnly);
  }

  // ── Store mutations ───────────────────────────────────────────────────────

  _create(name, color) {
    const list = { id: crypto.randomUUID(), name, items: [] };
    if (color) list.color = color;
    setState('lists', [...(getState().lists ?? []), list]);
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

  // ── Filter helpers ────────────────────────────────────────────────────────

  _loadFilter() {
    try {
      const raw = localStorage.getItem('telos:filter:lists');
      if (raw) {
        const { query = '', emptyOnly = false, barExpanded = false } = JSON.parse(raw);
        this._filter = { query, emptyOnly };
        this._barExpanded = barExpanded;
      }
    } catch { /* ignore */ }
  }

  _saveFilter() {
    if (this._filter.query || this._filter.emptyOnly || this._barExpanded) {
      localStorage.setItem('telos:filter:lists', JSON.stringify({
        query: this._filter.query, emptyOnly: this._filter.emptyOnly, barExpanded: this._barExpanded,
      }));
    } else {
      localStorage.removeItem('telos:filter:lists');
    }
  }

  _syncFilterUI() {
    if (this._filterSearch) this._filterSearch.value = this._filter.query;
    const active = !!(this._filter.query || this._filter.emptyOnly);
    if (this._filterBtnDot) this._filterBtnDot.hidden = !active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);
    const hasEmptyLists = [...(this._container?.querySelectorAll('lists-page-item') ?? [])]
      .some(el => (el._list?.items ?? []).length === 0);
    if (this._chipRow)      this._chipRow.hidden = !hasEmptyLists;
    if (this._emptyOnlyBtn) {
      this._emptyOnlyBtn.classList.toggle('active', this._filter.emptyOnly);
      this._emptyOnlyBtn.setAttribute('aria-pressed', String(this._filter.emptyOnly));
    }
  }

  _applyFilter() {
    const q         = this._filter.query.toLowerCase().trim();
    const emptyOnly = this._filter.emptyOnly;
    const active    = !!(q || emptyOnly);
    let anyVisible  = false;

    this._container?.querySelectorAll('lists-page-item').forEach(el => {
      const list = el._list;
      if (!list) { el.hidden = false; return; }
      let show = true;
      if (q) {
        const nameMatch = list.name.toLowerCase().includes(q);
        const itemMatch = (list.items ?? []).some(item =>
          (item.title  ?? '').toLowerCase().includes(q) ||
          (item.note   ?? '').toLowerCase().includes(q) ||
          (item.status ?? '').includes(q) ||
          (item.tags   ?? []).some(tag => tag.toLowerCase().includes(q))
        );
        show = nameMatch || itemMatch;
      }
      if (show && emptyOnly) show = (list.items ?? []).length === 0;
      el.hidden = !show;
      if (show) anyVisible = true;
    });

    if (this._filterEmpty) this._filterEmpty.hidden = !active || anyVisible;
    if (this._filterBtnDot) this._filterBtnDot.hidden = !active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);
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
