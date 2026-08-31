import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, setRuntimeState } from '../../_lib/core/store/store.js';
import { syncChildren } from '../../_lib/core/dom/sync-children.js';
import { Reorder } from '../../_lib/modules/reorder/reorder.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import { withUndo } from '../../_lib/modules/toast/undo.js';
import { FilterState } from '../../_lib/modules/filter-state/filter-state.js';
import '../components/year-header/year-header.js';
import '../components/goal-item/goal-item.js';
import '../components/goal-dialog/goal-dialog.js';
import '../components/add-row/add-row.js';
import '../components/export-sheet/export-sheet.js';
import '../components/date-filter-row/date-filter-row.js';
import { exportGoalsMarkdown, exportGoalMarkdown } from '../utils/export-markdown.js';
import { icons } from '../icons.js';
import { tagColor } from '../utils/tag-color.js';
import { isGhostClickAfterDelete } from '../utils/delete-ghost-guard.js';
import { matchesDateBucket } from '../utils/urgency.js';
import { percentValue, setPercent, logEntry, unlogEntry, isLoggedOn } from '../utils/tracking.js';
import { filterBarStyles, filterBarMarkup } from '../utils/filter-bar.js';
import { buildGoalHandoff, buildYearHandoff, shareHandoff } from '../utils/handoff.js';
import { shareMarkdown } from '../utils/share-markdown.js';
import { nextColor } from '../utils/color-palette.js';
import { aggregateScore, aspectAverages, REFLECTION_ASPECTS } from '../utils/reflection.js';

const FILTER_SHAPE = {
  query:          { kind: 'string' },
  states:         { kind: 'set' },
  dates:          { kind: 'set' },
  tags:           { kind: 'set' },
  panelExpanded:  { kind: 'boolean' },
  barExpanded:    { kind: 'boolean' },
};

// Reflection-card equalizer bars: --radius-sm (6px, the smallest token in
// the scale) reads as a near-full semicircle on a bar this narrow, so the
// track uses a deliberate one-off below the token scale instead. Named
// (mirrors goal-item.js's TODAY_BOX/TODAY_RING_INSET pattern) because the
// fill's own corner radius is derived from it — one inside the other by
// exactly the track's border width, so the two stay in sync if this ever
// changes rather than silently drifting apart as two separately-typed numbers.
const BAR_RADIUS = 2; // px

