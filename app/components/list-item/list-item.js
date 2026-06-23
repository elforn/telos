import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';
import { icons } from '../../icons.js';

const DONE_WIDTH      = 48;   // square-ish done button
const DELETE_WIDTH    = 60;   // icon-only delete button
const COMMIT_RATIO    = 2.0;  // fraction of reveal width needed to commit
const COMMIT_VELOCITY = 0.35; // px/ms — fast flick commits regardless
const SWIPE_DEAD_ZONE = 15;   // px of drag before row starts moving

class ListItem extends Gestures(AppElement) {
  set item(value) {
    this._item = value;
    if (this.shadowRoot) this._update();
  }

  set selectionMode(val) {
    this._selectionMode = !!val;
    if (!val && this._revealedDir === null) {
      this._row?.style.removeProperty('pointer-events');
    }
  }
  get selectionMode() { return this._selectionMode ?? false; }

  set selected(val) {
    this._selected = !!val;
    this.classList.toggle('selected', this._selected);
    this.setAttribute('aria-selected', String(this._selected));
  }
  get selected() { return this._selected ?? false; }

  template() {
    return `
      <style>
        :host {
          display: block;
          position: relative;
          overflow: hidden;
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-card);
        }

        .action-btn {
          position: absolute;
          inset-block: 0;
          color: var(--color-text-inverse);
          border: none;
          cursor: pointer;
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          font-family: var(--font-family);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* done — left side, revealed by swiping row right */
        .done-btn {
          inset-inline-start: 0;
          inline-size: ${DONE_WIDTH}px;
          background: var(--color-success);
        }

        .done-btn.is-restore {
          background: var(--color-app-accent);
        }

        /* delete — right side, revealed by swiping row left */
        .delete-btn {
          inset-inline-end: 0;
          inline-size: ${DELETE_WIDTH}px;
          background: var(--color-danger);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
        }

        .action-btn svg {
          pointer-events: none;
        }

        .row {
          position: relative;
          z-index: 1;
          min-block-size: var(--goal-item-height, 44px);
          background: var(--color-surface);
          border: 0.5px solid var(--color-border);
          display: flex;
          align-items: center;
          padding-inline: var(--space-3);
          gap: 6px;
          cursor: pointer;
          user-select: none;
          touch-action: pan-y;
          transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
          will-change: transform;
        }

        .drag-btn {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          background: none;
          border: none;
          cursor: grab;
          color: var(--color-text-muted);
          font-size: var(--font-size-body);
          display: flex;
          align-items: center;
          justify-content: center;
          padding-block: 0;
          padding-inline: 0;
          font-family: var(--font-family);
          touch-action: none;
        }

        .title {
          flex: 1;
          min-inline-size: 0;
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          word-break: break-word;
        }

        .row[data-status="done"] {
          background: color-mix(in srgb, var(--color-app-accent) 15%, var(--color-surface));
        }

        .row[data-status="done"] .title {
          color: var(--color-text-muted);
        }

        .row[data-status="done"] .badge {
          background: var(--color-success);
          color: var(--color-text-inverse);
        }

        .note-icon,
        .url-icon {
          flex-shrink: 0;
          color: var(--color-text-muted);
          display: none;
          line-height: 1;
        }

        .note-icon svg,
        .url-icon svg {
          display: block;
          inline-size: var(--icon-size-sm);
          block-size: var(--icon-size-sm);
        }

        .row[data-has-note="true"]  .note-icon { display: block; }
        .row[data-has-url="true"]   .url-icon  { display: block; }

        .badge {
          display: var(--list-badge-display, inline-flex);
          flex-shrink: 0;
          font-size: var(--font-size-micro);
          font-weight: var(--font-weight-semibold);
          border-radius: var(--radius-full);
          padding: 2px var(--space-2);
          cursor: pointer;
          border: none;
          font-family: var(--font-family);
          touch-action: manipulation;
        }

        .badge:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .badge[data-status="open"] {
          background: var(--color-app-accent-light);
          color: var(--color-app-accent);
        }

        .badge[data-status="paused"] {
          background: var(--color-warning-light);
          color: var(--color-warning);
        }

        .badge[data-status="done"] {
          background: var(--color-success-light);
          color: var(--color-success);
        }

        /* ── Selection mode ─────────────────────────────────────────────── */

        :host(.selected) .row {
          box-shadow: inset 0 0 0 2px var(--color-accent);
          background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
        }

        /* ── Done celebration ───────────────────────────────────────────── */

        @keyframes done-ring {
          0%   { outline-color: transparent; }
          30%  { outline-color: color-mix(in srgb, var(--color-app-accent) 60%, transparent); }
          100% { outline-color: transparent; }
        }

        @keyframes done-wash {
          0%   { background: var(--color-surface); }
          25%  { background: color-mix(in srgb, var(--color-app-accent) 30%, var(--color-surface)); }
          100% { background: color-mix(in srgb, var(--color-app-accent) 15%, var(--color-surface)); }
        }

        :host(.done-celebrate) {
          outline: 3px solid transparent;
          outline-offset: 1px;
          animation: done-ring 500ms ease-out forwards;
        }

        :host(.done-celebrate) .row {
          animation: done-wash 500ms ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          :host(.done-celebrate) { animation: none; outline: none; }
          :host(.done-celebrate) .row { animation: none; }
        }
      </style>

      <button class="action-btn done-btn" id="done-btn" aria-label=""></button>
      <button class="action-btn delete-btn" id="delete-btn" aria-label="${t('list-item.delete')}">${icons.trash}</button>
      <div class="row" tabindex="0" role="button" aria-label="">
        <button class="drag-btn" id="drag-btn" type="button" aria-label=""></button>
        <span class="title"></span>
        <span class="note-icon" aria-hidden="true">${icons.info}</span>
        <span class="url-icon"  aria-hidden="true">${icons.link}</span>
        <button type="button" class="badge" id="badge-btn" data-status="open"></button>
      </div>
    `;
  }

