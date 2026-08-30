import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';
import * as Store from '../../../_lib/core/store/store.js';
import { compressImage } from '../../../_lib/modules/images/images.js';
import { toast } from '../../../_lib/modules/toast/toast.js';
import '../export-sheet/export-sheet.js';
import '../reflection-dialog/reflection-dialog.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';
import { icons } from '../../icons.js';
import { aggregateScore } from '../../utils/reflection.js';

const PALETTE = [
  { hex: '#5BADE0', key: 'year-header.color-sky-blue' },
  { hex: '#3B82F6', key: 'year-header.color-blue' },
  { hex: '#6366F1', key: 'year-header.color-indigo' },
  { hex: '#8B5CF6', key: 'year-header.color-violet' },
  { hex: '#EC4899', key: 'year-header.color-pink' },
  { hex: '#EF4444', key: 'year-header.color-red' },
  { hex: '#F97316', key: 'year-header.color-orange' },
  { hex: '#EAB308', key: 'year-header.color-yellow' },
  { hex: '#22C55E', key: 'year-header.color-green' },
  { hex: '#14B8A6', key: 'year-header.color-teal' },
];

class YearHeader extends Gestures(AppElement) {
  set year(v) {
    this._year = Number(v);
    if (this.shadowRoot) this._updateYear();
  }