class HomePage extends AppElement {
  template() {
    return `
      <style>
        :host {
          display: block;
          max-inline-size: var(--page-max-width);
          margin-inline: auto;
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

        /* A normal, plain scrollable-area element — no special show/hide
           mechanism, no fixed/overlay positioning: it scrolls away with
           everything else, same as any other content on this page. (Two
           earlier attempts tied it to year-header's own fixed positioning
           instead, with independent scroll-fold logic — both broke in real
           testing; this is deliberately the simple version.)
           Full-bleed and flush against the header, matching how it looked
           before this element existed as its own thing:
           - No inline-size set. It's a flex item of main (display:flex,
             flex-direction:column), so it stretches (the default align-self)
             to the container's content width minus its own margin — a
             negative margin-inline then genuinely widens the stretched box,
             the same way a plain block element's width:auto would. Setting
             inline-size:100% explicitly instead pins the box to main's
             already-inset content width and does NOT grow to compensate —
             shipped that bug once already, caught by measuring
             getBoundingClientRect() against the real viewport width.
           - margin-inline cancels main's own padding-inline (the same
             technique year-header.js's .strip-bar uses).
           - margin-block-start cancels the --space-3 breathing-room buffer
             main's own padding-block-start adds on top of clearing the
             fixed header (a buffer meant for whatever's normally first
             inside it, i.e. Capstone) — this card wants zero gap instead,
             so it lands its own top edge exactly at the header's bottom
             edge. main has no overflow:hidden, so rendering into its own
             padding area like this is safe.
           - No margin-block-end: main's own gap (space-2) is what separates
             this card from Capstone below, so there's only one place that
             ever sets that gap. */
        .reflection-card {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          margin-block-start: calc(-1 * var(--space-3));
          margin-inline: calc(-1 * var(--page-padding));
          padding: var(--space-3) var(--page-padding);
          background: var(--color-surface-raised);
          border: none;
          border-end-start-radius: var(--radius-md);
          border-end-end-radius: var(--radius-md);
          box-shadow: var(--shadow-card);
          cursor: pointer;
          text-align: start;
          font-family: var(--font-family);
        }

        .reflection-card:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* Score + per-aspect breakdown in one row: the number stands alone
           against a hairline divider, and the five bars spread across the
           rest of the width via justify-content:space-between rather than
           bunching to one side — the number no longer needs a paired "avg"
           readout to read as balanced against the bars. */
        .reflection-card-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
        }

        .reflection-card-num {
          flex-shrink: 0;
          font-size: var(--font-size-heading);
          font-weight: var(--font-weight-bold);
          line-height: 1;
          color: var(--color-accent);
          font-variant-numeric: tabular-nums;
          padding-inline-end: var(--space-3);
          border-inline-end: 1px solid var(--color-border);
        }

        .reflection-card-bars {
          display: flex;
          align-items: flex-end;
          flex: 1;
          min-inline-size: 0;
          justify-content: space-between;
        }

        .reflection-card-bar-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .reflection-card-bar-wrap span {
          font-size: var(--font-size-micro);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
        }

        /* BAR_RADIUS explained above, at its definition. Border in
           --color-text-muted rather than --color-border: the two neutrals
           are close enough in tone that the border is otherwise very hard to
           make out against the card's own --color-surface-raised background. */
        .reflection-card-bar-track {
          position: relative;
          inline-size: 10px;
          block-size: 26px;
          border-radius: ${BAR_RADIUS}px ${BAR_RADIUS}px 0 0;
          border: 1px solid var(--color-text-muted);
          background: var(--color-border);
          display: flex;
          align-items: flex-end;
        }

        .reflection-card-bar-fill {
          inline-size: 100%;
          block-size: var(--bar-fill, 0%);
          border-radius: ${BAR_RADIUS - 1}px ${BAR_RADIUS - 1}px 0 0;
          background: var(--color-accent);
        }

        /* The average marker for this aspect across every year reflected on
           (including this one — see aspectAverages) — omitted (not just
           hidden at 0) only when nobody has ever rated this aspect at all.
           It can sit over the accent-filled portion of the bar or the plain
           border-coloured track, in either theme — a fixed colour picked for
           one case goes invisible in another (same problem goal-item's
           .freq-target-num solves). White XOR'd via mix-blend-mode:difference
           resolves a contrasting colour per-pixel regardless of what's under
           it, so it stays visible in every combination without a
           theme-conditional colour. */
        .reflection-card-bar-tick {
          position: absolute;
          inset-inline: 0;
          inset-block-end: var(--bar-avg, 0%);
          block-size: 2px;
          background: #FFFFFF;
          mix-blend-mode: difference;
        }

        .reflection-card-comment {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
          font-size: var(--font-size-caption);
          color: var(--color-text-secondary);
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

        /* ── Filter bar (slotted into year-header) — shell shared via
           app/utils/filter-bar.js; panel-row vocabulary below stays local. */
        ${filterBarStyles()}

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

      <year-header id="header">
        ${filterBarMarkup({
          slot: 'filter-bar',
          searchPlaceholder: t('home-page.filter-search'),
          searchLabel: t('home-page.filter-search'),
          expandLabel: t('home-page.filter-expand'),
          clearLabel: t('home-page.filter-clear'),
          rowsHtml: `
            <div class="filter-row" id="filter-states-row" role="group" aria-label="${t('home-page.filter-toggle')}">
              <button class="filter-pill" id="fstate-done" data-state="done" aria-pressed="false">${t('home-page.filter-done')}</button>
              <button class="filter-pill" id="fstate-ongoing" data-state="ongoing" aria-pressed="false">${t('home-page.filter-ongoing')}</button>
              <button class="filter-pill" id="fstate-not-started" data-state="not-started" aria-pressed="false">${t('home-page.filter-not-started')}</button>
              <button class="filter-pill" id="fstate-archived" data-state="archived" aria-pressed="false">${t('home-page.filter-archived')}</button>
            </div>
            <date-filter-row id="date-filter-row"></date-filter-row>
            <div class="filter-row" id="filter-tag-row" hidden></div>
          `,
        })}
      </year-header>

      <main>
        <button type="button" class="reflection-card" id="reflection-card" hidden>
          <div class="reflection-card-row" id="reflection-card-row">
            <span class="reflection-card-num" id="reflection-card-num"></span>
            <div class="reflection-card-bars" id="reflection-card-bars">
              ${REFLECTION_ASPECTS.map(a => `
                <div class="reflection-card-bar-wrap" data-aspect="${a.key}">
                  <div class="reflection-card-bar-track">
                    <div class="reflection-card-bar-tick" hidden></div>
                    <div class="reflection-card-bar-fill"></div>
                  </div>
                  <span aria-hidden="true">${t(a.abbrKey)}</span>
                </div>
              `).join('')}
            </div>
            <span class="sr-only" id="reflection-card-bars-sr"></span>
          </div>
          <span class="reflection-card-comment" id="reflection-card-comment"></span>
        </button>

        <p id="filter-empty" hidden>${t('home-page.filter-empty')}</p>
        <p role="status" class="sr-only" id="filter-live"></p>

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
      <export-sheet id="goal-export-sheet"></export-sheet>
    `;
  }

