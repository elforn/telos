import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';
import { icons } from '../../icons.js';
import { urgencyOf, mostUrgent, urgentCount, formatCount } from '../../utils/urgency.js';
import { COLOR_PALETTE } from '../../utils/color-palette.js';
import { rowChromeStyles, dragHandleStyles, colorPanelStyles } from '../../utils/row-chrome.js';
import { COLOR_WIDTH, swipeOffset, swipeCommitted, trackSwipe, closeReveal } from '../../utils/row-swipe.js';

class ListsPageItem extends Gestures(AppElement) {
  set list(value) {
    this._list = value;
    if (this.shadowRoot) this._update();
  }

  // Global (page-level) show/hide for the roll-up urgency dot — property-in,
  // no store knowledge (this is a UI-tier component; the page reads the toggle).
  set rollupVisible(value) {
    this._rollupVisible = value;
    if (this.shadowRoot) this._update();
  }

  template() {
    return `
      <style>
        :host {
          display: block;
          position: relative;
        }

        /* ── Left panel — revealed by swiping right ───────────────────────── */

        ${colorPanelStyles('.color-panel', COLOR_WIDTH)}

        /* ── Row ──────────────────────────────────────────────────────────── */

        ${rowChromeStyles('.row')}

        .row {
          block-size: var(--row-height);
          padding-block: 10px;
          gap: var(--row-gap);
        }

        .list-name {
          flex: 1;
          min-inline-size: 0;
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          line-height: 1;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .archive-dot {
          display: none;
          position: absolute;
          inset-block-start: 50%;
          transform: translateY(-50%);
          /* 7px measured from the row's outer edge, landing it just past
             the accent stripe and on top of the drag-icon (z-index above) —
             see the fix history below for how this number was derived. */
          inset-inline-start: calc(7px - var(--row-accent-width));
          inline-size: var(--space-1);
          block-size: var(--space-1);
          border-radius: var(--radius-full);
          background: var(--color-accent);
          z-index: 2;
          opacity: 0.2;
          pointer-events: none;
          user-select: none;
        }

        :host([data-archived="true"]) .archive-dot {
          display: block;
        }

        .item-count {
          flex-shrink: 0;
          font-size: var(--font-size-caption);
          line-height: 1;
          color: var(--color-text-muted);
          margin-inline-end: 2px;
          transform: translateY(1px);
        }

        /* Most-urgent roll-up: a colour dot for the soonest open/paused item.
           Only shown for green/yellow/red (far-future and empty are quiet).
           When red, it grows into a numbered badge counting today+overdue. */
        .urgency {
          flex-shrink: 0;
          inline-size: 8px;
          block-size: 8px;
          border-radius: var(--radius-full);
        }
        .urgency[hidden] { display: none; }
        .urgency[data-urgency="month"]    { background: var(--color-success); }
        .urgency[data-urgency="week"]     { background: var(--color-warning); }
        .urgency[data-urgency="tomorrow"] { background: var(--color-tomorrow); }
        .urgency[data-urgency="today"],
        .urgency[data-urgency="overdue"] { background: var(--color-danger); }
        .urgency[data-count] {
          box-sizing: border-box;
          inline-size: auto;
          min-inline-size: 16px;
          block-size: 16px;
          /* border-box + top-heavy padding pushes the digit down to optical
             centre (this font's numerals otherwise sit high in the circle). */
          padding-block: 2px 0;
          padding-inline: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          color: var(--color-text-inverse);
          font-size: var(--font-size-micro);
          font-weight: var(--font-weight-semibold);
        }

        ${dragHandleStyles('.drag-btn')}

        /* Local extra — see dragHandleStyles' own note on why the shared
           helper deliberately leaves this out. */
        .drag-btn svg { pointer-events: none; }

        .chevron {
          flex-shrink: 0;
          color: var(--color-text-muted);
          opacity: 0.45;
          margin-inline-start: var(--space-1);
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        .chevron svg {
          inline-size: var(--icon-size-sm);
          block-size: var(--icon-size-sm);
        }

        /* ── Failed trickle-up — full-row red when any item in this list has
           lapsed ──────────────────────────────────────────────────────────
           data-failed is its own boolean attribute (bucket === 'overdue'),
           set in _update() below alongside — not instead of — data-urgency,
           which still carries the raw bucket for the roll-up dot's own
           colour. Two attributes, two purposes, even though both currently
           derive from the same underlying mostUrgent() call (lists have no
           frequency/tracking of their own to diverge from). The existing
           dot/count badge stays as its own element on top; only its own
           colours invert here so it still reads against the now-solid-red
           row instead of blending into it, mirroring how goal-item/
           list-item's calendar badge already works. */
        :host([data-failed]) .row { background: var(--color-danger); }
        :host([data-failed]) .list-name { color: var(--color-text-inverse); }
        :host([data-failed]) .item-count { color: color-mix(in srgb, var(--color-text-inverse) 70%, transparent); }
        :host([data-failed]) .chevron { color: var(--color-text-inverse); opacity: 0.7; }
        :host([data-failed]) .drag-btn { color: var(--color-text-inverse); }
        :host([data-failed]) .urgency[data-urgency="overdue"] {
          background: var(--color-text-inverse);
          color: var(--color-danger);
        }
      </style>

      <div class="color-panel" id="color-panel" aria-hidden="true"></div>
      <div class="row" tabindex="0" role="button" aria-label="">
        <span class="archive-dot" aria-hidden="true"></span>
        <button class="drag-btn" id="drag-btn" type="button" aria-label=""></button>
        <span class="list-name"></span>
        <span class="urgency" aria-hidden="true" hidden></span>
        <span class="item-count"></span>
        <span class="chevron" aria-hidden="true">${icons.chevronRight}</span>
      </div>
    `;
  }