  subscribe() {
    this.setAttribute('role', 'listitem');
    this._row      = this.shadowRoot.querySelector('.row');
    this._title    = this.shadowRoot.querySelector('.title');
    this._noteIcon = this.shadowRoot.querySelector('.note-icon');
    this._urlIcon  = this.shadowRoot.querySelector('.url-icon');
    this._badge    = this.shadowRoot.querySelector('.badge');
    this._deleteEl = this.shadowRoot.querySelector('#delete-btn');
    this._doneEl   = this.shadowRoot.querySelector('#done-btn');
    this._revealedDir = null;

    this._update();

    this._stopPointerDown = e => e.stopPropagation();

    this._onDoneBtn = (useDelay = false) => {
      const willBeDone = this._item?.status !== 'done';
      const fire = () => {
        this.dispatchEvent(new CustomEvent('item-done-toggle', {
          bubbles: true, composed: true, detail: { item: this._item },
        }));
        this._closeReveal();
        if (willBeDone) this._celebrate();
      };
      if (useDelay) requestAnimationFrame(fire);
      else fire();
    };
    this._onDonePointerUp = e => { e.stopPropagation(); e.preventDefault(); this._onDoneBtn(true); };
    this._onDoneBtnKey = e => { e.stopPropagation(); if (e.detail === 0) this._onDoneBtn(); };
    this._doneEl.addEventListener('pointerdown', this._stopPointerDown);
    this._doneEl.addEventListener('pointerup', this._onDonePointerUp);
    this._doneEl.addEventListener('click', this._onDoneBtnKey);

    // useDelay: rAF lets the browser's synthesized click fire on the still-present button before DOM removal
    this._onDeleteBtn = (useDelay = false) => {
      const fire = () => {
        this.dispatchEvent(new CustomEvent('item-delete', {
          bubbles: true, composed: true, detail: { item: this._item },
        }));
        this._closeReveal();
      };
      if (useDelay) requestAnimationFrame(fire);
      else fire();
    };
    this._onDeletePointerUp = e => { e.stopPropagation(); e.preventDefault(); this._onDeleteBtn(true); };
    this._onDeleteBtnKey = e => { e.stopPropagation(); if (e.detail === 0) this._onDeleteBtn(); };
    this._deleteEl.addEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl.addEventListener('pointerup', this._onDeletePointerUp);
    this._deleteEl.addEventListener('click', this._onDeleteBtnKey);

    this._onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onTap(); }
    };
    this._row.addEventListener('keydown', this._onKeyDown);

    const STATUS_CYCLE = { open: 'done', done: 'paused', paused: 'open' };
    this._onBadgePointerUp = e => {
      e.stopPropagation();
      e.preventDefault();
      const next = STATUS_CYCLE[this._item?.status ?? 'open'];
      this.dispatchEvent(new CustomEvent('item-status-cycle', {
        bubbles: true, composed: true, detail: { item: this._item, next },
      }));
      if (next === 'done') this._celebrate();
    };
    this._onBadgeKey = e => { e.stopPropagation(); if (e.detail === 0) this._onBadgePointerUp(e); };
    this._badge.addEventListener('pointerdown', this._stopPointerDown);
    this._badge.addEventListener('pointerup',   this._onBadgePointerUp);
    this._badge.addEventListener('click',        this._onBadgeKey);

    this._dragBtn = this.shadowRoot.querySelector('#drag-btn');
    this._dragBtn.setAttribute('aria-label', t('list-item.drag'));
    this._dragBtn.innerHTML = icons.grip;
    this._onDragBtnDown = e => {
      if (this._selectionMode) return;
      e.stopPropagation();
      this._dragBtn.setPointerCapture(e.pointerId);
      this.dispatchEvent(new CustomEvent('item-drag-start', {
        bubbles: true, composed: true,
        detail: { item: this._item, element: this, startX: e.clientX, startY: e.clientY },
      }));
    };
    this._onDragBtnKey = e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('item-reorder-key', {
        bubbles: true, composed: true,
        detail: { item: this._item, direction: e.key === 'ArrowUp' ? -1 : 1 },
      }));
    };
    this._dragBtn.addEventListener('pointerdown', this._onDragBtnDown);
    this._dragBtn.addEventListener('keydown',     this._onDragBtnKey);
  }

  unsubscribe() {
    this._doneEl?.removeEventListener('pointerdown', this._stopPointerDown);
    this._doneEl?.removeEventListener('pointerup', this._onDonePointerUp);
    this._doneEl?.removeEventListener('click', this._onDoneBtnKey);
    this._deleteEl?.removeEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl?.removeEventListener('pointerup', this._onDeletePointerUp);
    this._deleteEl?.removeEventListener('click', this._onDeleteBtnKey);
    this._row?.removeEventListener('keydown', this._onKeyDown);
    this._badge?.removeEventListener('pointerdown', this._stopPointerDown);
    this._badge?.removeEventListener('pointerup',   this._onBadgePointerUp);
    this._badge?.removeEventListener('click',        this._onBadgeKey);
    this._dragBtn?.removeEventListener('pointerdown', this._onDragBtnDown);
    this._dragBtn?.removeEventListener('keydown',     this._onDragBtnKey);
  }

  // ── Gestures ──────────────────────────────────────────────────────────────

  onTap() {
    if (this._revealedDir) { this._closeReveal(); return; }
    if (this._selectionMode) {
      this.dispatchEvent(new CustomEvent('item-select-toggle', {
        bubbles: true, composed: true, detail: { item: this._item },
      }));
      return;
    }
    this.dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: this._item },
    }));
  }

  onLongPress() {
    this.dispatchEvent(new CustomEvent('item-long-press', {
      bubbles: true, composed: true, detail: { item: this._item },
    }));
  }

  _gestureCancel(e) {
    if (this._gesture?.phase === 'swipe') this._closeReveal();
    super._gestureCancel(e);
  }

  onSwipeMove(e) {
    if (this._selectionMode) return;
    this._row.style.transition = 'none';
    let offset;
    if (this._revealedDir === 'left') {
      offset = Math.min(0, -DELETE_WIDTH + e.dx);
    } else {
      const dx = e.dx > 0 ? Math.max(0, e.dx - SWIPE_DEAD_ZONE) : Math.min(0, e.dx + SWIPE_DEAD_ZONE);
      offset = Math.max(-DELETE_WIDTH, Math.min(DONE_WIDTH, dx));
    }
    this._row.style.transform = `translateX(${offset}px)`;
  }

  onSwipe(e) {
    if (this._revealedDir) { this._closeReveal(); return; }
    if (this._selectionMode) return;

    if (e.direction === 'right') {
      const commit = e.distance >= DONE_WIDTH * COMMIT_RATIO || e.velocity >= COMMIT_VELOCITY;
      if (commit) {
        const willBeDone = this._item?.status !== 'done';
        this.dispatchEvent(new CustomEvent('item-done-toggle', {
          bubbles: true, composed: true, detail: { item: this._item },
        }));
        if (willBeDone) this._celebrate();
      }
      this._closeReveal();
      return;
    }

    const commit = e.distance >= DELETE_WIDTH * COMMIT_RATIO || e.velocity >= COMMIT_VELOCITY;
    if (commit) {
      this._row.style.transform = `translateX(-${DELETE_WIDTH}px)`;
      this._revealedDir = 'left';
    } else {
      this._closeReveal();
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _closeReveal() {
    this._row.style.transition = 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)';
    this._row.style.transform  = '';
    this._revealedDir = null;
  }

  _celebrate() {
    this.classList.remove('done-celebrate');
    void this.offsetWidth;
    this.classList.add('done-celebrate');
    this.addEventListener('animationend', () => this.classList.remove('done-celebrate'), { once: true });
  }

  _update() {
    if (!this._row) return;
    const title  = this._item?.title  ?? '';
    const status = this._item?.status ?? 'open';
    const isDone = status === 'done';
    this._title.textContent    = title;
    this._row.setAttribute('aria-label', title);
    this._row.dataset.status   = status;
    this._row.dataset.hasNote  = String(!!this._item?.note);
    this._row.dataset.hasUrl   = String(!!this._item?.url);
    this._badge.textContent    = t(`item-dialog.status-${status}`);
    this._badge.dataset.status = status;
    this._doneEl.innerHTML = isDone ? icons.undo : icons.check;
    this._doneEl.setAttribute('aria-label', isDone ? t('list-item.restore') : t('list-item.mark-done'));
    this._doneEl.classList.toggle('is-restore', isDone);
  }
}

customElements.define('list-item', ListItem);