  subscribe() {
    this._year = Number(this.params?.year);
    if (!Number.isInteger(this._year) || this._year < 1900 || this._year > 2500) {
      navigate(`${BASE_PATH}not-found`);
      return;
    }
    this._header = this.shadowRoot.querySelector('#header');
    this._dialog = this.shadowRoot.querySelector('#dialog');
    this._editingSection = 'capstone';
    this._editingGoal    = null;

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
    this.listen(this._header, 'year-navigate', this._onYearNavigate);

    // ── Reflection summary ────────────────────────────────────────────────────
    // A plain element in the scrollable area, above Capstone — no special
    // show/hide-on-scroll behaviour. Opening the dialog itself is owned by
    // year-header.js (which also owns the store commits/session-undo toast
    // for it); this is just a second, differently-placed entry point into
    // the same `openReflection()`.

    this._reflectionCard        = this.shadowRoot.querySelector('#reflection-card');
    this._reflectionCardRow     = this.shadowRoot.querySelector('#reflection-card-row');
    this._reflectionCardNum     = this.shadowRoot.querySelector('#reflection-card-num');
    this._reflectionCardBarsSr  = this.shadowRoot.querySelector('#reflection-card-bars-sr');
    this._reflectionCardComment = this.shadowRoot.querySelector('#reflection-card-comment');
    // One { fill, tick } pair per aspect, keyed by aspect key — the wraps
    // themselves are static (rendered once from REFLECTION_ASPECTS), only
    // their fill height / tick position change per year.
    this._reflectionCardBars = {};
    this.shadowRoot.querySelectorAll('.reflection-card-bar-wrap').forEach(wrap => {
      this._reflectionCardBars[wrap.dataset.aspect] = {
        fill: wrap.querySelector('.reflection-card-bar-fill'),
        tick: wrap.querySelector('.reflection-card-bar-tick'),
      };
    });

    this._onReflections = reflections => {
      const reflection = reflections?.[String(this._year)];
      const score      = aggregateScore(reflection);
      this._reflectionCard.hidden = !reflection || reflection.showCard === false;
      if (this._reflectionCard.hidden) return;

      this._reflectionCardRow.hidden = score == null;
      this._reflectionCardNum.textContent = score != null ? score.toFixed(1) : '';

      const averages = aspectAverages(reflections);
      const summaryParts = [];
      for (const aspect of REFLECTION_ASPECTS) {
        const { fill, tick } = this._reflectionCardBars[aspect.key];
        const value = reflection.scores?.[aspect.key];
        fill.style.setProperty('--bar-fill', value ? `${(value / 5) * 100}%` : '0%');
        const avg = averages[aspect.key];
        tick.hidden = avg == null;
        if (avg != null) tick.style.setProperty('--bar-avg', `${(avg / 5) * 100}%`);
        if (value) summaryParts.push(t('reflection.card-aspect-summary', { label: t(aspect.labelKey), value }));
      }
      this._reflectionCardBarsSr.textContent = summaryParts.join(', ');

      this._reflectionCardComment.hidden = !reflection.comment;
      this._reflectionCardComment.textContent = reflection.comment ?? '';
    };
    this.watch('reflections', this._onReflections);

    this.listen(this._reflectionCard, 'click', () => this._header.openReflection());

    // ── Filter bar ────────────────────────────────────────────────────────────

    this._filterBar      = this.shadowRoot.querySelector('#filter-bar');
    this._filterSearch   = this.shadowRoot.querySelector('#filter-search');
    this._filterPanel    = this.shadowRoot.querySelector('#filter-panel');
    this._filterTagRow   = this.shadowRoot.querySelector('#filter-tag-row');
    this._filterEmpty    = this.shadowRoot.querySelector('#filter-empty');
    this._filterLive     = this.shadowRoot.querySelector('#filter-live');
    this._filterExpandBtn = this.shadowRoot.querySelector('#filter-expand-btn');

    this._filterState = FilterState(`telos:filter:goals:${this._year}`, FILTER_SHAPE);
    this._filter = { query: '', states: new Set(), dates: new Set(), tags: new Set() };
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
      this._syncFilterUI();
      if (nowOpen) requestAnimationFrame(() => this._filterSearch?.focus());
    };
    this.listen(this._header, 'filter-click', this._onFilterClick);

    this._onFilterExpand = () => {
      this._panelExpanded = !this._panelExpanded;
      this._saveFilter();
      this._syncFilterUI();
    };
    this.listen(this._filterExpandBtn, 'click', this._onFilterExpand);

    this._onFilterSearch = () => {
      this._filter.query = this._filterSearch.value;
      this._saveFilter();
      this._syncFilterUI();
      this._applyGoalFilter();
    };
    this.listen(this._filterSearch, 'input', this._onFilterSearch);