  subscribe() {
    this.setAttribute('role', 'listitem');
    this._row        = this.shadowRoot.querySelector('.row');
    this._nameEl     = this.shadowRoot.querySelector('.list-name');
    this._countEl    = this.shadowRoot.querySelector('.item-count');
    this._urgencyEl  = this.shadowRoot.querySelector('.urgency');
    this._colorPanel = this.shadowRoot.querySelector('#color-panel');

    this._update();

    // ── Keyboard ─────────────────────────────────────────────────────────────
    this._onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onTap(); }
    };
    this._row.addEventListener('keydown', this._onKeyDown);

    // ── Drag handle ──────────────────────────────────────────────────────────
    this._dragBtn = this.shadowRoot.querySelector('#drag-btn');
    this._dragBtn.setAttribute('aria-label', t('lists-page.drag'));
    this._dragBtn.innerHTML = icons.grip;
    this._onDragBtnDown = e => {
      e.stopPropagation();
      this._dragBtn.setPointerCapture(e.pointerId);
      this.dispatchEvent(new CustomEvent('list-drag-start', {
        bubbles: true, composed: true,
        detail: { list: this._list, element: this, startX: e.clientX, startY: e.clientY },
      }));
    };
    this._onDragBtnKey = e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('list-reorder-key', {
        bubbles: true, composed: true,
        detail: { list: this._list, direction: e.key === 'ArrowUp' ? -1 : 1 },
      }));
    };
    this._dragBtn.addEventListener('pointerdown', this._onDragBtnDown);
    this._dragBtn.addEventListener('keydown',     this._onDragBtnKey);
  }

  unsubscribe() {
    this._row?.removeEventListener('keydown',         this._onKeyDown);
    this._dragBtn?.removeEventListener('pointerdown', this._onDragBtnDown);
    this._dragBtn?.removeEventListener('keydown',     this._onDragBtnKey);
  }

  // ── Gestures ──────────────────────────────────────────────────────────────

  onTap() {
    this.dispatchEvent(new CustomEvent('list-tap', {
      bubbles: true, composed: true, detail: { list: this._list },
    }));
  }

  _gestureCancel(e) {
    if (this._gesture?.phase === 'swipe') this._closeReveal();
    super._gestureCancel(e);
  }

  // No delete panel on this row, so deleteWidth stays 0 — a left swipe
  // clamps to a zero offset and the row simply doesn't move.
  onSwipeMove(e) {
    trackSwipe(this._row, swipeOffset(e, { colorWidth: COLOR_WIDTH }));
  }

  onSwipe(e) {
    if (e.direction === 'right') {
      if (swipeCommitted(e, COLOR_WIDTH)) {
        this.dispatchEvent(new CustomEvent('list-color-cycle', {
          bubbles: true, composed: true, detail: { list: this._list },
        }));
      }
    }
    this._closeReveal();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _closeReveal() {
    closeReveal(this._row);
  }

  _update() {
    if (!this._row) return;
    const name  = this._list?.name  ?? '';
    const items = this._list?.items ?? [];
    const count = items.length;
    const color = this._list?.color ?? null;
    this._nameEl.textContent  = name;
    this._countEl.textContent = String(count);
    this._row.style.setProperty('--row-accent-color', color ?? 'transparent');
    this.dataset.archived = String(!!this._list?.archived);

    // Roll-up urgency across open/paused items; quiet for far-future/empty.
    // Suppressed entirely when the page-level toggle is off (default on).
    const buckets = this._rollupVisible === false
      ? []
      : items.map(i => urgencyOf(i.dueDate, i.status !== 'done' && i.status !== 'closed'));
    const bucket = mostUrgent(buckets);
    const urgent = urgentCount(buckets);
    const show = bucket !== 'none' && bucket !== 'far';
    // data-urgency (icon/roll-up dot colour) and data-failed (full-row-red)
    // are both derived from the same `bucket` here — lists have no
    // frequency/tracking of their own to diverge from, unlike goal-item.js —
    // but each is still its own attribute/mechanism, not one value read
    // twice under different names.
    this.dataset.urgency = bucket;
    this.toggleAttribute('data-failed', bucket === 'overdue');
    this._urgencyEl.hidden = !show;
    let ariaLabel = name;
    if (show) {
      this._urgencyEl.dataset.urgency = bucket;
      if (urgent > 0) {
        this._urgencyEl.dataset.count = String(urgent);
        this._urgencyEl.textContent = formatCount(urgent);
        ariaLabel = `${name}, ${t('urgency.urgent-count', { n: urgent })}`;
      } else {
        delete this._urgencyEl.dataset.count;
        this._urgencyEl.textContent = '';
        ariaLabel = `${name}, ${t(`urgency.${bucket}`)}`;
      }
    }
    this.setAttribute('aria-label', ariaLabel);
    this._row.setAttribute('aria-label', ariaLabel);
    if (color) {
      this._colorPanel.style.setProperty('--color-panel-bg', color);
    } else {
      this._colorPanel.style.removeProperty('--color-panel-bg');
    }
  }
}

customElements.define('lists-page-item', ListsPageItem);
