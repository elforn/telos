import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, subscribe, unsubscribe } from '../../_lib/core/store/store.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import '../components/year-header/year-header.js';
import '../components/goal-item/goal-item.js';
import '../components/goal-dialog/goal-dialog.js';
import '../components/add-row/add-row.js';
import { exportGoalsMarkdown } from '../utils/export-markdown.js';
import { icons } from '../icons.js';
import { tagColor } from '../utils/tag-color.js';

class HomePage extends AppElement {
  template() {
    return `
      <style>
        :host {
          display: block;
          --page-padding: var(--space-5);
        }

        main {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          padding: 0 var(--page-padding);
          padding-block-start: calc(var(--update-banner-height, 0px) + var(--year-header-height, 81px) + var(--space-3));
          padding-block-end: calc(var(--bottom-nav-height) + var(--space-2));
        }

        .section-heading {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-accent);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-block-end: var(--space-1);
        }

        .list-section {
          display: flex;
          flex-direction: column;
        }

        .item-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        #capstone-section {
          padding-block-start: var(--space-1);
        }

        #capstone-list goal-item {
          --goal-item-height: 60px;
        }

        add-row {
          display: block;
          font-style: italic;
        }

        .add-line {
          display: none;
          align-items: center;
          gap: var(--space-2);
          inline-size: 100%;
          min-block-size: calc(var(--touch-target) / 2);
          border: none;
          background: none;
          cursor: pointer;
          touch-action: manipulation;
          padding: 0;
          padding-block-start: 6px;
          padding-block-end: 0;
          color: var(--color-accent);
          font-size: var(--font-size-caption);
          font-family: var(--font-family);
          font-weight: var(--font-weight-semibold);
        }

        .add-line::before,
        .add-line::after {
          content: '';
          flex: 1;
          block-size: 1.5px;
          background: var(--color-border);
        }

        .fold-btn {
          display: none;
          align-self: flex-end;
          align-items: center;
          min-block-size: var(--touch-target);
          padding-inline: var(--space-2);
          border: none;
          background: none;
          cursor: pointer;
          touch-action: manipulation;
          color: var(--color-text-muted);
          font-size: var(--font-size-caption);
          font-family: var(--font-family);
        }

        .fold-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          border-radius: var(--radius-sm);
          outline-offset: 2px;
        }

        /* non-empty, closed: hairline only */
        .list-section:not(.empty):not(.add-open) add-row  { display: none; }
        .list-section:not(.empty):not(.add-open) .add-line { display: flex; }

        /* non-empty, open: full row + fold */
        .list-section:not(.empty).add-open add-row   { display: block; }
        .list-section:not(.empty).add-open .fold-btn { display: flex; }

        /* ── Filter bar (slotted into year-header) ───────────────────────── */

        #filter-bar {
          border-block-start: 0.5px solid var(--color-border);
          padding-block: var(--space-2);
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          background: var(--color-surface);
        }

        #filter-bar[hidden] { display: none; }

        .filter-top-row {
          display: flex;
          align-items: center;
        }

        .filter-search-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          gap: var(--space-1);
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

        .filter-clear-btn,
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
        }

        .filter-clear-btn svg {
          inline-size: 20px;
          block-size: 20px;
          pointer-events: none;
        }

        .filter-clear-btn {
          margin-inline-end: var(--edge-btn-bleed);
        }

        .filter-clear-btn.active {
          color: var(--color-danger);
        }

        .filter-expand-btn svg {
          inline-size: 16px;
          block-size: 16px;
          pointer-events: none;
        }

        .filter-expand-btn {
          position: relative;
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

        .filter-clear-btn:focus-visible,
        .filter-expand-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        #filter-panel {
          display: flex;
          flex-direction: column;
          gap: calc(var(--space-1) + 1px);
        }

        #filter-panel[hidden] { display: none; }

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

        .filter-pill,
        .filter-tag-chip {
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

        .filter-pill.active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: var(--color-text-on-accent);
        }

        .filter-tag-chip {
          border-color: var(--tag-color, var(--color-border));
        }

        .filter-tag-chip.active {
          background: var(--tag-color, var(--color-accent));
          border-color: var(--tag-color, var(--color-accent));
          color: var(--color-text-primary);
        }

        .filter-pill:focus-visible,
        .filter-tag-chip:focus-visible {
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

      <year-header id="header">
        <div slot="filter-bar" id="filter-bar" hidden>
          <div class="filter-top-row">
            <div class="filter-search-wrap">
              <span class="filter-search-icon" aria-hidden="true">${icons.magnifyingGlass}</span>
              <input type="search" id="filter-search" placeholder="${t('home-page.filter-search')}" aria-label="${t('home-page.filter-search')}" autocomplete="off" />
            </div>
            <button class="filter-expand-btn" id="filter-expand-btn" aria-label="${t('home-page.filter-expand')}" aria-expanded="false">${icons.chevronDown}<span class="filter-expand-dot" hidden aria-hidden="true"></span></button>
            <button class="filter-clear-btn" id="filter-clear-btn" aria-label="${t('home-page.filter-clear')}">${icons.funnelX}</button>
          </div>
          <div id="filter-panel" hidden>
            <div class="filter-row" id="filter-states-row" role="group" aria-label="${t('home-page.filter-toggle')}">
              <button class="filter-pill" id="fstate-done" aria-pressed="false">${t('home-page.filter-done')}</button>
              <button class="filter-pill" id="fstate-ongoing" aria-pressed="false">${t('home-page.filter-ongoing')}</button>
              <button class="filter-pill" id="fstate-not-started" aria-pressed="false">${t('home-page.filter-not-started')}</button>
            </div>
            <div class="filter-row" id="filter-tag-row" hidden></div>
          </div>
        </div>
      </year-header>

      <main>
        <p id="filter-empty" hidden>${t('home-page.filter-empty')}</p>

        <section id="capstone-section" class="list-section empty" aria-label="${t('home-page.capstone-section')}">
          <h2 class="section-heading">${t('home-page.capstone-section')}</h2>
          <div id="capstone-list" class="item-list" role="list"></div>
          <button class="add-line" id="add-line-capstone" aria-label="${t('goal-item.add-capstone')}">+</button>
          <add-row id="add-capstone">+ ${t('goal-item.add-capstone')}</add-row>
          <button class="fold-btn" id="fold-capstone" aria-label="${t('home-page.done')}">${t('home-page.done')}</button>
        </section>

        <section id="milestone-section" class="list-section empty" aria-label="${t('home-page.milestone-section')}">
          <h2 class="section-heading">${t('home-page.milestone-section')}</h2>
          <div id="milestone-list" class="item-list" role="list"></div>
          <button class="add-line" id="add-line-milestone" aria-label="${t('goal-item.add-milestone')}">+</button>
          <add-row id="add-milestone">+ ${t('goal-item.add-milestone')}</add-row>
          <button class="fold-btn" id="fold-milestone" aria-label="${t('home-page.done')}">${t('home-page.done')}</button>
        </section>

        <section id="wow-section" class="list-section empty" aria-label="${t('home-page.wow-section')}">
          <h2 class="section-heading">${t('home-page.wow-section')}</h2>
          <div id="wow-list" class="item-list" role="list"></div>
          <button class="add-line" id="add-line-wow" aria-label="${t('goal-item.add-wow')}">+</button>
          <add-row id="add-wow">+ ${t('goal-item.add-wow')}</add-row>
          <button class="fold-btn" id="fold-wow" aria-label="${t('home-page.done')}">${t('home-page.done')}</button>
        </section>

        <section id="focus-section" class="list-section empty" aria-label="${t('home-page.focus-section')}">
          <h2 class="section-heading">${t('home-page.focus-section')}</h2>
          <div id="focus-list" class="item-list" role="list"></div>
          <button class="add-line" id="add-line-focus" aria-label="${t('goal-item.add-focus')}">+</button>
          <add-row id="add-focus">+ ${t('goal-item.add-focus')}</add-row>
          <button class="fold-btn" id="fold-focus" aria-label="${t('home-page.done')}">${t('home-page.done')}</button>
        </section>
      </main>

      <goal-dialog id="dialog"></goal-dialog>
    `;
  }

