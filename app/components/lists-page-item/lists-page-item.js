import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';

const REVEAL_WIDTH    = 80;
const COLOR_WIDTH     = 56;
const COMMIT_RATIO    = 2.0;
const COMMIT_VELOCITY = 0.35;
const SWIPE_DEAD_ZONE = 15;

export const COLOR_PALETTE = [null, '#E5534B', '#E07633', '#D4A928', '#3DAD6A', '#29A8A1', '#4A94D4', '#8B67D6'];

class ListsPageItem extends Gestures(AppElement) {
  set list(value) {
    this._list = value;
    if (this.shadowRoot) this._update();
  }

  template() {
    return `
      <style>
        :host {
          display: block;
          position: relative;
          overflow: hidden;
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-card);
          --accent-border: 3px;
          --base-border: 0.5px;
          --row-gap: 6px; /* between --space-1 (4px) and --space-2 (8px) */
        }

        /* ── Left panel — revealed by swiping right ───────────────────────── */

        .color-panel {
          position: absolute;
          inset-block: 0;
          inset-inline-start: 0;
          inline-size: ${COLOR_WIDTH}px;
          background: var(--color-panel-bg, var(--color-surface-raised));
        }

        /* ── Right panel — revealed by swiping left ───────────────────────── */

        .delete-btn {
          position: absolute;
          inset-block: 0;
          inset-inline-end: 0;
          inline-size: ${REVEAL_WIDTH}px;
          background: var(--color-danger);
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

        /* ── Row ──────────────────────────────────────────────────────────── */

        .row {
          position: relative;
          z-index: 1;
          min-block-size: var(--goal-item-height, 44px);
          background: var(--color-surface);
          border: var(--base-border) solid var(--color-border);
          border-inline-start: var(--accent-border) solid var(--list-item-color, transparent);
          display: flex;
          align-items: center;
          padding-inline-start: calc(var(--space-3) - var(--accent-border) + var(--base-border));
          padding-inline-end: var(--space-3);
          gap: var(--row-gap);
          cursor: pointer;
          user-select: none;
          touch-action: pan-y;
          transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .row { transition: none; }
        }

        .row:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
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
          transform: translateY(1px);
        }

        .item-count {
          flex-shrink: 0;
          font-size: var(--font-size-caption);
          line-height: 1;
          color: var(--color-text-muted);
          margin-inline-end: 2px;
          transform: translateY(1px);
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
          display: flex;
          align-items: center;
          justify-content: center;
          padding-block: 0;
          padding-inline: 0;
          touch-action: none;
        }

        .drag-btn::before {
          content: '';
          display: block;
          inline-size: 10px;
          block-size: 15px;
          background-image: radial-gradient(circle 1.5px at center, currentColor 100%, transparent 100%);
          background-size: 5px 5px;
          background-repeat: repeat;
        }

        .nav-btn {
          align-self: stretch;
          flex-shrink: 0;
          min-inline-size: calc(var(--touch-target) + 35px);
          background: var(--color-accent-subtle);
          border: none;
          border-inline-start: 1px solid color-mix(in srgb, var(--color-accent) 25%, transparent);
          cursor: pointer;
          color: var(--color-accent);
          display: flex;
          align-items: center;
          justify-content: center;
          padding-inline: var(--space-2) var(--space-3);
          margin-inline-end: calc(-1 * var(--space-3));
        }

        .nav-btn::before {
          content: '';
          display: block;
          inline-size: 7px;
          block-size: 7px;
          border-inline-end: 2px solid currentColor;
          border-block-start: 2px solid currentColor;
          transform: rotate(45deg);
          flex-shrink: 0;
        }

        .nav-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>

      <div class="color-panel" id="color-panel" aria-hidden="true"></div>
      <button class="delete-btn" id="delete-btn">${t('list-item.delete')}</button>
      <div class="row" tabindex="0" role="button" aria-label="">
        <button class="drag-btn" id="drag-btn" type="button" aria-label=""></button>
        <span class="list-name"></span>
        <span class="item-count"></span>
        <button class="nav-btn" id="nav-btn" type="button" aria-label=""></button>
      </div>
    `;
  }