  template() {
    const year         = this._year ?? new Date().getFullYear();
    const pct          = yearProgress(year);
    return `
      <style>
        @media (prefers-reduced-motion: reduce) {
          .menu-sheet { animation: none; }
          .header-img { animation: none; }
          .header-bg, .year-btn, .nav-btn, .menu-btn, .filter-btn { transition: none; }
        }

        :host {
          display: block;
          position: fixed;
          inset-block-start: var(--update-banner-height, 0px);
          inset-inline-start: 50%;
          transform: translateX(-50%);
          inline-size: 100%;
          max-inline-size: var(--page-max-width);
          z-index: 100;
          background: var(--color-surface);
          padding-block-start: var(--safe-area-top);
          padding-block-end: 0;
          padding-inline: var(--page-padding);
          --image-overlay-edge: rgba(0,0,0,0.65);
          --image-strip-bg:     rgba(255,255,255,0.2);
          --image-strip-fill:   rgba(255,255,255,0.6);
        }

        :host(.compact) {
          padding-block-start: var(--safe-area-top);
        }

        /* ── Header actions ───────────────────────────────────────────── */

        .header-actions {
          display: flex;
          align-items: center;
        }

        .filter-btn {
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
          position: relative;
          touch-action: manipulation;
        }

        .filter-btn svg {
          inline-size: 22px;
          block-size: 22px;
          pointer-events: none;
        }

        .year-btn, .nav-btn, .menu-btn, .filter-btn {
          transition: color 0.3s ease-out;
        }

        .filter-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .filter-btn-dot {
          position: absolute;
          inset-block-start: 8px;
          inset-inline-end: 6px;
          inline-size: 6px;
          block-size: 6px;
          border-radius: var(--radius-full);
          background: var(--color-accent);
        }

        /* ── Image mode ────────────────────────────────────────────────── */

        :host([data-has-image]:not(.compact)) {
          block-size: var(--image-header-height, 200px);
          padding-block-start: 0;
          padding-inline: 0;
        }

        .header-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.35s ease-out;
        }

        :host([data-has-image]:not(.compact)) .header-bg {
          opacity: 1;
        }

        .header-image {
          inline-size: 100%;
          block-size: 100%;
          object-fit: cover;
          object-position: center;
        }

        .image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            var(--image-overlay-edge) 0%,
            transparent               45%,
            transparent               55%,
            var(--image-overlay-edge) 100%
          );
        }

        :host([data-has-image]:not(.compact)) .top-row {
          position: relative;
          z-index: 1;
          padding-inline: var(--page-padding);
        }

        :host([data-has-image]:not(.compact)) .year-btn,
        :host([data-has-image]:not(.compact)) .nav-btn {
          color: white;
        }

        :host([data-has-image]:not(.compact)) .menu-btn,
        :host([data-has-image]:not(.compact)) .filter-btn {
          color: rgba(255,255,255,0.55);
        }

        :host([data-has-image]:not(.compact)) .year-btn:focus-visible,
        :host([data-has-image]:not(.compact)) .nav-btn:focus-visible,
        :host([data-has-image]:not(.compact)) .menu-btn:focus-visible,
        :host([data-has-image]:not(.compact)) .filter-btn:focus-visible {
          outline-color: white;
        }

        :host([data-has-image]:not(.compact)) .strip-bar {
          position: absolute;
          inset-block-end: 0;
          inset-inline: 0;
          background: var(--image-strip-bg);
        }

        :host([data-has-image]:not(.compact)) .strip-fill {
          background: var(--image-strip-fill);
        }

        /* ── Layout ────────────────────────────────────────────────────── */

        .top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-block-size: 64px;
        }

        .year-nav {
          display: flex;
          align-items: center;
          gap: 0;
        }

        .nav-btn {
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
        }

        .nav-btn svg {
          inline-size: 22px;
          block-size: 22px;
          pointer-events: none;
        }

        /* Pull the ‹ icon flush with the screen edge so it aligns
           with the left edge of goal items (page-padding inset). */
        #prev { margin-inline-start: calc(-0.8 * var(--page-padding)); }

        .nav-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        h1 {
          margin: 0;
        }

        .year-btn {
          min-block-size: var(--touch-target);
          min-inline-size: 4ch;
          padding-inline: var(--space-2);
          background: none;
          border: none;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-title);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          line-height: 1;
          text-align: center;
        }

        .year-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .menu-btn {
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

        .strip-bar {
          margin-inline: calc(-1 * var(--page-padding));
          block-size: var(--header-strip-height);
          background: var(--color-surface-raised);
          overflow: hidden;
        }

        .strip-fill {
          block-size: 100%;
          background: var(--color-accent);
        }

        /* ── Menu / sheets ─────────────────────────────────────────────── */

        /* Consistent modal padding across the app: --space-5 on both axes. */
        #menu, #color-sheet, #photo-sheet, #year-picker { --space-6: var(--space-5); }

        .menu-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          inline-size: 100%;
          min-block-size: var(--touch-target-lg);
          background: none;
          border: none;
          border-block-start: 0.5px solid var(--color-border);
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          text-align: start;
        }

        .menu-item.destructive {
          color: var(--color-danger, #d32f2f);
        }

        .menu-section-label {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          margin: 0 0 var(--space-2);
        }

        .menu-item-value {
          font-size: var(--font-size-body);
          color: var(--color-text-muted);
        }

        .menu-section {
          padding-block: var(--space-4);
          border-block-start: 0.5px solid var(--color-border);
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

        .color-dot {
          display: inline-block;
          inline-size: 10px;
          block-size: 10px;
          border-radius: 50%;
          background: var(--color-accent);
          vertical-align: middle;
          margin-inline-end: var(--space-1);
        }

        .color-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: var(--space-3);
          padding-block: var(--space-4);
          border-block-start: 0.5px solid var(--color-border);
        }

        .swatch {
          aspect-ratio: 1;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          min-inline-size: var(--touch-target);
          min-block-size: var(--touch-target);
          box-shadow: 0 0 0 0 transparent;
          transition: box-shadow 0.15s;
        }

        .swatch.active {
          box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-text-primary);
        }

        .swatch:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── Year picker ───────────────────────────────────────────────── */

        .year-picker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
        }

        .year-picker-header .menu-section-label {
          margin: 0;
        }

        /* color is --color-text-primary, not --color-accent — accent is
           icon/fill-only in this app; at caption size, accent-as-text falls
           well short of the 4.5:1 AA minimum against the sheet surface. */
        .year-picker-today-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          padding-inline: var(--space-2);
          background: none;
          border: none;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-primary);
        }

        .year-picker-today-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .year-picker-list {
          /* Establishes this as the offsetParent for its .year-row children —
             without it, row.offsetTop (used to centre the active/today row,
             see _scrollYearPickerRowIntoView) is measured against whatever
             positioned ancestor happens to be further up the tree instead of
             this list's own content box, throwing the centring off by a
             consistent but wrong amount. */
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-2);
          max-block-size: 50vh;
          overflow-y: auto;
          padding-block: var(--space-4);
          border-block-start: 0.5px solid var(--color-border);
        }

        .year-row {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-1);
          min-block-size: var(--touch-target);
          border-radius: var(--radius-sm);
          border: none;
          background: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-subheading);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
        }

        /* Text stays --color-text-primary rather than --color-accent — accent
           is icon/fill-only in this app (insufficient contrast as body text at
           this size); background tint + bold weight + aria-selected carry the
           "selected" signal instead, matching .status-pill.active elsewhere in
           this file. */
        .year-row.active {
          background: var(--color-accent-subtle);
          color: var(--color-text-primary);
          font-weight: var(--font-weight-bold);
        }

        .year-row:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: -2px;
        }

        /* Always rendered, whether or not the year has content —
           visibility:hidden (rather than omitting the element) keeps its box
           in the flex column so the label above never shifts vertically. */
        .year-row-dot {
          inline-size: 6px;
          block-size: 6px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.6;
        }

        .year-row-dot.empty {
          visibility: hidden;
        }

        .year-row.active .year-row-dot {
          opacity: 1;
        }
      </style>

      <div class="header-bg" aria-hidden="true">
        <img class="header-image" id="header-img" alt="" aria-hidden="true" fetchpriority="high">
        <div class="image-overlay"></div>
      </div>

      <div class="top-row">
        <nav class="year-nav" aria-label="${t('home-page.year-progress')}">
          <button id="prev" class="nav-btn" aria-label="${t('home-page.prev-year')}">${icons.chevronLeft}</button>
          <h1><button id="year" class="year-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="${t('year-header.change-year', { year })}">${year}</button></h1>
          <button id="next" class="nav-btn" aria-label="${t('home-page.next-year')}">${icons.chevronRight}</button>
        </nav>
        <div class="header-actions">
          <button id="filter-btn" class="filter-btn" aria-label="${t('home-page.filter-toggle')}" aria-expanded="false">
            ${icons.funnel}
            <span class="filter-btn-dot" hidden aria-hidden="true"></span>
          </button>
          <button id="menu-btn" class="menu-btn" aria-label="${t('year-header.menu')}" aria-expanded="false">${icons.dotsVertical}</button>
        </div>
      </div>

      <div class="strip-bar">
        <div class="strip-fill" id="strip-fill" style="width:${pct}%"></div>
      </div>

      <slot name="filter-bar"></slot>

      <input type="file" id="photo-input" accept="image/*" hidden>

      <modal-dialog id="menu">
        <p class="menu-section-label">${t('year-header.year-section')}</p>
        <div class="menu-section">
          <p class="menu-section-label">${t('settings.tag-strip')}</p>
          <div class="status-pill-group" role="group" aria-label="${t('settings.tag-strip')}">
            <button class="status-pill" id="tags-show-btn">${t('settings.reminder-on')}</button>
            <button class="status-pill" id="tags-hide-btn">${t('settings.reminder-off')}</button>
          </div>
        </div>
        <div class="menu-section">
          <p class="menu-section-label">${t('settings.deadlines')}</p>
          <div class="status-pill-group" role="group" aria-label="${t('settings.deadlines')}">
            <button class="status-pill" id="deadlines-show-btn">${t('settings.reminder-on')}</button>
            <button class="status-pill" id="deadlines-hide-btn">${t('settings.reminder-off')}</button>
          </div>
        </div>
        <button class="menu-item" id="year-photo-btn">
          <span>${t('year-header.photo')}</span>
          <span class="menu-item-value">›</span>
        </button>
        <button class="menu-item" id="year-color-btn">
          <span>${t('year-header.color')}</span>
          <span class="menu-item-value"><span class="color-dot"></span> ›</span>
        </button>
        <button class="menu-item" id="year-reflection-btn">
          <span>${t('year-header.reflection')}</span>
          <span class="menu-item-value" id="reflection-menu-value">${t('year-header.reflection-add')} ›</span>
        </button>
        <button class="menu-item" id="year-export-btn">
          <span>${t('year-header.extract-markdown')}</span>
          <span class="menu-item-value">›</span>
        </button>
        <button class="menu-item" id="year-share-btn">
          <span>${t('year-header.share-year')}</span>
          <span class="menu-item-value">›</span>
        </button>
      </modal-dialog>

      <export-sheet id="export-sheet"></export-sheet>

      <reflection-dialog id="reflection-dialog"></reflection-dialog>

      <modal-dialog id="color-sheet">
        <p class="menu-section-label">${t('year-header.color')}</p>
        <div class="color-grid">
          ${PALETTE.map(({ hex, key }) => `<button class="swatch" data-color="${hex}" style="background:${hex}" aria-label="${t(key)}"></button>`).join('')}
        </div>
        <button class="menu-item" id="color-reset-btn">
          <span>${t('year-header.color-reset')}</span>
        </button>
      </modal-dialog>

      <modal-dialog id="photo-sheet">
        <p class="menu-section-label">${t('year-header.photo')}</p>
        <button class="menu-item" id="photo-add">
          <span>${t('year-header.photo-add')}</span>
        </button>
        <button class="menu-item" id="photo-change" hidden>
          <span>${t('year-header.photo-change')}</span>
        </button>
        <button class="menu-item destructive" id="photo-remove" hidden>
          <span>${t('year-header.photo-remove')}</span>
        </button>
      </modal-dialog>

      <modal-dialog id="year-picker">
        <div class="year-picker-header">
          <p class="menu-section-label">${t('year-header.year-picker-heading')}</p>
          <button type="button" id="year-picker-today-btn" class="year-picker-today-btn">${t('year-header.jump-to-today')}</button>
        </div>
        <div class="year-picker-list" id="year-picker-list" role="listbox" aria-label="${t('year-header.year-picker-heading')}"></div>
      </modal-dialog>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    // Override the Gestures mixin default so horizontal pointer events reach onSwipe.
    // `none` (rather than `pan-y`) also prevents scroll-inertia from starting on
    // diagonal swipes — which would cause the first tap after a year-swipe to be
    // swallowed as an inertia-cancel instead of registering as a click.
    this.style.touchAction = 'none';
  }

  onSwipe(e) {
    const delta = e.direction === 'left' ? 1 : e.direction === 'right' ? -1 : 0;
    if (!delta) return;
    this.dispatchEvent(new CustomEvent('year-navigate', {
      bubbles: true, composed: true, detail: { year: this._year + delta },
    }));
  }

  subscribe() {
    this._yearEl         = this.shadowRoot.querySelector('#year');
    this._stripFill      = this.shadowRoot.querySelector('#strip-fill');
    this._menuDialog     = this.shadowRoot.querySelector('#menu');
    this._yearPickerDialog = this.shadowRoot.querySelector('#year-picker');
    this._yearPickerList   = this.shadowRoot.querySelector('#year-picker-list');
    this._compact    = false;
    this._imageUrl   = null;

    this._onImages = images => {
      this._imagesState = images;
      this._updateImageFor(this._year);
    };
    Store.subscribe('images', this._onImages);

    this._onGoalsTagsVisible = tagsVisible => {
      const visible = tagsVisible?.[String(this._year)] === true;
      document.documentElement.style.setProperty('--tag-strip-display', visible ? 'block' : 'none');
      this.shadowRoot?.querySelector('#tags-show-btn')?.classList.toggle('active', visible);
      this.shadowRoot?.querySelector('#tags-hide-btn')?.classList.toggle('active', !visible);
    };
    Store.subscribe('goalsTagsVisible', this._onGoalsTagsVisible);

    // Deadline markers default ON for the current year, OFF for other years;
    // an explicit per-year choice overrides the default.
    this._onGoalsDeadlinesVisible = deadlinesVisible => {
      const stored = deadlinesVisible?.[String(this._year)];
      const visible = stored ?? (Number(this._year) === new Date().getFullYear());
      document.documentElement.style.setProperty('--goal-deadline-display', visible ? 'block' : 'none');
      this.shadowRoot?.querySelector('#deadlines-show-btn')?.classList.toggle('active', visible);
      this.shadowRoot?.querySelector('#deadlines-hide-btn')?.classList.toggle('active', !visible);
    };
    Store.subscribe('goalsDeadlinesVisible', this._onGoalsDeadlinesVisible);

    this._onReflections = reflections => {
      this._reflectionsState = reflections;
      this._renderReflectionSummary();
    };
    Store.subscribe('reflections', this._onReflections);

    this._updateYear();

    this._scrollCompacting = false;
    this._lastFullHeight = this.offsetHeight;
    document.documentElement.style.setProperty('--year-header-height', `${this.offsetHeight}px`);
    this._ro = new ResizeObserver(() => {
      const h = this.offsetHeight;
      if (this._scrollCompacting) {
        // Going compact via scroll: update height but pad body so the document
        // stays tall enough that scrollY can't drop below backThreshold.
        const D = this._lastFullHeight - h;
        if (D > 0) {
          const docH   = document.documentElement.scrollHeight;
          const winH   = window.innerHeight;
          const minDocH = winH + 20; // backThreshold(10) + buffer(10)
          const newDocH = docH - D;
          if (newDocH < minDocH) {
            document.body.style.paddingBlockEnd = `${minDocH - newDocH + 10}px`;
          }
        }
        document.documentElement.style.setProperty('--year-header-height', `${h}px`);
      } else {
        // forceCompact, un-compact, or other resize — update freely
        this._lastFullHeight = h;
        document.body.style.paddingBlockEnd = '';
        document.documentElement.style.setProperty('--year-header-height', `${h}px`);
      }
    });
    this._ro.observe(this);

    this._setupScroll();
    this._setupScrollToTop();
    this._setupNav();
    this._setupMenu();
    this._setupPhoto();
    this._setupColor();
    this._setupExport();
    this._setupFilterBtn();
    this._setupTags();
    this._setupDeadlines();
    this._setupYearPicker();
    this._setupReflection();
  }

  onTap() {
    const isOpen = el => !!el?.shadowRoot?.querySelector('dialog')?.open;
    if (isOpen(this._menuDialog) || isOpen(this._colorSheet) || isOpen(this._photoSheet) || isOpen(this._exportSheet?._dialog) || isOpen(this._yearPickerDialog) || isOpen(this._reflectionDialog?._dialog)) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  unsubscribe() {
    Store.unsubscribe('images', this._onImages);
    Store.unsubscribe('goalsTagsVisible', this._onGoalsTagsVisible);
    Store.unsubscribe('goalsDeadlinesVisible', this._onGoalsDeadlinesVisible);
    Store.unsubscribe('reflections', this._onReflections);
    this.shadowRoot?.querySelector('#tags-show-btn')?.removeEventListener('click', this._onTagsShowBtn);
    this.shadowRoot?.querySelector('#tags-hide-btn')?.removeEventListener('click', this._onTagsHideBtn);
    this.shadowRoot?.querySelector('#deadlines-show-btn')?.removeEventListener('click', this._onDeadlinesShowBtn);
    this.shadowRoot?.querySelector('#deadlines-hide-btn')?.removeEventListener('click', this._onDeadlinesHideBtn);
    if (this._imageUrl) URL.revokeObjectURL(this._imageUrl);

    ['#prev', '#next', '#menu-btn', '#filter-btn', '#year'].forEach(sel =>
      this.shadowRoot.querySelector(sel)?.removeEventListener('pointerdown', this._stopGesture)
    );
    this.shadowRoot.querySelector('#filter-btn')?.removeEventListener('click', this._onFilterBtnClick);
    this.shadowRoot.querySelector('#prev')?.removeEventListener('click', this._onPrev);
    this.shadowRoot.querySelector('#next')?.removeEventListener('click', this._onNext);
    this.shadowRoot.querySelector('#menu-btn')?.removeEventListener('click', this._onMenuBtn);
    this._menuDialog?.removeEventListener('modal-close', this._onMenuClose);
    this.shadowRoot.querySelector('#year-photo-btn')?.removeEventListener('click', this._onYearPhotoBtn);
    this.shadowRoot.querySelector('#year-color-btn')?.removeEventListener('click', this._onYearColorBtn);
    this._colorSheet?.removeEventListener('click', this._onColorSheetClick);
    this.shadowRoot.querySelector('#color-reset-btn')?.removeEventListener('click', this._onColorReset);
    this.shadowRoot.querySelector('#photo-add')?.removeEventListener('click', this._onPhotoAdd);
    this.shadowRoot.querySelector('#photo-change')?.removeEventListener('click', this._onPhotoChange);
    this.shadowRoot.querySelector('#photo-remove')?.removeEventListener('click', this._onPhotoRemove);
    this.shadowRoot.querySelector('#photo-input')?.removeEventListener('change', this._onPhotoInput);
    this.shadowRoot.querySelector('#year-export-btn')?.removeEventListener('click', this._onYearExportBtn);
    this.shadowRoot.querySelector('#export-sheet')?.removeEventListener('extract-confirm', this._onExportConfirm);
    this.shadowRoot.querySelector('#year-share-btn')?.removeEventListener('click', this._onYearShareBtn);
    this.shadowRoot.querySelector('#year-reflection-btn')?.removeEventListener('click', this._onReflectionMenuBtn);
    this._reflectionDialog?.removeEventListener('reflection-score-changed', this._onReflectionScoreChanged);
    this._reflectionDialog?.removeEventListener('reflection-comment-changed', this._onReflectionCommentChanged);
    this._reflectionDialog?.removeEventListener('reflection-visibility-changed', this._onReflectionVisibilityChanged);
    this._reflectionDialog?.removeEventListener('modal-close', this._onReflectionClose);
    this.shadowRoot.querySelector('#year')?.removeEventListener('click', this._onYearBtn);
    this._yearPickerDialog?.removeEventListener('modal-close', this._onYearPickerClose);
    this._yearPickerList?.removeEventListener('click', this._onYearPickerClick);
    this.shadowRoot.querySelector('#year-picker-today-btn')?.removeEventListener('click', this._onYearPickerTodayBtn);
    this._ro?.disconnect();
    document.documentElement.style.removeProperty('--year-header-height');
    document.documentElement.style.overflowAnchor = '';
    document.body.style.paddingBlockEnd = '';
    document.body.style.overscrollBehaviorY = '';
    window.removeEventListener('scroll',      this._onScroll);
    window.removeEventListener('touchstart',  this._onTouchStart);
    window.removeEventListener('touchend',    this._onTouchEnd);
    window.removeEventListener('touchcancel', this._onTouchEnd);
    window.removeEventListener('touchmove',   this._onTouchMove);
  }

  _setupScrollToTop() {
    // Prevent pointerdown on interactive elements from reaching the Gestures mixin — they are not scroll-to-top targets
    this._stopGesture = e => e.stopPropagation();
    ['#prev', '#next', '#menu-btn', '#filter-btn', '#year'].forEach(sel =>
      this.shadowRoot.querySelector(sel)?.addEventListener('pointerdown', this._stopGesture)
    );
  }

  _setupScroll() {
    this._compactTime = 0;
    this._touch = false;
    this._touchStartY = 0;
    this._lastScrollY = 0;

    this._onTouchStart = (e) => {
      this._touch = true;
      this._touchStartY = e.changedTouches[0].clientY;
    };
    this._onTouchEnd = () => { this._touch = false; };

    // When compact and scrollY≈0, scroll events don't fire (y can't go below 0).
    // Detect the unfold swipe from touch displacement instead.
    this._onTouchMove = (e) => {
      if (!this._compact || this._forceCompact || window.scrollY > 1) return;
      const elapsed = Date.now() - this._compactTime;
      if (elapsed < 300) return;
      const dy = e.changedTouches[0].clientY - this._touchStartY;
      if (dy > 8) {
        document.body.style.overscrollBehaviorY = '';
        document.documentElement.style.overflowAnchor = '';
        document.body.style.paddingBlockEnd = '';
        this._compact = false;
        this._scrollCompacting = false;
        if (!this._forceCompact) this.classList.remove('compact');
      }
    };

    window.addEventListener('touchstart',  this._onTouchStart,  { passive: true });
    window.addEventListener('touchend',    this._onTouchEnd,    { passive: true });
    window.addEventListener('touchcancel', this._onTouchEnd,    { passive: true });
    window.addEventListener('touchmove',   this._onTouchMove,   { passive: true });

    this._onScroll = () => {
      const y = window.scrollY;

      // Track direction so scrolling *down* from y=0 while compact doesn't
      // trigger the back-threshold check (which would falsely UN-COMPACT).
      const scrollingUp = y < this._lastScrollY;
      this._lastScrollY = y;

      const hasImage = this.hasAttribute('data-has-image');
      const goThreshold   = hasImage ? 40 : 80;
      const backThreshold = hasImage ? 10 : 60;

      if (!this._compact && y > goThreshold) {
        this._compact = true;
        this._scrollCompacting = true;
        this._compactTime = Date.now();
        document.documentElement.style.overflowAnchor = 'none';
        document.body.style.overscrollBehaviorY = 'none';
        this.classList.add('compact');

      } else if (this._compact && y < backThreshold && scrollingUp) {
        const elapsed = Date.now() - this._compactTime;
        if (elapsed < 300) return;
        document.body.style.overscrollBehaviorY = '';
        this._compact = false;
        this._scrollCompacting = false;
        document.documentElement.style.overflowAnchor = '';
        document.body.style.paddingBlockEnd = '';
        if (!this._forceCompact) this.classList.remove('compact');
      }
    };
    window.addEventListener('scroll', this._onScroll, { passive: true });
  }

  _setupNav() {
    this._onPrev = () => this.dispatchEvent(new CustomEvent('year-navigate', {
      bubbles: true, composed: true, detail: { year: this._year - 1 },
    }));
    this._onNext = () => this.dispatchEvent(new CustomEvent('year-navigate', {
      bubbles: true, composed: true, detail: { year: this._year + 1 },
    }));
    this.shadowRoot.querySelector('#prev').addEventListener('click', this._onPrev);
    this.shadowRoot.querySelector('#next').addEventListener('click', this._onNext);
  }

  _setupMenu() {
    const menuBtn = this.shadowRoot.querySelector('#menu-btn');
    this._onMenuBtn = () => {
      this._menuDialog.show();
      menuBtn.setAttribute('aria-expanded', 'true');
    };
    menuBtn.addEventListener('click', this._onMenuBtn);

    this._onMenuClose = () => menuBtn.setAttribute('aria-expanded', 'false');
    this._menuDialog.addEventListener('modal-close', this._onMenuClose);
  }

  _setupPhoto() {
    this._photoSheet = this.shadowRoot.querySelector('#photo-sheet');
    const photoInput = this.shadowRoot.querySelector('#photo-input');

    this._onYearPhotoBtn = () => {
      this._menuDialog.close();
      this._updatePhotoMenu(!!this._imagesState?.[this._year]);
      this._photoSheet.show();
    };
    this.shadowRoot.querySelector('#year-photo-btn').addEventListener('click', this._onYearPhotoBtn);

    const openPhotoPicker = () => {
      this._photoSheet.close();
      photoInput.click();
    };
    this._onPhotoAdd    = openPhotoPicker;
    this._onPhotoChange = openPhotoPicker;
    this.shadowRoot.querySelector('#photo-add').addEventListener('click', this._onPhotoAdd);
    this.shadowRoot.querySelector('#photo-change').addEventListener('click', this._onPhotoChange);

    this._onPhotoRemove = async () => {
      this._photoSheet.close();
      const year    = String(this._year);
      const imageId = Store.getState().images?.[year];
      const images  = { ...Store.getState().images };
      delete images[year];
      Store.setState('images', images);
      try {
        if (imageId) await Store.deleteBlob(imageId);
      } catch (err) {
        console.error('Failed to delete photo blob:', err);
      }
    };
    this.shadowRoot.querySelector('#photo-remove').addEventListener('click', this._onPhotoRemove);

    this._onPhotoInput = async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const year       = String(this._year);
        const oldImageId = Store.getState().images?.[year];
        const imageId    = crypto.randomUUID();
        const blob       = await compressImage(file, { maxWidth: 1200, quality: 0.8 });
        await Store.attachBlob(imageId, blob);
        Store.setState('images', { ...Store.getState().images, [year]: imageId });
        if (oldImageId) await Store.deleteBlob(oldImageId);
      } catch (err) {
        console.error('Failed to upload photo:', err);
      } finally {
        e.target.value = '';
      }
    };
    photoInput.addEventListener('change', this._onPhotoInput);
  }

  _setupColor() {
    this._colorSheet = this.shadowRoot.querySelector('#color-sheet');

    this._onYearColorBtn = () => {
      this._menuDialog.close();
      this._updateSwatches(Store.getState().accentColors?.[String(this._year)] ?? null);
      this._colorSheet.show();
    };
    this.shadowRoot.querySelector('#year-color-btn').addEventListener('click', this._onYearColorBtn);

    this._onColorSheetClick = e => {
      const swatch = e.target.closest('.swatch');
      if (!swatch) return;
      const hex = swatch.dataset.color;
      Store.setState('accentColors', { ...Store.getState().accentColors, [String(this._year)]: hex });
      this._updateSwatches(hex);
      this._colorSheet.close();
    };
    this._colorSheet.addEventListener('click', this._onColorSheetClick);

    this._onColorReset = () => {
      const colors = { ...Store.getState().accentColors };
      delete colors[String(this._year)];
      Store.setState('accentColors', colors);
      this._updateSwatches(null);
      this._colorSheet.close();
    };
    this.shadowRoot.querySelector('#color-reset-btn').addEventListener('click', this._onColorReset);
  }

  _updateSwatches(currentHex) {
    this._colorSheet?.querySelectorAll('.swatch').forEach(btn => {
      const active = btn.dataset.color === currentHex;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  _setupExport() {
    this._exportSheet = this.shadowRoot.querySelector('#export-sheet');

    this._onYearExportBtn = () => {
      this._menuDialog.close();
      this._exportSheet.show({ showReflection: true });
    };
    this.shadowRoot.querySelector('#year-export-btn').addEventListener('click', this._onYearExportBtn);

    this._onExportConfirm = e => {
      this.dispatchEvent(new CustomEvent('year-export-confirm', {
        bubbles: true, composed: true, detail: e.detail,
      }));
    };
    this._exportSheet.addEventListener('extract-confirm', this._onExportConfirm);

    this._onYearShareBtn = () => {
      this._menuDialog.close();
      this.dispatchEvent(new CustomEvent('year-share-request', { bubbles: true, composed: true }));
    };
    this.shadowRoot.querySelector('#year-share-btn').addEventListener('click', this._onYearShareBtn);
  }

  _setupTags() {
    this._onTagsShowBtn = () => {
      const year = String(this._year);
      Store.setState('goalsTagsVisible', { ...Store.getState().goalsTagsVisible, [year]: true });
      this._menuDialog.close();
    };
    this._onTagsHideBtn = () => {
      const year = String(this._year);
      Store.setState('goalsTagsVisible', { ...Store.getState().goalsTagsVisible, [year]: false });
      this._menuDialog.close();
    };
    this.shadowRoot.querySelector('#tags-show-btn').addEventListener('click', this._onTagsShowBtn);
    this.shadowRoot.querySelector('#tags-hide-btn').addEventListener('click', this._onTagsHideBtn);
  }

  _setupDeadlines() {
    this._onDeadlinesShowBtn = () => {
      const year = String(this._year);
      Store.setState('goalsDeadlinesVisible', { ...Store.getState().goalsDeadlinesVisible, [year]: true });
      this._menuDialog.close();
    };
    this._onDeadlinesHideBtn = () => {
      const year = String(this._year);
      Store.setState('goalsDeadlinesVisible', { ...Store.getState().goalsDeadlinesVisible, [year]: false });
      this._menuDialog.close();
    };
    this.shadowRoot.querySelector('#deadlines-show-btn').addEventListener('click', this._onDeadlinesShowBtn);
    this.shadowRoot.querySelector('#deadlines-hide-btn').addEventListener('click', this._onDeadlinesHideBtn);
  }

  _setupYearPicker() {
    const yearBtn = this.shadowRoot.querySelector('#year');
    this._onYearBtn = () => {
      this._renderYearPicker();
      this._yearPickerDialog.show();
      this._scrollYearPickerToActive();
      yearBtn.setAttribute('aria-expanded', 'true');
    };
    yearBtn.addEventListener('click', this._onYearBtn);

    this._onYearPickerClose = () => yearBtn.setAttribute('aria-expanded', 'false');
    this._yearPickerDialog.addEventListener('modal-close', this._onYearPickerClose);

    this._onYearPickerClick = e => {
      const row = e.target.closest('.year-row');
      if (!row) return;
      const year = Number(row.dataset.year);
      this._yearPickerDialog.close();
      if (year === this._year) return;
      this.dispatchEvent(new CustomEvent('year-navigate', {
        bubbles: true, composed: true, detail: { year },
      }));
    };
    this._yearPickerList.addEventListener('click', this._onYearPickerClick);

    // Re-centres the (already open) list on today's real calendar year, distinct
    // from this._year — a scroll shortcut, not a navigation, so browsing stays
    // uninterrupted; tap a row same as ever to actually jump there.
    this._onYearPickerTodayBtn = () => {
      const today = new Date().getFullYear();
      const row = this._yearPickerList.querySelector(`.year-row[data-year="${today}"]`);
      this._scrollYearPickerRowIntoView(row);
    };
    this.shadowRoot.querySelector('#year-picker-today-btn').addEventListener('click', this._onYearPickerTodayBtn);
  }

  // Covers the router's entire valid year range (see MIN_YEAR/MAX_YEAR) — the
  // picker is a scrollable list, not a capped window, so any year is reachable
  // by scrolling regardless of content. It opens scrolled to the currently
  // displayed year (this._year, not today's real date — prev/next already
  // treat it that way, and it guarantees the row you're on is where you land).
  _renderYearPicker() {
    const { goals, images, accentColors } = Store.getState();
    const contentYears = yearsWithContent(goals, images);

    this._yearPickerList.replaceChildren();
    this._activeYearRow = null;
    for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'year-row';
      row.setAttribute('role', 'option');
      row.dataset.year = String(y);
      const active = y === this._year;
      row.classList.toggle('active', active);
      row.setAttribute('aria-selected', String(active));

      const label = document.createElement('span');
      label.className = 'year-row-label';
      label.textContent = String(y);
      row.appendChild(label);

      // The dot always occupies its grid column (see .year-row-dot.empty) so the
      // label above stays centred whether or not this row has one.
      const hasContent = contentYears.has(y);
      const dot = document.createElement('span');
      dot.className = `year-row-dot${hasContent ? '' : ' empty'}`;
      dot.setAttribute('aria-hidden', 'true');
      const yearColor = accentColors?.[String(y)];
      if (hasContent && yearColor) dot.style.background = yearColor;
      row.appendChild(dot);

      if (active) this._activeYearRow = row;
      this._yearPickerList.appendChild(row);
    }
  }

  // Sets scrollTop on #year-picker-list directly instead of row.scrollIntoView() —
  // see the scroll note on goal-dialog's _scrollWithinModalBody for why: scrollIntoView
  // walks every scrollable ancestor, including modal-dialog's own <dialog> (overflow:
  // hidden, never user-scrollable but still a valid scroll container), silently
  // accumulating drift there. Only meaningful here because #year-picker-list is itself
  // the bounded scroll region — modal-dialog's .body never needs to scroll.
  _scrollYearPickerToActive() {
    this._scrollYearPickerRowIntoView(this._activeYearRow);
  }

  _scrollYearPickerRowIntoView(row) {
    const list = this._yearPickerList;
    if (!row || !list) return;
    list.scrollTop = Math.max(0, row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2);
  }

  // One report per year — reopening (from either entry point) edits the
  // existing one, no separate create/edit branching. Individual field edits
  // inside the dialog commit to the store immediately (see
  // reflection-score-changed/reflection-comment-changed below); the snapshot
  // taken here only powers a single session-undo toast on close, mirroring
  // goal-dialog's blur-save + home.toast-goal-saved flow.
  _setupReflection() {
    this._reflectionDialog     = this.shadowRoot.querySelector('#reflection-dialog');
    this._reflectionMenuValue  = this.shadowRoot.querySelector('#reflection-menu-value');

    this._onReflectionMenuBtn = () => {
      this._menuDialog.close();
      this.openReflection();
    };
    this.shadowRoot.querySelector('#year-reflection-btn').addEventListener('click', this._onReflectionMenuBtn);

    this._onReflectionScoreChanged = e => {
      const { key, value } = e.detail;
      this._commitReflection(r => ({ ...r, scores: { ...r?.scores, [key]: value } }));
    };
    this._reflectionDialog.addEventListener('reflection-score-changed', this._onReflectionScoreChanged);

    this._onReflectionCommentChanged = e => {
      this._commitReflection(r => ({ ...r, comment: e.detail.comment }));
    };
    this._reflectionDialog.addEventListener('reflection-comment-changed', this._onReflectionCommentChanged);

    // showCard omitted entirely when true (visible is the default) — only an
    // explicit false is ever stored, mirroring the Goal.color "omit rather
    // than store the default" convention (just inverted: absent means shown).
    this._onReflectionVisibilityChanged = e => {
      this._commitReflection(r => {
        if (e.detail.visible) { const { showCard: _drop, ...rest } = r; return rest; }
        return { ...r, showCard: false };
      });
    };
    this._reflectionDialog.addEventListener('reflection-visibility-changed', this._onReflectionVisibilityChanged);

    this._onReflectionClose = () => {
      const year   = String(this._year);
      const before = this._reflectionSnapshot;
      const after  = Store.getState().reflections?.[year] ?? null;
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      toast(t('year-header.reflection-saved'), 'success', {
        action: {
          label: t('undo.button'),
          onClick: () => {
            const reflections = { ...Store.getState().reflections };
            if (before) reflections[year] = before; else delete reflections[year];
            Store.setState('reflections', reflections);
          },
        },
      });
    };
    this._reflectionDialog.addEventListener('modal-close', this._onReflectionClose);
  }

  // Public: the on-page summary element (home-page.js, rendered as a normal
  // scrollable-area element above Capstone — not owned by this component)
  // calls this to open the same dialog the "⋮" menu entry does.
  openReflection() {
    this._reflectionSnapshot = Store.getState().reflections?.[String(this._year)] ?? null;
    this._reflectionDialog.open(this._reflectionSnapshot);
  }

  _commitReflection(update) {
    const year        = String(this._year);
    const reflections = Store.getState().reflections ?? {};
    Store.setState('reflections', { ...reflections, [year]: update(reflections[year] ?? {}) });
  }

  // Queries the shadow root fresh rather than caching an element ref (matching
  // _onGoalsTagsVisible/_onGoalsDeadlinesVisible above) — _updateYear() calls
  // this before _setupReflection() has run on first connect, so a cached ref
  // would still be undefined the first time. The on-page summary itself lives
  // in home-page.js now (a normal scrollable-area element above Capstone,
  // not part of this fixed header) — this only drives the menu's own
  // trailing value.
  _renderReflectionSummary() {
    const reflection = this._reflectionsState?.[String(this._year)];
    const score       = aggregateScore(reflection);
    const scoreLabel  = score != null ? t('year-header.reflection-score', { score: score.toFixed(1) }) : null;

    const menuValue = this.shadowRoot?.querySelector('#reflection-menu-value');
    if (menuValue) menuValue.textContent = `${scoreLabel ?? t('year-header.reflection-add')} ›`;
  }

  _setupFilterBtn() {
    const btn = this.shadowRoot.querySelector('#filter-btn');
    this._onFilterBtnClick = () => {
      this.dispatchEvent(new CustomEvent('filter-click', { bubbles: true, composed: true }));
    };
    btn.addEventListener('click', this._onFilterBtnClick);
  }

  set filterDot(v) {
    const dot = this.shadowRoot?.querySelector('.filter-btn-dot');
    if (dot) dot.hidden = !v;
  }

  set filterExpanded(v) {
    const btn = this.shadowRoot?.querySelector('#filter-btn');
    if (btn) btn.setAttribute('aria-expanded', String(!!v));
  }

  set forceCompact(v) {
    this._forceCompact = v;
    if (v) {
      this.classList.add('compact');
    } else if (!this._compact) {
      this.classList.remove('compact');
    }
  }

  _updateYear() {
    const year = this._year ?? new Date().getFullYear();
    if (this._yearEl) {
      this._yearEl.textContent = String(year);
      this._yearEl.setAttribute('aria-label', t('year-header.change-year', { year }));
    }
    const pct = yearProgress(year);
    if (this._stripFill) this._stripFill.style.width = `${pct}%`;
    this._updateImageFor(year);
    if (this._onGoalsTagsVisible) this._onGoalsTagsVisible(Store.getState().goalsTagsVisible);
    if (this._onGoalsDeadlinesVisible) this._onGoalsDeadlinesVisible(Store.getState().goalsDeadlinesVisible);
    if (this._onReflections) this._onReflections(Store.getState().reflections);
  }

  async _updateImageFor(year) {
    const imageId = this._imagesState?.[year];
    if (!imageId) {
      this._clearImage();
      return;
    }
    this.setAttribute('data-has-image', '');
    const blob = await Store.getBlob(imageId);
    // Guard: year may have changed while the blob fetch was in-flight
    if (this._year !== year) return;
    if (!blob) {
      this._clearImage();
      return;
    }
    if (this._imageUrl) URL.revokeObjectURL(this._imageUrl);
    this._imageUrl = URL.createObjectURL(blob);
    this.shadowRoot.querySelector('#header-img').src = this._imageUrl;
    this._updatePhotoMenu(true);
  }

  _clearImage() {
    if (this._imageUrl) {
      URL.revokeObjectURL(this._imageUrl);
      this._imageUrl = null;
    }
    const img = this.shadowRoot?.querySelector('#header-img');
    // removeAttribute, not img.src = '' — an empty string resolves to the
    // current page's own URL as the image source, so the browser briefly
    // tries (and fails) to decode the HTML document as an image, flashing
    // the broken-image icon. Removing the attribute triggers no request.
    if (img) img.removeAttribute('src');
    this.removeAttribute('data-has-image');
    this._updatePhotoMenu(false);
  }

  _updatePhotoMenu(hasImage) {
    const addBtn    = this.shadowRoot?.querySelector('#photo-add');
    const changeBtn = this.shadowRoot?.querySelector('#photo-change');
    const removeBtn = this.shadowRoot?.querySelector('#photo-remove');
    if (addBtn)    addBtn.hidden    = hasImage;
    if (changeBtn) changeBtn.hidden = !hasImage;
    if (removeBtn) removeBtn.hidden = !hasImage;
  }
}

// MIN_YEAR mirrors the router's year-param floor (home-page.js) — the picker must
// never offer a year below that, which would redirect to not-found. MAX_YEAR is
// well inside the router's own ceiling (2500) — kept lower here just to keep the
// picker's scrollable list to a reasonable size; nothing stops it moving if the
// router's ceiling ever does.
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function yearsWithContent(goals, images) {
  const years = new Set();
  for (const [y, yg] of Object.entries(goals ?? {})) {
    const hasGoals = ['capstone', 'milestones', 'wow', 'focus'].some(s => (yg?.[s]?.length ?? 0) > 0);
    if (hasGoals) years.add(Number(y));
  }
  for (const y of Object.keys(images ?? {})) years.add(Number(y));
  return years;
}

function yearProgress(year) {
  const now     = new Date();
  const current = now.getFullYear();
  if (year < current) return 100;
  if (year > current) return 0;
  const start = new Date(year, 0, 1).getTime();
  const end   = new Date(year + 1, 0, 1).getTime();
  return Math.round((now.getTime() - start) / (end - start) * 100);
}

customElements.define('year-header', YearHeader);