  subscribe() {
    this._year = Number(this.params?.year);
    if (!Number.isInteger(this._year) || this._year < 2000 || this._year > 2500) {
      navigate(`${BASE_PATH}not-found`);
      return;
    }
    this._header = this.shadowRoot.querySelector('#header');
    this._dialog = this.shadowRoot.querySelector('#dialog');
    this._editingSection = 'capstone';
    this._editingGoal    = null;
    this._drag           = null;
    this._insertLine     = null;

    this._capstoneSection  = this.shadowRoot.querySelector('#capstone-section');
    this._milestoneSection = this.shadowRoot.querySelector('#milestone-section');
    this._wowSection       = this.shadowRoot.querySelector('#wow-section');
    this._focusSection     = this.shadowRoot.querySelector('#focus-section');
    this._capstoneList  = this.shadowRoot.querySelector('#capstone-list');
    this._milestoneList = this.shadowRoot.querySelector('#milestone-list');
    this._wowList       = this.shadowRoot.querySelector('#wow-list');
    this._focusList     = this.shadowRoot.querySelector('#focus-list');

    // ── Header ───────────────────────────────────────────────────────────────

    this._header.year = this._year;

    this._onYearNavigate = e => navigate(`${BASE_PATH}${e.detail.year}`);
    this._header.addEventListener('year-navigate', this._onYearNavigate);

    // ── Filter bar ────────────────────────────────────────────────────────────

    this._filterBar      = this.shadowRoot.querySelector('#filter-bar');
    this._filterSearch   = this.shadowRoot.querySelector('#filter-search');
    this._filterPanel    = this.shadowRoot.querySelector('#filter-panel');
    this._filterTagRow   = this.shadowRoot.querySelector('#filter-tag-row');
    this._filterEmpty    = this.shadowRoot.querySelector('#filter-empty');
    this._filterExpandBtn = this.shadowRoot.querySelector('#filter-expand-btn');

    this._filter = { query: '', states: new Set(), tags: new Set() };
    this._panelExpanded = false;
    this._barExpanded = false;
    this._loadFilter();

    this._onGoalFilterTagChip = e => {
      const tag = e.currentTarget.dataset.tag;
      if (this._filter.tags.has(tag)) this._filter.tags.delete(tag);
      else this._filter.tags.add(tag);
      this._saveFilter();
      this._syncFilterUI();
      this._applyGoalFilter();
    };

    this._onFilterClick = () => {
      const nowOpen = this._filterBar.hidden;
      this._filterBar.hidden = !nowOpen;
      this._header.filterExpanded = nowOpen;
      this._header.forceCompact = nowOpen;
      this._barExpanded = nowOpen;
      if (!nowOpen) this._panelExpanded = false;
      this._saveFilter();
      if (nowOpen) {
        if (this._filterPanel) this._filterPanel.hidden = true;
        if (this._filterExpandBtn) this._filterExpandBtn.setAttribute('aria-expanded', 'false');
        requestAnimationFrame(() => this._filterSearch?.focus());
      } else {
        if (this._filterPanel) this._filterPanel.hidden = true;
        if (this._filterExpandBtn) this._filterExpandBtn.setAttribute('aria-expanded', 'false');
      }
    };
    this._header.addEventListener('filter-click', this._onFilterClick);

    this._onFilterExpand = () => {
      const panelOpen = this._filterPanel.hidden;
      this._filterPanel.hidden = !panelOpen;
      this._filterExpandBtn.setAttribute('aria-expanded', String(panelOpen));
      this._panelExpanded = panelOpen;
      this._saveFilter();
    };
    this._filterExpandBtn.addEventListener('click', this._onFilterExpand);

    this._onFilterSearch = () => {
      this._filter.query = this._filterSearch.value;
      this._saveFilter();
      this._syncFilterUI();
      this._applyGoalFilter();
    };
    this._filterSearch.addEventListener('input', this._onFilterSearch);

    this._onFilterState = e => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      const id = btn.id;
      const stateMap = { 'fstate-done': 'done', 'fstate-ongoing': 'ongoing', 'fstate-not-started': 'not-started' };
      const state = stateMap[id];
      if (!state) return;
      if (this._filter.states.has(state)) this._filter.states.delete(state);
      else this._filter.states.add(state);
      this._saveFilter();
      this._syncFilterUI();
      this._applyGoalFilter();
    };
    this.shadowRoot.querySelector('#filter-states-row').addEventListener('click', this._onFilterState);