    this._onFilterState = e => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      const state = btn.dataset.state;
      if (!state) return;
      if (this._filter.states.has(state)) this._filter.states.delete(state);
      else this._filter.states.add(state);
      this._saveFilter();
      this._syncFilterUI();
      this._applyGoalFilter();
    };
    this.listen(this.shadowRoot.querySelector('#filter-states-row'), 'click', this._onFilterState);

    this._onFilterDate = e => {
      const key = e.detail.key;
      if (this._filter.dates.has(key)) this._filter.dates.delete(key);
      else this._filter.dates.add(key);
      this._saveFilter();
      this._syncFilterUI();
      this._applyGoalFilter();
    };
    this._dateFilterRow = this.shadowRoot.querySelector('#date-filter-row');
    this.listen(this._dateFilterRow, 'date-toggle', this._onFilterDate);

    this._onFilterClear = () => {
      this._filter = { query: '', states: new Set(), dates: new Set(), tags: new Set() };
      this._filterSearch.value = '';
      this._saveFilter();
      this._syncFilterUI();
      this._applyGoalFilter();
    };
    this.listen(this.shadowRoot.querySelector('#filter-clear-btn'), 'click', this._onFilterClear);

    if (this._barExpanded) {
      this._filterBar.hidden = false;
      this._header.filterExpanded = true;
      this._header.forceCompact = true;
    }

    // ── Store subscription ────────────────────────────────────────────────────

    this._onAccentColors = colors => this._applyAccent(colors?.[String(this._year)]);
    this.watch('accentColors', this._onAccentColors);

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
      if (!this._filterSuppressed) this._applyGoalFilter();
    };
    this.watch('goals', this._onGoals);

    // Upcoming-dialog row tap (bottom-nav.js) — set the moment before
    // navigate() brings this page (possibly freshly mounted) to the goal's
    // year. Registered after the 'goals' watch above so its own immediate
    // delivery (Store.subscribe calls back synchronously on subscribe) runs
    // once goal-item rows already exist to search across.
    this._onPendingFocus = pending => this._applyPendingGoalFocus(pending);
    this.watch('pendingFocus', this._onPendingFocus);

    // ── Add-line / fold ───────────────────────────────────────────────────────

    // Opens the add-goal dialog for a section and keeps that section's add row
    // expanded (`add-open`) so several goals can be added in a row. Shared by
    // both entry points: the full add row and the collapsed add-line hairline.
    const makeSectionAdder = (section, sectionEl) => () => {
      // Ignore the synthesized click that follows deleting the last goal — the
      // add row shifts up under the finger and would otherwise open this dialog.
      if (isGhostClickAfterDelete()) return;
      sectionEl.classList.add('add-open');
      this._editingSection = section;
      this._editingGoal    = null;
      this._openGoalDialog(null);
    };
    const makeFold = sectionEl => () => sectionEl.classList.remove('add-open');

    this._onAddLineCapstone  = makeSectionAdder('capstone',   this._capstoneSection);
    this._onAddLineMilestone = makeSectionAdder('milestones', this._milestoneSection);
    this._onAddLineWow       = makeSectionAdder('wow',        this._wowSection);
    this._onAddLineFocus     = makeSectionAdder('focus',      this._focusSection);
    this._onFoldCapstone     = makeFold(this._capstoneSection);
    this._onFoldMilestone    = makeFold(this._milestoneSection);
    this._onFoldWow          = makeFold(this._wowSection);
    this._onFoldFocus        = makeFold(this._focusSection);

    this.listen(this.shadowRoot.querySelector('#add-line-capstone'), 'click',  this._onAddLineCapstone);
    this.listen(this.shadowRoot.querySelector('#add-line-milestone'), 'click', this._onAddLineMilestone);
    this.listen(this.shadowRoot.querySelector('#add-line-wow'), 'click',       this._onAddLineWow);
    this.listen(this.shadowRoot.querySelector('#add-line-focus'), 'click',     this._onAddLineFocus);
    this.listen(this.shadowRoot.querySelector('#fold-capstone'), 'click',      this._onFoldCapstone);
    this.listen(this.shadowRoot.querySelector('#fold-milestone'), 'click',     this._onFoldMilestone);
    this.listen(this.shadowRoot.querySelector('#fold-wow'), 'click',           this._onFoldWow);
    this.listen(this.shadowRoot.querySelector('#fold-focus'), 'click',         this._onFoldFocus);

    // ── Drag-to-reorder ───────────────────────────────────────────────────────

    this._detachReorder = Reorder.attach(this.shadowRoot, {
      itemSelector:    'goal-item',
      dragStartEvent:  'goal-drag-start',
      reorderKeyEvent: 'goal-reorder-key',
      cloneLabel:      d => d.goal.title,
      sections: [
        { name: 'capstone',   sectionEl: this._capstoneSection,  listEl: this._capstoneList },
        { name: 'milestones', sectionEl: this._milestoneSection, listEl: this._milestoneList },
        { name: 'wow',        sectionEl: this._wowSection,       listEl: this._wowList },
        { name: 'focus',      sectionEl: this._focusSection,     listEl: this._focusList },
      ],
      onMoveSection: (fromSection, from, toSection, to) => this._placeGoal(fromSection, from, toSection, to),
    });

    // ── Capstone events ───────────────────────────────────────────────────────

    this._onCapstoneGoalTap = e => {
      this._editingSection = 'capstone';
      this._editingGoal    = e.detail.goal;
      this._openGoalDialog(e.detail.goal, { year: String(this._year), section: 'capstone' });
    };
    this.listen(this._capstoneList, 'goal-tap', this._onCapstoneGoalTap);

    this._onCapstoneProgress = e => {
      this._setProgress('capstone', e.detail.goal.id, e.detail.percentage);
    };
    this.listen(this._capstoneList, 'goal-progress', this._onCapstoneProgress);

    this._onCapstoneLogToggle = e => this._toggleEntry('capstone', e.detail.goal.id);
    this.listen(this._capstoneList, 'goal-log-toggle', this._onCapstoneLogToggle);

    this._onCapstoneDelete = e => this._deleteGoalWithUndo('capstone', e.detail.goal.id);
    this.listen(this._capstoneList, 'goal-delete', this._onCapstoneDelete);

    this._onCapstoneColorCycle = e => this._cycleGoalColor('capstone', e.detail.goal.id);
    this.listen(this._capstoneList, 'goal-color-cycle', this._onCapstoneColorCycle);

    this._onAddCapstone = () => {
      this._editingSection = 'capstone';
      this._editingGoal    = null;
      this._openGoalDialog(null);
    };
    this.listen(this.shadowRoot.querySelector('#add-capstone'), 'click', this._onAddCapstone);

    // ── Milestone events ──────────────────────────────────────────────────────

    this._onMilestoneGoalTap = e => {
      this._editingSection = 'milestones';
      this._editingGoal    = e.detail.goal;
      this._openGoalDialog(e.detail.goal, { year: String(this._year), section: 'milestones' });
    };
    this.listen(this._milestoneList, 'goal-tap', this._onMilestoneGoalTap);

    this._onMilestoneProgress = e => {
      this._setProgress('milestones', e.detail.goal.id, e.detail.percentage);
    };
    this.listen(this._milestoneList, 'goal-progress', this._onMilestoneProgress);

    this._onMilestoneLogToggle = e => this._toggleEntry('milestones', e.detail.goal.id);
    this.listen(this._milestoneList, 'goal-log-toggle', this._onMilestoneLogToggle);

    this._onMilestoneDelete = e => this._deleteGoalWithUndo('milestones', e.detail.goal.id);
    this.listen(this._milestoneList, 'goal-delete', this._onMilestoneDelete);

    this._onMilestoneColorCycle = e => this._cycleGoalColor('milestones', e.detail.goal.id);
    this.listen(this._milestoneList, 'goal-color-cycle', this._onMilestoneColorCycle);

    this._onAddMilestone = makeSectionAdder('milestones', this._milestoneSection);
    this.listen(this.shadowRoot.querySelector('#add-milestone'), 'click', this._onAddMilestone);

    // ── Wow events ────────────────────────────────────────────────────────────

    this._onWowGoalTap = e => {
      this._editingSection = 'wow';
      this._editingGoal    = e.detail.goal;
      this._openGoalDialog(e.detail.goal, { year: String(this._year), section: 'wow' });
    };
    this.listen(this._wowList, 'goal-tap', this._onWowGoalTap);

    this._onWowProgress = e => {
      this._setProgress('wow', e.detail.goal.id, e.detail.percentage);
    };
    this.listen(this._wowList, 'goal-progress', this._onWowProgress);

    this._onWowLogToggle = e => this._toggleEntry('wow', e.detail.goal.id);
    this.listen(this._wowList, 'goal-log-toggle', this._onWowLogToggle);

    this._onWowDelete = e => this._deleteGoalWithUndo('wow', e.detail.goal.id);
    this.listen(this._wowList, 'goal-delete', this._onWowDelete);

    this._onWowColorCycle = e => this._cycleGoalColor('wow', e.detail.goal.id);
    this.listen(this._wowList, 'goal-color-cycle', this._onWowColorCycle);

    this._onAddWow = makeSectionAdder('wow', this._wowSection);
    this.listen(this.shadowRoot.querySelector('#add-wow'), 'click', this._onAddWow);

    // ── Forward Focus events ──────────────────────────────────────────────────

    this._onFocusGoalTap = e => {
      this._editingSection = 'focus';
      this._editingGoal    = e.detail.goal;
      this._openGoalDialog(e.detail.goal, { year: String(this._year), section: 'focus' });
    };
    this.listen(this._focusList, 'goal-tap', this._onFocusGoalTap);

    this._onFocusProgress = e => {
      this._setProgress('focus', e.detail.goal.id, e.detail.percentage);
    };
    this.listen(this._focusList, 'goal-progress', this._onFocusProgress);

    this._onFocusLogToggle = e => this._toggleEntry('focus', e.detail.goal.id);
    this.listen(this._focusList, 'goal-log-toggle', this._onFocusLogToggle);

    this._onFocusDelete = e => this._deleteGoalWithUndo('focus', e.detail.goal.id);
    this.listen(this._focusList, 'goal-delete', this._onFocusDelete);

    this._onFocusColorCycle = e => this._cycleGoalColor('focus', e.detail.goal.id);
    this.listen(this._focusList, 'goal-color-cycle', this._onFocusColorCycle);

    this._onAddFocus = makeSectionAdder('focus', this._focusSection);
    this.listen(this.shadowRoot.querySelector('#add-focus'), 'click', this._onAddFocus);

    // ── Year export ───────────────────────────────────────────────────────────

    this._onYearExportConfirm = async e => {
      const { metadata, notes, reflection: includeReflection } = e.detail;
      const reflection = includeReflection ? getState().reflections?.[String(this._year)] : null;
      const md = exportGoalsMarkdown(this._yearGoals(), this._year, { metadata, notes, reflection });
      try {
        const result = await shareMarkdown(md, `Telos — ${this._year}`);
        if (result === 'copied') toast(t('export.copied'), 'success');
      } catch (err) {
        console.error('Export year failed:', err);
        toast(t('share.error'), 'error');
      }
    };
    this.listen(this.shadowRoot, 'year-export-confirm', this._onYearExportConfirm);

    // ── Dialog events ─────────────────────────────────────────────────────────

    this._onGoalTagsChanged = e => {
      if (!this._editingGoal) return;
      this._mutateSection(this._editingSection, list =>
        list.map(g => g.id === this._editingGoal.id ? { ...g, tags: e.detail.tags } : g)
      );
    };
    this.listen(this.shadowRoot, 'goal-tags-changed', this._onGoalTagsChanged);

    this._onGoalTitleChanged = e => {
      if (!this._editingGoal) return;
      this._mutateSection(this._editingSection, list =>
        list.map(g => g.id === this._editingGoal.id ? { ...g, title: e.detail.title } : g)
      );
    };
    this.listen(this.shadowRoot, 'goal-title-changed', this._onGoalTitleChanged);

    this._onGoalNotesChanged = e => {
      if (!this._editingGoal) return;
      this._mutateSection(this._editingSection, list =>
        list.map(g => g.id === this._editingGoal.id ? { ...g, notes: e.detail.notes } : g)
      );
    };
    this.listen(this.shadowRoot, 'goal-notes-changed', this._onGoalNotesChanged);

    this._onGoalDueDateChanged = e => {
      if (!this._editingGoal) return;
      this._mutateSection(this._editingSection, list =>
        list.map(g => g.id === this._editingGoal.id ? { ...g, dueDate: e.detail.dueDate } : g)
      );
    };
    this.listen(this.shadowRoot, 'goal-duedate-changed', this._onGoalDueDateChanged);

    this._onGoalColorChanged = e => {
      if (!this._editingGoal) return;
      this._mutateSection(this._editingSection, list => list.map(g => {
        if (g.id !== this._editingGoal.id) return g;
        const { color: _, ...rest } = g;
        return e.detail.color ? { ...rest, color: e.detail.color } : rest;
      }));
    };
    this.listen(this.shadowRoot, 'goal-color-changed', this._onGoalColorChanged);

    this._onGoalEntryToggle = e => {
      if (!this._editingGoal) return;
      this._toggleEntryOn(this._editingSection, this._editingGoal.id, e.detail.iso);
    };
    this.listen(this.shadowRoot, 'goal-entry-toggle', this._onGoalEntryToggle);

    this._onGoalTrackingChanged = e => {
      if (!this._editingGoal) return;
      this._mutateSection(this._editingSection, list =>
        list.map(g => g.id === this._editingGoal.id ? { ...g, tracking: e.detail.tracking } : g)
      );
    };
    this.listen(this.shadowRoot, 'goal-tracking-changed', this._onGoalTrackingChanged);

    this._onGoalArchivedChanged = e => {
      if (!this._editingGoal) return;
      const { archived } = e.detail;
      if (archived) {
        this._filterSuppressed = true;
        clearTimeout(this._filterSuppressTimer);
      } else if (this._filterSuppressed) {
        this._filterSuppressed = false;
        clearTimeout(this._filterSuppressTimer);
      }
      this._setArchived(this._editingSection, this._editingGoal.id, archived);
      toast(t(archived ? 'home.toast-goal-archived' : 'home.toast-goal-unarchived'), 'success');
    };
    this.listen(this.shadowRoot, 'goal-archived-changed', this._onGoalArchivedChanged);

    this._onGoalClosed = () => {
      const snap = this._editSnapshot;
      this._editSnapshot = null;
      if (snap && JSON.stringify(getState().goals) !== JSON.stringify(snap)) {
        toast(t('home.toast-goal-saved'), 'success',
          { action: { label: t('undo.button'), onClick: () => setState('goals', snap) } });
      }
      if (this._filterSuppressed) {
        clearTimeout(this._filterSuppressTimer);
        this._filterSuppressTimer = setTimeout(() => {
          this._filterSuppressed = false;
          this._applyGoalFilter();
        }, 700);
      }
    };
    this.listen(this.shadowRoot, 'goal-closed', this._onGoalClosed);

    this._onGoalCreated = e => {
      const { title, notes, dueDate, tags, color, tracking } = e.detail;
      const snapshot = getState().goals;
      const goal = this._addGoal(this._editingSection, title, notes, dueDate, tags, tracking, color);
      // goal-created now fires on title blur (commit-on-blur) while the dialog is
      // still open, so track the new goal as the one being edited — later
      // notes/tag/due-date changes in the same session update it in place.
      this._editingGoal = goal;
      if (this._goalFilterActive() && !this._goalMatchesFilter(goal)) {
        toast(t('home.toast-goal-hidden'), 'info',
          { action: { label: t('filter.toast-show'), onClick: () => this._revealCreatedGoal(goal.id) } });
      } else {
        toast(t('home.toast-goal-saved'), 'success',
          { action: { label: t('undo.button'), onClick: () => setState('goals', snapshot) } });
      }
    };
    this.listen(this.shadowRoot, 'goal-created', this._onGoalCreated);

    this._onDialogDelete = () => {
      if (this._editingGoal) {
        withUndo({
          getSnapshot: () => getState().goals,
          apply:       () => this._deleteGoal(this._editingSection, this._editingGoal.id),
          restore:     snapshot => setState('goals', snapshot),
          message:     t('home.toast-goal-deleted'),
          undoLabel:   t('undo.button'),
        });
      }
    };
    this.listen(this._dialog, 'goal-delete', this._onDialogDelete);

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
    this.listen(this._dialog, 'goal-move', this._onGoalMove);

    // ── Goal create list item ─────────────────────────────────────────────────

    this._onGoalCreateItem = e => {
      const { goal, targetListIds, newListName, copy, fromYear, fromSection } = e.detail;
      const baseItem = {
        title: goal.title,
        note: goal.notes || undefined,
        status: 'open',
        dueDate: goal.dueDate,
        tags: [...(goal.tags ?? [])],
        color: goal.color,
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
    this.listen(this._dialog, 'goal-create-item', this._onGoalCreateItem);

    this._onGoalShareRequest = async e => {
      try {
        await shareHandoff(buildGoalHandoff(e.detail.goal), e.detail.goal.title);
      } catch (err) {
        console.error('Share goal failed:', err);
        toast(t('share.error'), 'error');
      }
    };
    this.listen(this._dialog, 'goal-share-request', this._onGoalShareRequest);

    this._goalExportSheet = this.shadowRoot.querySelector('#goal-export-sheet');

    this._onGoalExportRequest = e => {
      this._exportGoal = e.detail.goal;
      this._goalExportSheet.show();
    };
    this.listen(this._dialog, 'goal-export-request', this._onGoalExportRequest);

    this._onGoalExportConfirm = async e => {
      if (!this._exportGoal) return;
      const { metadata, notes } = e.detail;
      const md = exportGoalMarkdown(this._exportGoal, { metadata, notes });
      try {
        const result = await shareMarkdown(md, this._exportGoal.title);
        if (result === 'copied') toast(t('export.copied'), 'success');
      } catch (err) {
        console.error('Export goal failed:', err);
        toast(t('share.error'), 'error');
      }
    };
    this.listen(this._goalExportSheet, 'extract-confirm', this._onGoalExportConfirm);

    this._onYearShareRequest = async () => {
      try {
        await shareHandoff(buildYearHandoff(this._year, this._yearGoals()), String(this._year));
      } catch (err) {
        console.error('Share year failed:', err);
        toast(t('share.error'), 'error');
      }
    };
    this.listen(this.shadowRoot, 'year-share-request', this._onYearShareRequest);
  }

  unsubscribe() {
    // Static listeners and store subscriptions are auto-removed by listen()/watch().
    clearTimeout(this._filterSuppressTimer);
    this._detachReorder?.();
  }

  // ── Accent colour ─────────────────────────────────────────────────────────

  _applyAccent(hex) {
    const s = this.style;
    if (!hex) {
      // Read the fixed --color-app-accent* aliases from index.html rather than
      // re-hardcoding the same hex here — one source of truth for the default.
      const root = getComputedStyle(document.documentElement);
      s.setProperty('--color-accent',        root.getPropertyValue('--color-app-accent').trim());
      s.setProperty('--color-accent-light',  root.getPropertyValue('--color-app-accent-light').trim());
      s.setProperty('--color-accent-dark',   root.getPropertyValue('--color-app-accent-dark').trim());
      s.setProperty('--color-accent-subtle', root.getPropertyValue('--color-app-accent-subtle').trim());
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

  _addGoal(section, title, notes, dueDate, tags, tracking = { type: 'percentage', value: 0 }, color) {
    const goal = { id: crypto.randomUUID(), title, notes, dueDate, tags: tags ?? [], tracking, color };
    this._mutateSection(section, list => [...list, goal]);
    return goal;
  }

  _setProgress(section, id, percentage) {
    this._mutateSection(section, list => list.map(g => g.id === id ? setPercent(g, percentage) : g));
  }

  // Toggles *today's* entry — the row's own hold gesture only ever touches today.
  _toggleEntry(section, id) {
    this._mutateSection(section, list => list.map(g =>
      g.id === id ? (isLoggedOn(g) ? unlogEntry(g) : logEntry(g)) : g
    ));
  }

  // Toggles an arbitrary date's entry — the edit dialog's "Fix a day" strip.
  _toggleEntryOn(section, id, iso) {
    this._mutateSection(section, list => list.map(g =>
      g.id === id ? (isLoggedOn(g, iso) ? unlogEntry(g, iso) : logEntry(g, iso)) : g
    ));
  }

  _setArchived(section, id, archived) {
    this._mutateSection(section, list => list.map(g => g.id === id ? { ...g, archived } : g));
  }

  _cycleGoalColor(section, id) {
    this._mutateSection(section, list => list.map(g => {
      if (g.id !== id) return g;
      const color = nextColor(g.color);
      const { color: _, ...rest } = g;
      return color ? { ...rest, color } : rest;
    }));
  }

  _deleteGoal(section, id) {
    this._mutateSection(section, list => list.filter(g => g.id !== id));
  }

  _deleteGoalWithUndo(section, id) {
    withUndo({
      getSnapshot: () => getState().goals,
      apply:       () => this._deleteGoal(section, id),
      restore:     snapshot => setState('goals', snapshot),
      message:     t('home.toast-goal-deleted'),
      undoLabel:   t('undo.button'),
    });
  }

  // ── Filter helpers ────────────────────────────────────────────────────────
  // No cleanup hook for telos:filter:goals:<year> on year "deletion" — years
  // aren't a deletable entity (no delete-year feature exists); a year is just
  // whichever key happens to have goal data. Unlike list deletion, there's
  // nothing to hook this removal to.

  _loadFilter() {
    const { query, states, dates, tags, panelExpanded, barExpanded } = this._filterState.load();
    this._filter = { query, states, dates, tags };
    this._panelExpanded = panelExpanded;
    this._barExpanded = barExpanded;
  }

  _saveFilter() {
    this._filterState.save({ ...this._filter, panelExpanded: this._panelExpanded, barExpanded: this._barExpanded });
  }

  _isFilterActive() {
    return this._filterState.isActive({ ...this._filter, panelExpanded: this._panelExpanded, barExpanded: this._barExpanded });
  }

  _syncFilterUI() {
    if (!this._filterBar) return;
    if (this._filterSearch) this._filterSearch.value = this._filter.query;
    const active = this._isFilterActive();
    const stateMap = { 'fstate-done': 'done', 'fstate-ongoing': 'ongoing', 'fstate-not-started': 'not-started', 'fstate-archived': 'archived' };
    for (const [id, key] of Object.entries(stateMap)) {
      const btn = this.shadowRoot.querySelector(`#${id}`);
      if (btn) {
        const on = this._filter.states.has(key);
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
      }
    }
    if (this._dateFilterRow) this._dateFilterRow.selected = this._filter.dates;
    this._header.filterDot = active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);
    const expandDot = this._filterExpandBtn?.querySelector('.filter-expand-dot');
    if (expandDot) expandDot.hidden = !(this._filter.states.size || this._filter.dates.size || this._filter.tags.size);
    this._filterTagRow?.querySelectorAll('.filter-tag-chip').forEach(chip => {
      const on = this._filter.tags.has(chip.dataset.tag);
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', String(on));
    });
    const panelOpen = this._panelExpanded || this._filter.states.size > 0 || this._filter.dates.size > 0 || this._filter.tags.size > 0;
    if (this._filterPanel) this._filterPanel.hidden = !panelOpen;
    if (this._filterExpandBtn) this._filterExpandBtn.setAttribute('aria-expanded', String(panelOpen));
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

  _revealCreatedGoal(id) {
    this._onFilterClear();
    const el = [this._capstoneList, this._milestoneList, this._wowList, this._focusList]
      .flatMap(list => [...(list?.querySelectorAll('goal-item') ?? [])])
      .find(g => g._goal?.id === id);
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  // Upcoming-dialog row tap landing here: find the goal across all four
  // sections (mirrors _revealCreatedGoal's search — the tap only carries the
  // goal id, not its section), scroll/flash it, then open goal-dialog after
  // a short delay so the flash is actually visible before the dialog covers
  // the screen.
  //
  // Only clears the runtime signal once a match is actually found on THIS
  // page — not on the initial kind check. navigate() (bottom-nav.js) fires
  // synchronously, but the *old* home-page instance (a different year) is
  // still mounted and subscribed at the moment setRuntimeState() notifies,
  // and it also matches kind === 'goal'. Clearing unconditionally there
  // would consume the signal before the *new* (correct-year) instance ever
  // mounts to read it — confirmed by an E2E test that timed out until this
  // ordering was fixed. Leaving it set on a no-match lets whichever instance
  // actually has the goal consume it instead.
  _applyPendingGoalFocus(pending) {
    if (!pending || pending.kind !== 'goal') return;

    const sections = [
      { name: 'capstone',   list: this._capstoneList },
      { name: 'milestones', list: this._milestoneList },
      { name: 'wow',        list: this._wowList },
      { name: 'focus',      list: this._focusList },
    ];
    let el = null, section = null;
    for (const s of sections) {
      el = [...(s.list?.querySelectorAll('goal-item') ?? [])].find(g => g._goal?.id === pending.id);
      if (el) { section = s.name; break; }
    }
    if (!el) return;
    setRuntimeState('pendingFocus', null);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    el.classList.add('nav-flash');
    setTimeout(() => el.classList.remove('nav-flash'), 900);

    const goal = el._goal;
    setTimeout(() => {
      this._editingSection = section;
      this._editingGoal = goal;
      this._openGoalDialog(goal, { year: String(this._year), section });
    }, reduced ? 0 : 450);
  }

  _goalFilterActive() {
    const { query, states, dates, tags } = this._filter;
    return !!(query.toLowerCase().trim() || states.size || dates.size || tags.size);
  }

  _goalMatchesFilter(goal) {
    const { query, states, dates, tags } = this._filter;
    const q = query.toLowerCase().trim();
    if (goal.archived) {
      // Archived goals: only shown when 'archived' state pill is active
      if (!states.has('archived')) return false;
    } else if (states.size) {
      // Non-archived goals with state filter: check progress-based states (OR logic)
      const progressStates = [...states].filter(s => s !== 'archived');
      if (progressStates.length > 0) {
        const pct = percentValue(goal);
        const gstate = pct === 100 ? 'done' : pct === 0 ? 'not-started' : 'ongoing';
        if (!progressStates.includes(gstate)) return false;
      } else {
        // Only 'archived' was selected — non-archived goals don't match
        return false;
      }
    }
    if (q) {
      const hay = `${goal.title ?? ''} ${goal.notes ?? ''} ${(goal.tags ?? []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (tags.size) {
      const gtags = goal.tags ?? [];
      if (![...tags].some(tag => gtags.includes(tag))) return false;
    }
    if (dates.size) {
      const active = !goal.archived && percentValue(goal) < 100;
      if (![...dates].some(key => matchesDateBucket(key, goal.dueDate, active))) return false;
    }
    return true;
  }

  _applyGoalFilter() {
    const active = this._goalFilterActive();
    let anyVisible = false;
    let visibleCount = 0;

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
        const show = this._goalMatchesFilter(goal);
        el.hidden = !show;
        if (show) { anyVisible = true; sectionVisible = true; visibleCount++; }
      });
      const hide = active && !sectionVisible;
      const heading = section?.querySelector('.section-heading');
      if (heading) heading.hidden = hide;
      const addLine = section?.querySelector('.add-line');
      if (addLine) addLine.hidden = hide;
    }

    if (this._filterEmpty) this._filterEmpty.hidden = !active || anyVisible;
    if (this._filterLive) this._filterLive.textContent = active ? t('home-page.filter-count', { count: visibleCount }) : '';
    this._header.filterDot = active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _renderList(container, items) {
    syncChildren(container, items, 'goal-item', (el, goal) => { el.goal = goal; },
      { getElId: el => el._goal?.id });
  }

  _openGoalDialog(goal, opts) {
    this._dialog.existingTags   = this._collectAllTags();
    this._dialog.currentYear    = this._year;
    this._dialog.availableLists = getState().lists ?? [];
    if (goal) this._editSnapshot = getState().goals;
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