  subscribe() {
    this.setAttribute('role', 'listitem');
    this._row        = this.shadowRoot.querySelector('.row');
    this._nameEl     = this.shadowRoot.querySelector('.list-name');
    this._countEl    = this.shadowRoot.querySelector('.item-count');
    this._deleteEl   = this.shadowRoot.querySelector('#delete-btn');
    this._colorPanel = this.shadowRoot.querySelector('#color-panel');
    this._navBtn     = this.shadowRoot.querySelector('#nav-btn');
    this._revealedDir   = null;
    this._deleteConfirm = false;

    this._update();

    this._stopPointerDown = e => e.stopPropagation();

    // ── Delete button (right side) ───────────────────────────────────────────
    // useDelay: rAF lets the browser's synthesized click fire on the still-present button before DOM removal
    this._onDeleteBtn = (useDelay = false) => {
      if (!this._deleteConfirm) {
        this._deleteConfirm = true;
        this._deleteEl.textContent = t('list-item.delete-confirm');
        return;
      }
      const fire = () => {
        this.dispatchEvent(new CustomEvent('list-delete', {
          bubbles: true, composed: true, detail: { list: this._list },
        }));
        this._closeReveal();
      };
      if (useDelay) requestAnimationFrame(fire);
      else fire();
    };
    this._onDeletePointerUp = e => { e.stopPropagation(); e.preventDefault(); this._onDeleteBtn(true); };
    this._onDeleteBtnKey = e => { e.stopPropagation(); if (e.detail === 0) this._onDeleteBtn(); };
    this._deleteEl.addEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl.addEventListener('pointerup',   this._onDeletePointerUp);
    this._deleteEl.addEventListener('click',       this._onDeleteBtnKey);

    // ── Nav button ───────────────────────────────────────────────────────────
    this._onNavClick = e => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('list-tap', {
        bubbles: true, composed: true, detail: { list: this._list },
      }));
    };
    this._navBtn.addEventListener('pointerdown', this._stopPointerDown);
    this._navBtn.addEventListener('click',       this._onNavClick);

    // ── Keyboard ─────────────────────────────────────────────────────────────
    this._onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onTap(); }
    };
    this._row.addEventListener('keydown', this._onKeyDown);

    // ── Drag handle ──────────────────────────────────────────────────────────
    this._dragBtn = this.shadowRoot.querySelector('#drag-btn');
    this._dragBtn.setAttribute('aria-label', t('lists-page.drag'));
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
    this._deleteEl?.removeEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl?.removeEventListener('pointerup',   this._onDeletePointerUp);
    this._deleteEl?.removeEventListener('click',       this._onDeleteBtnKey);
    this._navBtn?.removeEventListener('pointerdown',   this._stopPointerDown);
    this._navBtn?.removeEventListener('click',         this._onNavClick);
    this._row?.removeEventListener('keydown',          this._onKeyDown);
    this._dragBtn?.removeEventListener('pointerdown',  this._onDragBtnDown);
    this._dragBtn?.removeEventListener('keydown',      this._onDragBtnKey);
  }

  // ── Gestures ──────────────────────────────────────────────────────────────

  onTap() {
    if (this._revealedDir) {
      this._closeReveal();
      return;
    }
    this.dispatchEvent(new CustomEvent('list-edit', {
      bubbles: true, composed: true, detail: { list: this._list },
    }));
  }

  _gestureCancel(e) {
    if (this._gesture?.phase === 'swipe') this._closeReveal();
    super._gestureCancel(e);
  }

  onSwipeMove(e) {
    this._row.style.transition = 'none';
    let offset;
    if (this._revealedDir === 'left') {
      offset = Math.min(0, -REVEAL_WIDTH + e.dx);
    } else {
      const dx = e.dx > 0 ? Math.max(0, e.dx - SWIPE_DEAD_ZONE) : Math.min(0, e.dx + SWIPE_DEAD_ZONE);
      offset = Math.max(-REVEAL_WIDTH, Math.min(COLOR_WIDTH, dx));
    }
    this._row.style.transform = `translateX(${offset}px)`;
  }

  onSwipe(e) {
    if (this._revealedDir) {
      this._closeReveal();
      return;
    }

    if (e.direction === 'right') {
      const commit = e.distance >= COLOR_WIDTH * COMMIT_RATIO || e.velocity >= COMMIT_VELOCITY;
      if (commit) {
        this.dispatchEvent(new CustomEvent('list-color-cycle', {
          bubbles: true, composed: true, detail: { list: this._list },
        }));
      }
      this._closeReveal();
      return;
    }

    // direction === 'left' — reveal delete button
    const commit = e.distance >= REVEAL_WIDTH * COMMIT_RATIO || e.velocity >= COMMIT_VELOCITY;
    if (commit) {
      this._row.style.transform = `translateX(-${REVEAL_WIDTH}px)`;
      this._revealedDir = 'left';
    } else {
      this._closeReveal();
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _closeReveal() {
    this._row.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
    this._row.style.transform  = '';
    this._revealedDir = null;
    if (this._deleteConfirm) {
      this._deleteConfirm = false;
      this._deleteEl.textContent = t('list-item.delete');
    }
  }

  _update() {
    if (!this._row) return;
    const name  = this._list?.name  ?? '';
    const count = this._list?.items?.length ?? 0;
    const color = this._list?.color ?? null;
    this._nameEl.textContent  = name;
    this._countEl.textContent = String(count);
    this._row.style.setProperty('--list-item-color', color ?? 'transparent');
    this.setAttribute('aria-label', name);
    this._row.setAttribute('aria-label', name);
    this._navBtn.setAttribute('aria-label', `${t('lists-page.navigate')} ${name}`);
    if (color) {
      this._colorPanel.style.setProperty('--color-panel-bg', color);
    } else {
      this._colorPanel.style.removeProperty('--color-panel-bg');
    }
  }
}

customElements.define('lists-page-item', ListsPageItem);
