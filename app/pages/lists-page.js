import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, setRuntimeState } from '../../_lib/core/store/store.js';
import { syncChildren } from '../../_lib/core/dom/sync-children.js';
import { Reorder } from '../../_lib/modules/reorder/reorder.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import '../components/list-dialog/list-dialog.js';
import '../components/add-row/add-row.js';
import '../../_lib/modules/modal-dialog/modal-dialog.js';
import { COLOR_PALETTE } from '../components/lists-page-item/lists-page-item.js';
import '../components/date-filter-row/date-filter-row.js';
import { icons } from '../icons.js';
import { matchesDateBucket } from '../utils/urgency.js';
import { FilterState } from '../../_lib/modules/filter-state/filter-state.js';

const FILTER_SHAPE = {
  query:          { kind: 'string' },
  states:         { kind: 'set' },
  dates:          { kind: 'set' },
  panelExpanded:  { kind: 'boolean' },
  barExpanded:    { kind: 'boolean' },
};

const listsFilterState = FilterState('telos:filter:lists', FILTER_SHAPE);

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

        .header-actions {
          display: flex;
          align-items: center;
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

        .menu-btn {
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
          margin-inline-end: var(--edge-btn-bleed);
        }

        .menu-btn svg {
          inline-size: 22px;
          block-size: 22px;
          pointer-events: none;
        }

        .menu-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* Menu dialog — Date indicators toggle */
        .menu-section-label {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          margin: 0 0 var(--space-2);
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

        .filter-clear-btn:focus-visible,
        .filter-expand-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .filter-expand-btn {
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
          position: relative;
        }

        .filter-expand-btn svg {
          inline-size: 16px;
          block-size: 16px;
          pointer-events: none;
        }

        .filter-expand-btn[aria-expanded="true"] svg {
          transform: rotate(180deg);
        }

        .filter-expand-dot {
          position: absolute;
          inset-block-start: 6px;
          inset-inline-end: 6px;
          inline-size: 6px;
          block-size: 6px;
          border-radius: var(--radius-full);
          background: var(--color-accent);
          pointer-events: none;
        }

        #filter-panel {
          display: flex;
          flex-direction: column;
          gap: calc(var(--space-1) + 1px);
        }

        #filter-panel[hidden] { display: none; }

        .filter-chip-row {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .filter-chip-row[hidden] { display: none; }

        .filter-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          overflow-x: auto;
          flex-wrap: nowrap;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .filter-row::-webkit-scrollbar { display: none; }

        /* Date-bucket pills live in <date-filter-row> now — it owns its own styling. */

        .filter-chip {
          flex-shrink: 0;
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
          white-space: nowrap;
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

        .sr-only {
          position: absolute;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border-width: 0;
        }

      </style>

      <div class="page-header">
        <div class="top-row">
          <h1>${t('lists-page.heading')}</h1>
          <div class="header-actions">
            <button class="filter-btn" id="filter-btn" aria-label="${t('lists-page.filter-toggle')}" aria-expanded="false">${icons.funnel}<span class="filter-btn-dot" hidden aria-hidden="true"></span></button>
            <button class="menu-btn" id="menu-btn" aria-label="${t('lists-page.menu')}" aria-expanded="false">${icons.dotsVertical}</button>
          </div>
        </div>
        <div id="filter-bar" hidden>
          <div class="filter-bar-row">
            <div class="filter-search-wrap">
              <span class="filter-search-icon" aria-hidden="true">${icons.magnifyingGlass}</span>
              <input type="search" id="filter-search" placeholder="${t('lists-page.filter-search')}" aria-label="${t('lists-page.filter-search')}" autocomplete="off" />
            </div>
            <button class="filter-expand-btn" id="filter-expand-btn" aria-label="${t('lists-page.filter-expand')}" aria-expanded="false" aria-controls="filter-panel">${icons.chevronDown}<span class="filter-expand-dot" hidden aria-hidden="true"></span></button>
            <button class="filter-clear-btn" id="filter-clear-btn" aria-label="${t('lists-page.filter-clear')}">${icons.funnelX}</button>
          </div>
          <div id="filter-panel" hidden>
            <div class="filter-chip-row" id="filter-states-row" role="group" aria-label="${t('lists-page.filter-toggle')}">
              <button class="filter-chip" id="fstate-empty" data-state="empty" aria-pressed="false">${t('lists-page.filter-empty-only')}</button>
              <button class="filter-chip" id="fstate-not-empty" data-state="not-empty" aria-pressed="false">${t('lists-page.filter-not-empty')}</button>
              <button class="filter-chip" id="fstate-archived" data-state="archived" aria-pressed="false">${t('lists-page.filter-archived')}</button>
            </div>
            <date-filter-row id="date-filter-row"></date-filter-row>
          </div>
        </div>
      </div>
      <main>
        <div id="list-container" role="list"></div>
        <p id="filter-empty" hidden>${t('lists-page.filter-empty')}</p>
        <p role="status" class="sr-only" id="filter-live"></p>
        <add-row id="add-row">+ ${t('lists-page.add')}</add-row>
      </main>
      <list-dialog id="dialog"></list-dialog>

      <modal-dialog id="menu" aria-label="${t('lists-page.menu')}">
        <p class="menu-section-label">${t('lists-page.rollup-toggle')}</p>
        <div class="status-pill-group" role="group" aria-label="${t('lists-page.rollup-toggle')}">
          <button class="status-pill" id="rollup-show-btn">${t('settings.reminder-on')}</button>
          <button class="status-pill" id="rollup-hide-btn">${t('settings.reminder-off')}</button>
        </div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._container = this.shadowRoot.querySelector('#list-container');
    this._dialog    = this.shadowRoot.querySelector('#dialog');

    this._onAddRow = () => this._dialog.open(null);
    this.listen(this.shadowRoot.querySelector('#add-row'), 'click', this._onAddRow);

    this._onListTap = e => {
      const q = this._filter?.query?.trim();
      const qs = q ? `?q=${encodeURIComponent(q)}` : '';
      navigate(`${BASE_PATH}lists/${e.detail.list.id}${qs}`);
    };
    this.listen(this._container, 'list-tap', this._onListTap);

    this._onListCreated = e => {
      const { name, color } = e.detail;
      const snapshot = getState().lists ?? [];
      const list = this._create(name, color);
      if (this._listFilterActive() && !this._listMatchesFilter(list)) {
        toast(t('lists.toast-list-hidden'), 'info',
          { action: { label: t('filter.toast-show'), onClick: () => this._revealCreatedList(list.id) } });
      } else {
        toast(t('lists.toast-list-saved'), 'success',
          { action: { label: t('undo.button'), onClick: () => setState('lists', snapshot) } });
      }
    };
    this.listen(this.shadowRoot, 'list-created', this._onListCreated);

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
    this.listen(this._container, 'list-color-cycle', this._onListColorCycle);

    this._initDrag();

    // ── Filter bar ────────────────────────────────────────────────────────────

    this._filterBar    = this.shadowRoot.querySelector('#filter-bar');
    this._filterBtnDot = this.shadowRoot.querySelector('.filter-btn-dot');
    this._filterSearch = this.shadowRoot.querySelector('#filter-search');
    this._filterEmpty  = this.shadowRoot.querySelector('#filter-empty');
    this._filterLive   = this.shadowRoot.querySelector('#filter-live');

    this._filter = { query: '', states: new Set(), dates: new Set() };
    this._barExpanded = false;
    this._panelExpanded = false;
    this._filterExpandBtn = this.shadowRoot.querySelector('#filter-expand-btn');
    this._filterPanel     = this.shadowRoot.querySelector('#filter-panel');
    this._loadFilter();

    const filterBtn = this.shadowRoot.querySelector('#filter-btn');
    this._onFilterBtn = () => {
      const nowOpen = this._filterBar.hidden;
      this._filterBar.hidden = !nowOpen;
      filterBtn.setAttribute('aria-expanded', String(nowOpen));
      this._barExpanded = nowOpen;
      if (!nowOpen) this._panelExpanded = false;
      this._saveFilter();
      this._syncFilterUI();
      if (nowOpen) requestAnimationFrame(() => this._filterSearch?.focus());
    };
    this.listen(filterBtn, 'click', this._onFilterBtn);

    this._onFilterSearch = () => {
      this._filter.query = this._filterSearch.value;
      this._saveFilter();
      this._applyFilter();
      this._syncFilterUI();
    };
    this.listen(this._filterSearch, 'input', this._onFilterSearch);

    this._onFilterExpand = () => {
      this._panelExpanded = !this._panelExpanded;
      this._saveFilter();
      this._syncFilterUI();
    };
    this.listen(this._filterExpandBtn, 'click', this._onFilterExpand);

    this._onFilterState = e => {
      const btn = e.target.closest('.filter-chip');
      if (!btn) return;
      const state = btn.dataset.state;
      if (!state) return;
      if (this._filter.states.has(state)) this._filter.states.delete(state);
      else this._filter.states.add(state);
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this.listen(this.shadowRoot.querySelector('#filter-states-row'), 'click', this._onFilterState);

    this._onFilterDate = e => {
      const key = e.detail.key;
      if (this._filter.dates.has(key)) this._filter.dates.delete(key);
      else this._filter.dates.add(key);
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this._dateFilterRow = this.shadowRoot.querySelector('#date-filter-row');
    this.listen(this._dateFilterRow, 'date-toggle', this._onFilterDate);

    this._onFilterClear = () => {
      this._filter = { query: '', states: new Set(), dates: new Set() };
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this.listen(this.shadowRoot.querySelector('#filter-clear-btn'), 'click', this._onFilterClear);

    if (this._barExpanded) {
      this._filterBar.hidden = false;
      filterBtn.setAttribute('aria-expanded', 'true');
    }

    // ── Menu — date-indicator roll-up toggle ─────────────────────────────────

    this._menuDialog = this.shadowRoot.querySelector('#menu');
    this._setupMenu();
    this._setupRollupToggle();

    // ── Store ─────────────────────────────────────────────────────────────────

    this._onLists = lists => {
      this._renderLists(lists ?? []);
      this._syncFilterUI();
      this._applyFilter();
    };
    this.watch('lists', this._onLists);

    this._onPendingListUndo = value => {
      if (!value) return;
      const { snapshot, listName } = value;
      setRuntimeState('pendingListUndo', null);
      toast(t('lists.toast-list-deleted', { name: listName }), 'info', { action: { label: t('undo.button'), onClick: () => setState('lists', snapshot) } });
    };
    this.watch('pendingListUndo', this._onPendingListUndo);
  }

  _setupMenu() {
    const menuBtn = this.shadowRoot.querySelector('#menu-btn');
    this._onMenuBtn = () => {
      this._menuDialog.show();
      menuBtn.setAttribute('aria-expanded', 'true');
    };
    this.listen(menuBtn, 'click', this._onMenuBtn);

    this._onMenuClose = () => menuBtn.setAttribute('aria-expanded', 'false');
    this.listen(this._menuDialog, 'modal-close', this._onMenuClose);
  }

  // Global (not per-list) show/hide for the roll-up urgency dot on list cards
  // and the bottom-nav Lists tab badge — per-item due-date markers inside a
  // list are unaffected and always show.
  _setupRollupToggle() {
    this._rollupShowBtn = this.shadowRoot.querySelector('#rollup-show-btn');
    this._rollupHideBtn = this.shadowRoot.querySelector('#rollup-hide-btn');

    this._onRollupShowBtn = () => {
      setState('listsRollupVisible', true);
      this._menuDialog.close();
    };
    this.listen(this._rollupShowBtn, 'click', this._onRollupShowBtn);

    this._onRollupHideBtn = () => {
      setState('listsRollupVisible', false);
      this._menuDialog.close();
    };
    this.listen(this._rollupHideBtn, 'click', this._onRollupHideBtn);

    this.watch('listsRollupVisible', visible => {
      this._rollupVisible = visible ?? true;
      this._rollupShowBtn?.classList.toggle('active', this._rollupVisible);
      this._rollupHideBtn?.classList.toggle('active', !this._rollupVisible);
      // Re-push the flag to existing cards (syncChildren reuses elements, no full re-render).
      this._renderLists(getState().lists ?? []);
    });
  }

  _initDrag() {
    this._detachReorder = Reorder.attach(this._container, {
      itemSelector:    'lists-page-item',
      dragStartEvent:  'list-drag-start',
      reorderKeyEvent: 'list-reorder-key',
      cloneLabel:      d => d.list.name,
      onMove:          (from, to) => this._placeList(from, to),
    });
  }

  unsubscribe() {
    // Static listeners and store subscriptions are auto-removed by listen()/watch().
    this._detachReorder?.();
  }

  // ── Store mutations ───────────────────────────────────────────────────────

  _create(name, color) {
    const list = { id: crypto.randomUUID(), name, items: [] };
    if (color) list.color = color;
    setState('lists', [...(getState().lists ?? []), list]);
    return list;
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
    const { query, states, dates, panelExpanded, barExpanded } = listsFilterState.load();
    this._filter = { query, states, dates };
    this._barExpanded = barExpanded;
    this._panelExpanded = panelExpanded;
  }

  _saveFilter() {
    listsFilterState.save({ ...this._filter, panelExpanded: this._panelExpanded, barExpanded: this._barExpanded });
  }

  _isFilterActive() {
    return listsFilterState.isActive({ ...this._filter, panelExpanded: this._panelExpanded, barExpanded: this._barExpanded });
  }

  _syncFilterUI() {
    if (this._filterSearch) this._filterSearch.value = this._filter.query;
    const active = this._isFilterActive();
    if (this._filterBtnDot) this._filterBtnDot.hidden = !active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);

    const panelOpen = this._panelExpanded || this._filter.states.size > 0 || this._filter.dates.size > 0;
    if (this._filterPanel) this._filterPanel.hidden = !panelOpen;
    if (this._filterExpandBtn) this._filterExpandBtn.setAttribute('aria-expanded', String(panelOpen));
    const expandDot = this._filterExpandBtn?.querySelector('.filter-expand-dot');
    if (expandDot) expandDot.hidden = !(this._filter.states.size || this._filter.dates.size);

    for (const s of ['empty', 'not-empty', 'archived']) {
      const btn = this.shadowRoot.querySelector(`#fstate-${s}`);
      if (btn) {
        const on = this._filter.states.has(s);
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
      }
    }
    if (this._dateFilterRow) this._dateFilterRow.selected = this._filter.dates;
  }

  _revealCreatedList(id) {
    this._onFilterClear();
    const el = [...(this._container?.querySelectorAll('lists-page-item') ?? [])]
      .find(l => l.dataset.id === id);
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  _listFilterActive() {
    return !!(this._filter.query.toLowerCase().trim() || this._filter.states.size || this._filter.dates.size);
  }

  _listMatchesFilter(list) {
    const q      = this._filter.query.toLowerCase().trim();
    const states = this._filter.states;
    const dates  = this._filter.dates;
    // Archived lists are governed solely by the Archived pill — hidden by
    // default, shown only when it's selected, regardless of Empty/Not empty.
    // Non-archived lists ignore the Archived pill and are OR-filtered by
    // Empty/Not empty when either is selected (mirrors goal.archived +
    // progress-state handling in home-page.js).
    if (list.archived) {
      if (!states.has('archived')) return false;
    } else if (states.size) {
      const emptyStates = [...states].filter(s => s !== 'archived');
      if (emptyStates.length > 0) {
        const lstate = (list.items ?? []).length === 0 ? 'empty' : 'not-empty';
        if (!emptyStates.includes(lstate)) return false;
      } else {
        // Only 'archived' was selected — non-archived lists don't match
        return false;
      }
    }
    if (q) {
      const nameMatch = list.name.toLowerCase().includes(q);
      const itemMatch = (list.items ?? []).some(item =>
        (item.title  ?? '').toLowerCase().includes(q) ||
        (item.note   ?? '').toLowerCase().includes(q) ||
        (item.status ?? '').includes(q) ||
        (item.tags   ?? []).some(tag => tag.toLowerCase().includes(q))
      );
      if (!nameMatch && !itemMatch) return false;
    }
    if (dates.size) {
      const hasMatch = (list.items ?? []).some(item => {
        const active = item.status !== 'done' && item.status !== 'closed';
        return [...dates].some(key => matchesDateBucket(key, item.dueDate, active));
      });
      if (!hasMatch) return false;
    }
    return true;
  }

  _applyFilter() {
    const active     = this._listFilterActive();
    let anyVisible   = false;
    let visibleCount = 0;

    this._container?.querySelectorAll('lists-page-item').forEach(el => {
      const list = el._list;
      if (!list) { el.hidden = false; return; }
      const show = this._listMatchesFilter(list);
      el.hidden = !show;
      if (show) { anyVisible = true; visibleCount++; }
    });

    if (this._filterEmpty) this._filterEmpty.hidden = !active || anyVisible;
    if (this._filterLive) this._filterLive.textContent = active ? t('lists-page.filter-count', { count: visibleCount }) : '';
    if (this._filterBtnDot) this._filterBtnDot.hidden = !active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _renderLists(lists) {
    syncChildren(this._container, lists, 'lists-page-item', (el, list) => {
      el.list = list;
      el.rollupVisible = this._rollupVisible;
    });
  }
}

customElements.define('lists-page', ListsPage);