    this._onFilterClear = () => {
      this._filter = { query: '', states: new Set(), tags: new Set() };
      this._filterSearch.value = '';
      this._saveFilter();
      this._syncFilterUI();
      this._applyGoalFilter();
    };
    this.shadowRoot.querySelector('#filter-clear-btn').addEventListener('click', this._onFilterClear);

    if (this._barExpanded) {
      this._filterBar.hidden = false;
      this._header.filterExpanded = true;
      this._header.forceCompact = true;
      if (this._panelExpanded) {
        this._filterPanel.hidden = false;
        this._filterExpandBtn.setAttribute('aria-expanded', 'true');
      }
    }

    // ── Store subscription ────────────────────────────────────────────────────

    this._onAccentColors = colors => this._applyAccent(colors?.[String(this._year)]);
    subscribe('accentColors', this._onAccentColors);

    this._onGoals = goals => {
      const year = String(this._year);
      const yg   = goals?.[year] ?? { capstone: [], milestones: [], wow: [], focus: [] };

      this._renderList(this._capstoneList,  yg.capstone  ?? []);
      this._capstoneSection.classList.toggle('empty',  (yg.capstone  ?? []).length === 0);
      if ((yg.capstone  ?? []).length === 0) this._capstoneSection.classList.remove('add-open');

      this._renderList(this._milestoneList, yg.milestones ?? []);
      this._milestoneSection.classList.toggle('empty', (yg.milestones ?? []).length === 0);
      if ((yg.milestones ?? []).length === 0) this._milestoneSection.classList.remove('add-open');

      this._renderList(this._wowList,       yg.wow       ?? []);
      this._wowSection.classList.toggle('empty',       (yg.wow       ?? []).length === 0);
      if ((yg.wow       ?? []).length === 0) this._wowSection.classList.remove('add-open');

      this._renderList(this._focusList,     yg.focus     ?? []);
      this._focusSection.classList.toggle('empty',     (yg.focus     ?? []).length === 0);
      if ((yg.focus     ?? []).length === 0) this._focusSection.classList.remove('add-open');

      const allGoals = [
        ...(yg.capstone ?? []), ...(yg.milestones ?? []),
        ...(yg.wow ?? []),      ...(yg.focus ?? []),
      ];
      this._rebuildTagChips(allGoals);
      this._syncFilterUI();
      this._applyGoalFilter();
    };
    subscribe('goals', this._onGoals);

    // ── Add-line / fold ───────────────────────────────────────────────────────

    const makeAddLine = (section, sectionEl) => () => {
      sectionEl.classList.add('add-open');
      this._editingSection = section;
      this._editingGoal    = null;
      this._openGoalDialog(null);
    };
    const makeFold = sectionEl => () => sectionEl.classList.remove('add-open');

    this._onAddLineCapstone  = makeAddLine('capstone',   this._capstoneSection);
    this._onAddLineMilestone = makeAddLine('milestones', this._milestoneSection);
    this._onAddLineWow       = makeAddLine('wow',        this._wowSection);
    this._onAddLineFocus     = makeAddLine('focus',      this._focusSection);
    this._onFoldCapstone     = makeFold(this._capstoneSection);
    this._onFoldMilestone    = makeFold(this._milestoneSection);
    this._onFoldWow          = makeFold(this._wowSection);
    this._onFoldFocus        = makeFold(this._focusSection);

