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
import { onDayChange } from '../utils/day-change-watcher.js';
import '../components/year-header/year-header.js';
import '../components/goal-item/goal-item.js';
import '../components/goal-dialog/goal-dialog.js';
import '../components/export-sheet/export-sheet.js';
import '../components/date-filter-row/date-filter-row.js';
import { exportGoalsMarkdown, exportGoalMarkdown } from '../utils/export-markdown.js';
import { icons } from '../icons.js';
import { tagColor } from '../utils/tag-color.js';
import { matchesDateBucket } from '../utils/urgency.js';
import { yearDeadlinesLevel } from '../utils/deadline-visibility.js';
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
// track uses a deliberate one-off below the token scale instead. Only the
// track's own top corners are rounded — the fill inside stays square (see
// .reflection-card-bar-fill) since its own height can be smaller than this
// radius at a low value, which looked like a blob rather than a subtle
// curve.
const BAR_RADIUS = 2; // px

// How long the reflection-card bars take to grow in from 0 the first time
// the card becomes visible for a given page instance (year navigation
// mounts a fresh home-page, so this fires once per year visited) — not on
// every live edit while the dialog is open, which still snaps instantly as
// before. See _onReflections' firstRender branch.
const BAR_GROW_MS = 450;

class HomePage extends AppElement {
  template() {
    return `
      <style>
        :host {
          display: block;
          max-inline-size: var(--page-max-width);
          margin-inline: auto;
          --page-padding: var(--space-5);
          /* No token between --font-size-caption (13px) and --font-size-body
             (16px) — body read too big for the reflection card's comment
             text, caption too small. A deliberate one-off, same idiom as
             BAR_RADIUS below for the bar chart's corner radius. */
          --reflection-comment-font-size: 0.94rem;
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

        /* Add lives here now, not in the row flow — a goal section used to
           show a dashed add-row (empty) or a hairline "+" (non-empty, see
           the removed .add-line/.list-section.empty rules) sitting *among*
           the rows themselves. Anchoring it to the heading instead means the
           goal list is always an uninterrupted flow: nothing before, between,
           or after the rows ever changes shape. Same control regardless of
           whether the section is empty or full — no separate empty-state
           treatment any more. */
        .section-add-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          /* Muted rather than accent — a known contrast exception, same call
             as the "+ New Item"/"+ New List" row text, see
             feedback_paused_closed_status_contrast_accepted.md. */
          color: var(--color-text-secondary);
          font-size: var(--font-size-heading);
          font-weight: var(--font-weight-regular);
          line-height: 1;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
        }

        .section-add-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .list-section {
          display: flex;
          flex-direction: column;
        }

        /* Flush, full-bleed rows — see list-detail-page.js's #item-list for
           the same technique (negative margin-inline cancels main's own
           padding, no explicit inline-size). Deliberately NOT overflow:hidden
           here, unlike the other two ports: goal-item's own :host already
           self-clips its swipe gesture (unchanged), and critically, its
           celebration particle-burst needs to escape up to 185px beyond the
           row — a parent's overflow:hidden would clip that regardless of
           :host's own overflow:visible during the burst, since a parent
           always bounds an absolutely-positioned descendant's paint. */
        .item-list {
          display: flex;
          flex-direction: column;
          margin-inline: calc(-1 * var(--page-padding));
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

        /* space-evenly (not space-between) so the gap before the first bar
           and after the last one is the *same* size as the gaps between
           bars, rather than zero — that's what made the chart read as 5
           independently-placed items instead of one coherent element.
           Still fills the row's full width, unlike a centred fixed-gap
           layout, which left too much unused space on the sides. */
        .reflection-card-bars {
          display: flex;
          align-items: flex-end;
          justify-content: space-evenly;
          flex: 1;
          min-inline-size: 0;
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

        /* BAR_RADIUS explained above, at its definition. Widened to sit at
           least as wide as its own two-letter label below (e.g. "Pe", "Co")
           so the bar visually owns that label rather than reading narrower
           than the text under it. No border — the track's own
           --color-border fill against the card's --color-surface-raised
           background is enough differentiation on its own. */
        .reflection-card-bar-track {
          position: relative;
          inline-size: 18px;
          block-size: 26px;
          border-radius: ${BAR_RADIUS}px ${BAR_RADIUS}px 0 0;
          background: var(--color-border);
          display: flex;
          align-items: flex-end;
        }

        /* Square, not rounded to match the track — at a low value the fill's
           own block-size can be smaller than BAR_RADIUS itself, which turned
           the rounded top into a dome/blob instead of a subtle curve. The
           track's own rounded top corners still define the bar's overall
           silhouette. */
        .reflection-card-bar-fill {
          inline-size: 100%;
          block-size: var(--bar-fill, 0%);
          border-radius: 0;
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
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-block-end: var(--space-1);
          font-size: var(--reflection-comment-font-size);
          /* --color-text-secondary is documented (tokens.css) as large-text
             (18px+) only — this is body-sized text, so --color-text-primary
             is the correct token here, not a stylistic choice. */
          color: var(--color-text-primary);
        }

        #capstone-section {
          padding-block-start: var(--space-1);
        }

        #capstone-list goal-item {
          --goal-item-height: 68px;
        }


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
          <span class="reflection-card-comment" id="reflection-card-comment"></span>
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
        </button>

        <p id="filter-empty" hidden>${t('home-page.filter-empty')}</p>
        <p role="status" class="sr-only" id="filter-live"></p>

        <section id="capstone-section" class="list-section" aria-label="${t('home-page.capstone-section')}">
          <div class="section-header">
            <h2 class="section-heading">${t('home-page.capstone-section')}</h2>
            <button class="section-add-btn" id="add-capstone" aria-label="${t('goal-item.add-capstone')}">+</button>
          </div>
          <div id="capstone-list" class="item-list" role="list"></div>
        </section>

        <section id="milestone-section" class="list-section" aria-label="${t('home-page.milestone-section')}">
          <div class="section-header">
            <h2 class="section-heading">${t('home-page.milestone-section')}</h2>
            <button class="section-add-btn" id="add-milestone" aria-label="${t('goal-item.add-milestone')}">+</button>
          </div>
          <div id="milestone-list" class="item-list" role="list"></div>
        </section>

        <section id="wow-section" class="list-section" aria-label="${t('home-page.wow-section')}">
          <div class="section-header">
            <h2 class="section-heading">${t('home-page.wow-section')}</h2>
            <button class="section-add-btn" id="add-wow" aria-label="${t('goal-item.add-wow')}">+</button>
          </div>
          <div id="wow-list" class="item-list" role="list"></div>
        </section>

        <section id="focus-section" class="list-section" aria-label="${t('home-page.focus-section')}">
          <div class="section-header">
            <h2 class="section-heading">${t('home-page.focus-section')}</h2>
            <button class="section-add-btn" id="add-focus" aria-label="${t('goal-item.add-focus')}">+</button>
          </div>
          <div id="focus-list" class="item-list" role="list"></div>
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
    // Tells year-header how much extra scroll distance to require before its
    // own compact/photo-hide transition kicks in, so the card (normal-flow
    // content, no scroll-reactive behaviour of its own — see the reflection
    // card's own history of scroll-coupling bugs) finishes scrolling out of
    // view first. One-directional (card size -> header threshold) — this
    // never feeds back into the card's own size or visibility, so it can't
    // reproduce that earlier feedback-loop class of bug. offsetHeight is 0
    // whenever the card is hidden, so an absent reflection needs no special
    // case here.
    this._reflectionCardResizeObserver = new ResizeObserver(() => {
      this._header.reflectionCardHeight = this._reflectionCard.offsetHeight;
    });
    this._reflectionCardResizeObserver.observe(this._reflectionCard);
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

    this._reflectionBarsAnimated = false;

    this._onReflections = reflections => {
      const reflection = reflections?.[String(this._year)];
      const score      = aggregateScore(reflection);
      this._reflectionCard.hidden = !reflection || reflection.showCard === false;
      if (this._reflectionCard.hidden) return;

      this._reflectionCardRow.hidden = score == null;
      this._reflectionCardNum.textContent = score != null ? score.toFixed(1) : '';

      // Only the very first time this page instance shows the card do the
      // bars grow in from 0 — a live edit afterwards (tapping a star while
      // the dialog is open) still snaps directly to the new height, same as
      // before this existed.
      const firstRender = !this._reflectionBarsAnimated;
      this._reflectionBarsAnimated = true;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const averages = aspectAverages(reflections);
      const summaryParts = [];
      for (const aspect of REFLECTION_ASPECTS) {
        const { fill, tick } = this._reflectionCardBars[aspect.key];
        const value = reflection.scores?.[aspect.key];
        const fillPct = value ? `${(value / 5) * 100}%` : '0%';
        if (firstRender && !reduced) {
          fill.style.transition = `block-size ${BAR_GROW_MS}ms ease`;
          // Double rAF: the property is unset on first render (so it's
          // already sitting at its var(--bar-fill, 0%) default) — this just
          // guarantees a real paint happens at that 0% state before the
          // target value is applied, so the transition has something to
          // animate from rather than jumping straight to the end value.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            fill.style.setProperty('--bar-fill', fillPct);
          }));
          setTimeout(() => { fill.style.transition = ''; }, BAR_GROW_MS + 40);
        } else {
          fill.style.setProperty('--bar-fill', fillPct);
        }
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
      this._renderList(this._milestoneList, yg.milestones ?? []);
      this._renderList(this._wowList,       yg.wow       ?? []);
      this._renderList(this._focusList,     yg.focus     ?? []);

      const allGoals = [
        ...(yg.capstone ?? []), ...(yg.milestones ?? []),
        ...(yg.wow ?? []),      ...(yg.focus ?? []),
      ];
      this._rebuildTagChips(allGoals);
      this._syncFilterUI();
      if (!this._filterSuppressed) this._applyGoalFilter();
    };
    this.watch('goals', this._onGoals);

    // Deadline-level setting (year-header's own menu writes this, see
    // deadline-visibility.js) — resolved once here rather than read inline
    // by each goal-item, then re-pushed via the same render _onGoals already
    // does. Also drives year-header's own muted "hidden" badge, next to its
    // always-visible filter-toggle button — deliberately not inside the
    // collapsible filter panel, so the warning is visible before the user
    // thinks to open it at all. The badge only fires for 'off' — 'warn'
    // years are fully visible (icon + notifications), just never Failed.
    this._onGoalsDeadlinesVisible = deadlinesVisible => {
      this._deadlinesLevel = yearDeadlinesLevel(deadlinesVisible, this._year);
      this._header.deadlinesHidden = this._deadlinesLevel === 'off';
      this._onGoals(getState().goals);
    };
    this.watch('goalsDeadlinesVisible', this._onGoalsDeadlinesVisible);

    // Each goal-item's own urgency icon/full-row-red state is otherwise
    // only as fresh as the last time its .goal was set — re-run the exact
    // same render this page already does on any real data change, so
    // resuming on a new calendar day recomputes it too (see
    // day-change-watcher.js).
    onDayChange(this, () => this._onGoals(getState().goals));

    // Upcoming-dialog row tap (bottom-nav.js) — set the moment before
    // navigate() brings this page (possibly freshly mounted) to the goal's
    // year. Registered after the 'goals' watch above so its own immediate
    // delivery (Store.subscribe calls back synchronously on subscribe) runs
    // once goal-item rows already exist to search across.
    this._onPendingFocus = pending => this._applyPendingGoalFocus(pending);
    this.watch('pendingFocus', this._onPendingFocus);

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

    // Shared by all four "+"-in-heading add buttons — each just opens the
    // same goal dialog scoped to its own section (no add-open/ghost-click
    // logic needed any more now that the trigger lives in the heading, not
    // in the row flow — see removed .add-line/.list-section.empty above).
    const makeSectionAdder = section => () => {
      this._editingSection = section;
      this._editingGoal    = null;
      this._openGoalDialog(null);
    };

    this._onAddCapstone = makeSectionAdder('capstone');
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

    this._onAddMilestone = makeSectionAdder('milestones');
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

    this._onAddWow = makeSectionAdder('wow');
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

    this._onAddFocus = makeSectionAdder('focus');
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
    this._reflectionCardResizeObserver?.disconnect();
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
  // goal id, not its section) and scroll/flash it. Deliberately does NOT
  // open goal-dialog — the point of the tap is to land you on the goal in
  // its real context (this year, this section), not to pop a bare edit
  // modal; you decide whether to tap it from there.
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

    const lists = [this._capstoneList, this._milestoneList, this._wowList, this._focusList];
    const el = lists.flatMap(list => [...(list?.querySelectorAll('goal-item') ?? [])])
      .find(g => g._goal?.id === pending.id);
    if (!el) return;
    setRuntimeState('pendingFocus', null);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    el.classList.add('nav-flash');
    setTimeout(() => el.classList.remove('nav-flash'), 900);
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
      // Hides the whole heading+add-button row together now that add lives
      // there instead of in its own .add-line element inside the row flow.
      const header = section?.querySelector('.section-header');
      if (header) header.hidden = hide;
    }

    if (this._filterEmpty) this._filterEmpty.hidden = !active || anyVisible;
    if (this._filterLive) this._filterLive.textContent = active ? t('home-page.filter-count', { count: visibleCount }) : '';
    this._header.filterDot = active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _renderList(container, items) {
    syncChildren(container, items, 'goal-item', (el, goal) => {
      el.goal = goal;
      el.deadlinesLevel = this._deadlinesLevel;
    }, { getElId: el => el._goal?.id });
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