    this.shadowRoot.querySelector('#add-line-capstone').addEventListener('click',  this._onAddLineCapstone);
    this.shadowRoot.querySelector('#add-line-milestone').addEventListener('click', this._onAddLineMilestone);
    this.shadowRoot.querySelector('#add-line-wow').addEventListener('click',       this._onAddLineWow);
    this.shadowRoot.querySelector('#add-line-focus').addEventListener('click',     this._onAddLineFocus);
    this.shadowRoot.querySelector('#fold-capstone').addEventListener('click',      this._onFoldCapstone);
    this.shadowRoot.querySelector('#fold-milestone').addEventListener('click',     this._onFoldMilestone);
    this.shadowRoot.querySelector('#fold-wow').addEventListener('click',           this._onFoldWow);
    this.shadowRoot.querySelector('#fold-focus').addEventListener('click',         this._onFoldFocus);

    // ── Drag-to-reorder ───────────────────────────────────────────────────────

    this._onGoalDragStart = e => {
      const { goal, element: dragEl, startX, startY } = e.detail;
      const fromSection = this._sectionOf(dragEl);
      if (!fromSection) return;

      const items     = [...this._listForSection(fromSection).querySelectorAll('goal-item')];
      const fromIndex = items.indexOf(dragEl);
      const rect      = dragEl.getBoundingClientRect();

      dragEl.style.opacity = '0.4';

      const clone = this._createDragClone(rect, goal.title);
      clone.style.left = `${rect.left}px`;
      clone.style.top  = `${rect.top}px`;
      document.body.appendChild(clone);

      if (!this._insertLine) {
        this._insertLine = document.createElement('div');
        this._insertLine.style.cssText = 'height:2px;border-radius:1px;margin-block:calc(var(--space-2)/2);pointer-events:none;background:var(--color-accent)';
      }

      this._drag = {
        goal, fromSection, fromIndex, dragEl, clone,
        offsetX: startX - rect.left, offsetY: startY - rect.top,
        targetSection: fromSection, targetIndex: fromIndex,
        scrollSpeed: 0, scrollRaf: null,
      };

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

      const targetSection = this._sectionAtY(e.clientY) ?? this._drag.targetSection;
      this._drag.targetSection = targetSection;

      const SCROLL_ZONE = 100;
      const MAX_SPEED   = 14;
      const vh = window.innerHeight;
      if (e.clientY < SCROLL_ZONE)
        this._drag.scrollSpeed = -MAX_SPEED * (1 - e.clientY / SCROLL_ZONE);
      else if (e.clientY > vh - SCROLL_ZONE)
        this._drag.scrollSpeed =  MAX_SPEED * (1 - (vh - e.clientY) / SCROLL_ZONE);
      else
        this._drag.scrollSpeed = 0;

      const list = this._listForSection(targetSection);
      const idx  = this._insertIndexAt(list, e.clientY, dragEl);
      this._drag.targetIndex = idx;
      this._updateInsertLine(list, idx, dragEl);
    };

    this._onDragEnd = () => {
      if (!this._drag) return;
      const { fromSection, fromIndex, dragEl, clone, targetSection, targetIndex } = this._drag;

      dragEl.removeEventListener('pointermove',   this._onDragMove);
      dragEl.removeEventListener('pointerup',     this._onDragEnd);
      dragEl.removeEventListener('pointercancel', this._onDragEnd);
      dragEl.style.opacity = '';
      cancelAnimationFrame(this._drag.scrollRaf);
      clone.remove();
      this._insertLine?.remove();
      this._drag = null;

      this._placeGoal(fromSection, fromIndex, targetSection, targetIndex);
    };

    this._onGoalReorderKey = e => {
      const { goal, direction } = e.detail;
      const section = this._sectionOf(e.target);
      if (!section) return;
      const items = [...this._listForSection(section).querySelectorAll('goal-item')];
      const fromIndex = items.findIndex(el => el._goal?.id === goal.id);
      if (fromIndex === -1) return;
      const toIndex = direction === -1 ? Math.max(0, fromIndex - 1) : fromIndex + 2;
      this._placeGoal(section, fromIndex, section, toIndex);
    };

    this.shadowRoot.addEventListener('goal-drag-start',  this._onGoalDragStart);
    this.shadowRoot.addEventListener('goal-reorder-key', this._onGoalReorderKey);

    // ── Capstone events ───────────────────────────────────────────────────────

    this._onCapstoneGoalTap = e => {
      this._editingSection = 'capstone';
      this._editingGoal    = e.detail.goal;
      this._openGoalDialog(e.detail.goal, { year: String(this._year), section: 'capstone' });
    };
    this._capstoneList.addEventListener('goal-tap', this._onCapstoneGoalTap);

    this._onCapstoneProgress = e => {
      this._setProgress('capstone', e.detail.goal.id, e.detail.percentage);
    };
    this._capstoneList.addEventListener('goal-progress', this._onCapstoneProgress);

    this._onCapstoneDelete = e => this._deleteGoalWithUndo('capstone', e.detail.goal.id);
    this._capstoneList.addEventListener('goal-delete', this._onCapstoneDelete);

    this._onAddCapstone = () => {
      this._editingSection = 'capstone';
      this._editingGoal    = null;
      this._openGoalDialog(null);
    };
    this.shadowRoot.querySelector('#add-capstone').addEventListener('click', this._onAddCapstone);

    // ── Milestone events ──────────────────────────────────────────────────────

    this._onMilestoneGoalTap = e => {
      this._editingSection = 'milestones';
      this._editingGoal    = e.detail.goal;
      this._openGoalDialog(e.detail.goal, { year: String(this._year), section: 'milestones' });
    };
    this._milestoneList.addEventListener('goal-tap', this._onMilestoneGoalTap);

    this._onMilestoneProgress = e => {
      this._setProgress('milestones', e.detail.goal.id, e.detail.percentage);
    };
    this._milestoneList.addEventListener('goal-progress', this._onMilestoneProgress);

    this._onMilestoneDelete = e => this._deleteGoalWithUndo('milestones', e.detail.goal.id);
    this._milestoneList.addEventListener('goal-delete', this._onMilestoneDelete);

    this._onAddMilestone = () => {
      this._editingSection = 'milestones';
      this._editingGoal    = null;
      this._openGoalDialog(null);
    };
    this.shadowRoot.querySelector('#add-milestone').addEventListener('click', this._onAddMilestone);

    // ── Wow events ────────────────────────────────────────────────────────────

    this._onWowGoalTap = e => {
      this._editingSection = 'wow';
      this._editingGoal    = e.detail.goal;
      this._openGoalDialog(e.detail.goal, { year: String(this._year), section: 'wow' });
    };
    this._wowList.addEventListener('goal-tap', this._onWowGoalTap);

    this._onWowProgress = e => {
      this._setProgress('wow', e.detail.goal.id, e.detail.percentage);
    };
    this._wowList.addEventListener('goal-progress', this._onWowProgress);

    this._onWowDelete = e => this._deleteGoalWithUndo('wow', e.detail.goal.id);
    this._wowList.addEventListener('goal-delete', this._onWowDelete);

    this._onAddWow = () => {
      this._editingSection = 'wow';
      this._editingGoal    = null;
      this._openGoalDialog(null);
    };
    this.shadowRoot.querySelector('#add-wow').addEventListener('click', this._onAddWow);

    // ── Forward Focus events ──────────────────────────────────────────────────

    this._onFocusGoalTap = e => {
      this._editingSection = 'focus';
      this._editingGoal    = e.detail.goal;
      this._openGoalDialog(e.detail.goal, { year: String(this._year), section: 'focus' });
    };
    this._focusList.addEventListener('goal-tap', this._onFocusGoalTap);

    this._onFocusProgress = e => {
      this._setProgress('focus', e.detail.goal.id, e.detail.percentage);
    };
    this._focusList.addEventListener('goal-progress', this._onFocusProgress);

    this._onFocusDelete = e => this._deleteGoalWithUndo('focus', e.detail.goal.id);
    this._focusList.addEventListener('goal-delete', this._onFocusDelete);

    this._onAddFocus = () => {
      this._editingSection = 'focus';
      this._editingGoal    = null;
      this._openGoalDialog(null);
    };
    this.shadowRoot.querySelector('#add-focus').addEventListener('click', this._onAddFocus);

    // ── Year export ───────────────────────────────────────────────────────────

    this._onYearExportConfirm = e => {
      const { metadata, notes } = e.detail;
      const md = exportGoalsMarkdown(this._yearGoals(), this._year, { metadata, notes });
      navigator.clipboard.writeText(md).catch(() => {});
      toast(t('export.copied'), 'success');
    };
    this.shadowRoot.addEventListener('year-export-confirm', this._onYearExportConfirm);

    // ── Dialog save ───────────────────────────────────────────────────────────

    this._onGoalTagsChanged = e => {
      if (!this._editingGoal) return;
      this._mutateSection(this._editingSection, list =>
        list.map(g => g.id === this._editingGoal.id ? { ...g, tags: e.detail.tags } : g)
      );
    };
    this.shadowRoot.addEventListener('goal-tags-changed', this._onGoalTagsChanged);

    this._onGoalSaved = e => {
      const { title, notes, tags } = e.detail;
      if (this._editingGoal) {
        const snapshot = getState().goals;
        this._editGoal(this._editingSection, this._editingGoal.id, title, notes, tags);
        toast(t('home.toast-goal-saved'), 'success', { action: { label: t('undo.button'), onClick: () => setState('goals', snapshot) } });
      } else {
        this._addGoal(this._editingSection, title, notes, tags);
        toast(t('home.toast-goal-saved'), 'success');
      }
    };
    this.shadowRoot.addEventListener('goal-saved', this._onGoalSaved);

    this._onDialogDelete = () => {
      if (this._editingGoal) {
        const snapshot = getState().goals;
        this._deleteGoal(this._editingSection, this._editingGoal.id);
        toast(t('home.toast-goal-deleted'), 'info', { action: { label: t('undo.button'), onClick: () => setState('goals', snapshot) } });
      }
    };
    this._dialog.addEventListener('goal-delete', this._onDialogDelete);

    // ── Goal move / copy to year+section ──────────────────────────────────────

    this._onGoalMove = e => {
      const { goal, fromYear, fromSection, toYear, toSection, copy } = e.detail;
      const goals  = getState().goals ?? {};
      const fromYg = goals[fromYear] ?? {};
      const toYg   = goals[toYear]   ?? {};
      const source  = fromYg[fromSection] ?? [];
      const newGoal = copy ? { ...goal, id: crypto.randomUUID() } : goal;
      const newFrom = copy ? source : source.filter(g => g.id !== goal.id);
      const newTo   = [...(toYg[toSection] ?? []), newGoal];
      const sameYear = fromYear === toYear;
      const updated = { ...goals };
      if (sameYear) {
        updated[fromYear] = { ...fromYg, [fromSection]: newFrom, [toSection]: newTo };
      } else {
        updated[fromYear] = { ...fromYg, [fromSection]: newFrom };
        updated[toYear]   = { ...toYg,   [toSection]:  newTo  };
      }
      setState('goals', updated);
      const label = t(`goal-dialog.move-section-${toSection}`);
      toast(t(copy ? 'home.toast-goal-copied' : 'home.toast-goal-moved', { section: label }), 'success');
    };
    this._dialog.addEventListener('goal-move', this._onGoalMove);

    // ── Goal create list item ─────────────────────────────────────────────────

    this._onGoalCreateItem = e => {
      const { goal, targetListIds, newListName, copy, fromYear, fromSection } = e.detail;
      const baseItem = {
        title: goal.title,
        note: goal.notes || undefined,
        status: 'open',
        tags: [],
        inGoals: [],
      };

      let lists = getState().lists ?? [];
      let extraId = null;
      if (newListName) {
        extraId = crypto.randomUUID();
        lists = [...lists, { id: extraId, name: newListName, items: [] }];
      }
      const allTargetIds = extraId ? [...targetListIds, extraId] : targetListIds;

      const targetNames = allTargetIds.map(id => lists.find(l => l.id === id)?.name ?? '').filter(Boolean);

      lists = lists.map(l =>
        allTargetIds.includes(l.id)
          ? { ...l, items: [...l.items, { ...baseItem, id: crypto.randomUUID() }] }
          : l
      );
      setState('lists', lists);

      if (!copy) {
        const goals = getState().goals ?? {};
        const yg = goals[fromYear] ?? {};
        setState('goals', {
          ...goals,
          [fromYear]: { ...yg, [fromSection]: (yg[fromSection] ?? []).filter(g => g.id !== goal.id) },
        });
      }

      const n = targetNames.length;
      toast(
        n === 1
          ? t('home.toast-item-created', { name: targetNames[0] })
          : t('home.toast-item-created-many', { n }),
        'success'
      );
    };
    this._dialog.addEventListener('goal-create-item', this._onGoalCreateItem);
  }

  unsubscribe() {
    unsubscribe('goals', this._onGoals);
    unsubscribe('accentColors', this._onAccentColors);

    this._header?.removeEventListener('year-navigate', this._onYearNavigate);

    this._capstoneList?.removeEventListener('goal-tap',      this._onCapstoneGoalTap);
    this._capstoneList?.removeEventListener('goal-progress', this._onCapstoneProgress);
    this._capstoneList?.removeEventListener('goal-delete',   this._onCapstoneDelete);
    this.shadowRoot.querySelector('#add-capstone')?.removeEventListener('click', this._onAddCapstone);

    this._milestoneList?.removeEventListener('goal-tap',      this._onMilestoneGoalTap);
    this._milestoneList?.removeEventListener('goal-progress', this._onMilestoneProgress);
    this._milestoneList?.removeEventListener('goal-delete',   this._onMilestoneDelete);
    this.shadowRoot.querySelector('#add-milestone')?.removeEventListener('click', this._onAddMilestone);

    this._wowList?.removeEventListener('goal-tap',      this._onWowGoalTap);
    this._wowList?.removeEventListener('goal-progress', this._onWowProgress);
    this._wowList?.removeEventListener('goal-delete',   this._onWowDelete);
    this.shadowRoot.querySelector('#add-wow')?.removeEventListener('click', this._onAddWow);

    this._focusList?.removeEventListener('goal-tap',      this._onFocusGoalTap);
    this._focusList?.removeEventListener('goal-progress', this._onFocusProgress);
    this._focusList?.removeEventListener('goal-delete',   this._onFocusDelete);
    this.shadowRoot.querySelector('#add-focus')?.removeEventListener('click', this._onAddFocus);

    this.shadowRoot.querySelector('#add-line-capstone')?.removeEventListener('click',  this._onAddLineCapstone);
    this.shadowRoot.querySelector('#add-line-milestone')?.removeEventListener('click', this._onAddLineMilestone);
    this.shadowRoot.querySelector('#add-line-wow')?.removeEventListener('click',       this._onAddLineWow);
    this.shadowRoot.querySelector('#add-line-focus')?.removeEventListener('click',     this._onAddLineFocus);
    this.shadowRoot.querySelector('#fold-capstone')?.removeEventListener('click',      this._onFoldCapstone);
    this.shadowRoot.querySelector('#fold-milestone')?.removeEventListener('click',     this._onFoldMilestone);
    this.shadowRoot.querySelector('#fold-wow')?.removeEventListener('click',           this._onFoldWow);
    this.shadowRoot.querySelector('#fold-focus')?.removeEventListener('click',         this._onFoldFocus);

    this.shadowRoot.removeEventListener('year-export-confirm', this._onYearExportConfirm);
    this.shadowRoot.removeEventListener('goal-tags-changed', this._onGoalTagsChanged);
    this.shadowRoot.removeEventListener('goal-saved',       this._onGoalSaved);
    this.shadowRoot.removeEventListener('goal-drag-start',  this._onGoalDragStart);
    this.shadowRoot.removeEventListener('goal-reorder-key', this._onGoalReorderKey);
    this._dialog?.removeEventListener('goal-delete',       this._onDialogDelete);
    this._dialog?.removeEventListener('goal-move',         this._onGoalMove);
    this._dialog?.removeEventListener('goal-create-item',  this._onGoalCreateItem);
    this._header?.removeEventListener('filter-click', this._onFilterClick);
    this._filterExpandBtn?.removeEventListener('click', this._onFilterExpand);
    this._filterSearch?.removeEventListener('input', this._onFilterSearch);
    this.shadowRoot?.querySelector('#filter-states-row')?.removeEventListener('click', this._onFilterState);
    this.shadowRoot?.querySelector('#filter-clear-btn')?.removeEventListener('click', this._onFilterClear);

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
  }

  // ── Accent colour ─────────────────────────────────────────────────────────

  _applyAccent(hex) {
    const s = this.style;
    if (!hex) {
      s.setProperty('--color-accent',        '#5BADE0');
      s.setProperty('--color-accent-light',  '#E2F3FB');
      s.setProperty('--color-accent-dark',   '#3A93CC');
      s.setProperty('--color-accent-subtle', 'rgba(91, 173, 224, 0.12)');
      return;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const w = (c, t) => Math.round(c * t + 255 * (1 - t));
    s.setProperty('--color-accent',        hex);
    s.setProperty('--color-accent-light',  `rgb(${w(r, .22)},${w(g, .22)},${w(b, .22)})`);
    s.setProperty('--color-accent-dark',   `rgb(${Math.round(r * .72)},${Math.round(g * .72)},${Math.round(b * .72)})`);
    s.setProperty('--color-accent-subtle', `rgba(${r},${g},${b},0.12)`);
  }

  // ── Store mutations ───────────────────────────────────────────────────────

  _yearGoals() {
    return getState().goals?.[String(this._year)] ?? { capstone: [], milestones: [], wow: [], focus: [] };
  }

  _mutateSection(section, fn) {
    const year = String(this._year);
    const yg   = this._yearGoals();
    setState('goals', { ...getState().goals, [year]: { ...yg, [section]: fn(yg[section] ?? []) } });
  }

  _addGoal(section, title, notes, tags) {
    const goal = { id: crypto.randomUUID(), title, notes, tags: tags ?? [], percentage: 0 };
    this._mutateSection(section, list => [...list, goal]);
  }

  _editGoal(section, id, title, notes, tags) {
    this._mutateSection(section, list => list.map(g => g.id === id ? { ...g, title, notes, tags } : g));
  }

  _setProgress(section, id, percentage) {
    this._mutateSection(section, list => list.map(g => g.id === id ? { ...g, percentage } : g));
  }

  _deleteGoal(section, id) {
    this._mutateSection(section, list => list.filter(g => g.id !== id));
  }

  _deleteGoalWithUndo(section, id) {
    const snapshot = getState().goals;
    this._deleteGoal(section, id);
    toast(t('home.toast-goal-deleted'), 'info', { action: { label: t('undo.button'), onClick: () => setState('goals', snapshot) } });
  }

  // ── Filter helpers ────────────────────────────────────────────────────────

  _loadFilter() {
    try {
      const raw = localStorage.getItem(`telos:filter:goals:${this._year}`);
      if (raw) {
        const { query = '', states = [], tags = [], panelExpanded = false, barExpanded = false } = JSON.parse(raw);
        this._filter = { query, states: new Set(states), tags: new Set(tags) };
        this._panelExpanded = panelExpanded;
        this._barExpanded = barExpanded;
      }
    } catch { /* ignore */ }
  }

  _saveFilter() {
    const { query, states, tags } = this._filter;
    if (query || states.size || tags.size || this._barExpanded || this._panelExpanded) {
      localStorage.setItem(`telos:filter:goals:${this._year}`,
        JSON.stringify({ query, states: [...states], tags: [...tags], panelExpanded: this._panelExpanded, barExpanded: this._barExpanded }));
    } else {
      localStorage.removeItem(`telos:filter:goals:${this._year}`);
    }
  }

  _isFilterActive() {
    const { query, states, tags } = this._filter;
    return !!(query || states.size || tags.size);
  }

  _syncFilterUI() {
    if (!this._filterBar) return;
    if (this._filterSearch) this._filterSearch.value = this._filter.query;
    const active = this._isFilterActive();
    const stateMap = { 'fstate-done': 'done', 'fstate-ongoing': 'ongoing', 'fstate-not-started': 'not-started' };
    for (const [id, key] of Object.entries(stateMap)) {
      const btn = this.shadowRoot.querySelector(`#${id}`);
      if (btn) {
        const on = this._filter.states.has(key);
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
      }
    }
    this._header.filterDot = active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);
    const expandDot = this._filterExpandBtn?.querySelector('.filter-expand-dot');
    if (expandDot) expandDot.hidden = !(this._filter.states.size || this._filter.tags.size);
    this._filterTagRow?.querySelectorAll('.filter-tag-chip').forEach(chip => {
      const on = this._filter.tags.has(chip.dataset.tag);
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', String(on));
    });
  }

  _rebuildTagChips(goals) {
    if (!this._filterTagRow) return;
    const allTags = new Set();
    for (const goal of goals) {
      for (const tag of (goal.tags ?? [])) allTags.add(tag);
    }
    if (allTags.size === 0) {
      this._filterTagRow.hidden = true;
      this._filterTagRow.replaceChildren();
      return;
    }
    this._filterTagRow.hidden = false;
    this._filterTagRow.replaceChildren();
    for (const tag of [...allTags].sort()) {
      const btn = document.createElement('button');
      btn.className = 'filter-tag-chip';
      btn.type = 'button';
      btn.dataset.tag = tag;
      btn.textContent = tag;
      btn.style.setProperty('--tag-color', tagColor(tag));
      const on = this._filter.tags.has(tag);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.addEventListener('click', this._onGoalFilterTagChip);
      this._filterTagRow.appendChild(btn);
    }
  }

  _applyGoalFilter() {
    const { query, states, tags } = this._filter;
    const q = query.toLowerCase().trim();
    const active = !!(q || states.size || tags.size);
    let anyVisible = false;

    const sections = [
      { list: this._capstoneList,  section: this._capstoneSection },
      { list: this._milestoneList, section: this._milestoneSection },
      { list: this._wowList,       section: this._wowSection },
      { list: this._focusList,     section: this._focusSection },
    ];

    for (const { list, section } of sections) {
      if (!list) continue;
      let sectionVisible = false;
      list.querySelectorAll('goal-item').forEach(el => {
        const goal = el._goal;
        if (!goal) { el.hidden = false; sectionVisible = true; return; }
        let show = true;
        if (q) {
          const hay = `${goal.title ?? ''} ${goal.notes ?? ''}`.toLowerCase();
          if (!hay.includes(q)) show = false;
        }
        if (show && states.size) {
          const pct = goal.percentage ?? 0;
          const gstate = pct === 100 ? 'done' : pct === 0 ? 'not-started' : 'ongoing';
          if (!states.has(gstate)) show = false;
        }
        if (show && tags.size) {
          const gtags = goal.tags ?? [];
          if (![...tags].some(tag => gtags.includes(tag))) show = false;
        }
        el.hidden = !show;
        if (show) { anyVisible = true; sectionVisible = true; }
      });
      const hide = active && !sectionVisible;
      const heading = section?.querySelector('.section-heading');
      if (heading) heading.hidden = hide;
      const addLine = section?.querySelector('.add-line');
      if (addLine) addLine.hidden = hide;
    }

    if (this._filterEmpty) this._filterEmpty.hidden = !active || anyVisible;
    this._header.filterDot = active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _renderList(container, items) {
    const byId = new Map();
    container.querySelectorAll('goal-item').forEach(el => {
      if (el._goal?.id) byId.set(el._goal.id, el);
    });

    const ordered = items.map(goal => {
      const el = byId.get(goal.id) ?? document.createElement('goal-item');
      byId.delete(goal.id);
      el.goal = goal;
      return el;
    });

    byId.forEach(el => el.remove());
    ordered.forEach(el => container.appendChild(el));
  }

  // ── Drag helpers ──────────────────────────────────────────────────────────

  _sectionOf(el) {
    if (this._capstoneList.contains(el))  return 'capstone';
    if (this._milestoneList.contains(el)) return 'milestones';
    if (this._wowList.contains(el))       return 'wow';
    if (this._focusList.contains(el))     return 'focus';
    return null;
  }

  _sectionAtY(y) {
    for (const [name, el] of [
      ['capstone',   this._capstoneSection],
      ['milestones', this._milestoneSection],
      ['wow',        this._wowSection],
      ['focus',      this._focusSection],
    ]) {
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) return name;
    }
    return null;
  }

  _listForSection(section) {
    return { capstone: this._capstoneList, milestones: this._milestoneList, wow: this._wowList, focus: this._focusList }[section];
  }

  _sectionElOf(section) {
    return { capstone: this._capstoneSection, milestones: this._milestoneSection, wow: this._wowSection, focus: this._focusSection }[section];
  }

  _insertIndexAt(list, y, ghostEl) {
    const items    = [...list.querySelectorAll('goal-item')];
    const nonGhost = items.filter(el => el !== ghostEl);
    for (const item of nonGhost) {
      const r = item.getBoundingClientRect();
      if (y < r.top + r.height / 2) return items.indexOf(item);
    }
    return items.length;
  }

  _updateInsertLine(list, targetIndex, ghostEl) {
    const items = [...list.querySelectorAll('goal-item')];
    if (targetIndex >= items.length) {
      list.appendChild(this._insertLine);
    } else {
      list.insertBefore(this._insertLine, items[targetIndex]);
    }
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

  _openGoalDialog(goal, opts) {
    this._dialog.existingTags   = this._collectAllTags();
    this._dialog.currentYear    = this._year;
    this._dialog.availableLists = getState().lists ?? [];
    this._dialog.open(goal, opts);
  }

  _collectAllTags() {
    const tags  = new Set();
    const state = getState();
    for (const yg of Object.values(state.goals ?? {})) {
      for (const section of Object.values(yg)) {
        if (Array.isArray(section)) {
          for (const goal of section) for (const tag of (goal.tags ?? [])) tags.add(tag);
        }
      }
    }
    for (const list of (state.lists ?? [])) {
      for (const item of (list.items ?? [])) for (const tag of (item.tags ?? [])) tags.add(tag);
    }
    return [...tags].sort();
  }

  _placeGoal(fromSection, fromIndex, toSection, toIndex) {
    if (fromSection === toSection && (fromIndex === toIndex || fromIndex === toIndex - 1)) return;
    const yg   = this._yearGoals();
    const from = [...(yg[fromSection] ?? [])];
    const [goal] = from.splice(fromIndex, 1);
    if (fromSection === toSection) {
      from.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, goal);
      setState('goals', { ...getState().goals, [String(this._year)]: { ...yg, [fromSection]: from } });
    } else {
      const to = [...(yg[toSection] ?? [])];
      to.splice(toIndex, 0, goal);
      setState('goals', { ...getState().goals, [String(this._year)]: { ...yg, [fromSection]: from, [toSection]: to } });
    }
  }
}

customElements.define('home-page', HomePage);
