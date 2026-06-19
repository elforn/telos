import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';

const DONE_WIDTH      = 48;   // square-ish done button
const DELETE_WIDTH    = 80;   // wider delete button (text label)
const COMMIT_RATIO    = 1.2;  // fraction of reveal width needed to commit
const COMMIT_VELOCITY = 0.35; // px/ms — fast flick commits regardless

class ListItem extends Gestures(AppElement) {
  set item(value) {
    this._item = value;
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
          font-size: var(--font-size-body);
        }

        .done-btn.is-restore {
          background: var(--color-app-accent);
          font-size: var(--font-size-heading);
        }

        /* delete — right side, revealed by swiping row left */
        .delete-btn {
          inset-inline-end: 0;
          inline-size: ${DELETE_WIDTH}px;
          background: var(--color-danger);
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
          gap: var(--space-2);
          cursor: pointer;
          user-select: none;
          touch-action: pan-y;
          transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
          will-change: transform;
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

        .row[data-status="done"] .badge {
          background: var(--color-success);
          color: var(--color-text-inverse);
        }

        .note-icon,
        .url-icon {
          flex-shrink: 0;
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          display: none;
          line-height: 1;
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

        /* ── Done celebration ───────────────────────────────────────────── */

        @keyframes done-ring {
          0%   { box-shadow: var(--shadow-card); }
          25%  { box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-success) 45%, transparent); }
          100% { box-shadow: var(--shadow-card); }
        }

        @keyframes done-wash {
          0%   { background: var(--color-surface); }
          25%  { background: var(--color-success-light); }
          100% { background: var(--color-surface); }
        }

        :host(.done-celebrate) {
          overflow: visible;
          animation: done-ring 500ms ease-out forwards;
        }

        :host(.done-celebrate) .row {
          animation: done-wash 500ms ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          :host(.done-celebrate),
          :host(.done-celebrate) .row { animation: none; }
        }
      </style>

      <button class="action-btn done-btn" id="done-btn">✓</button>
      <button class="action-btn delete-btn" id="delete-btn">${t('list-item.delete')}</button>
      <div class="row" tabindex="0" role="button" aria-label="">
        <span class="title"></span>
        <span class="note-icon" aria-hidden="true">✎</span>
        <span class="url-icon"  aria-hidden="true">🔗</span>
        <span class="badge" data-status="open"></span>
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
    this._revealedDir  = null;
    this._deleteConfirm = false;

    this._update();

    this._stopPointerDown = e => e.stopPropagation();

    // useDelay: rAF lets the browser's synthesized click fire on the still-present button before DOM removal
    this._onDeleteBtn = (useDelay = false) => {
      if (!this._deleteConfirm) {
        this._deleteConfirm = true;
        this._deleteEl.textContent = t('list-item.delete-confirm');
        return;
      }
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

    this._onDoneBtn = () => {
      const willBeDone = this._item?.status !== 'done';
      this.dispatchEvent(new CustomEvent('item-done-toggle', {
        bubbles: true, composed: true, detail: { item: this._item },
      }));
      this._closeReveal();
      if (willBeDone) this._celebrate();
    };
    this._onDonePointerUp = e => { e.stopPropagation(); e.preventDefault(); this._onDoneBtn(); };
    this._onDoneBtnKey = e => { e.stopPropagation(); if (e.detail === 0) this._onDoneBtn(); };
    this._doneEl.addEventListener('pointerdown', this._stopPointerDown);
    this._doneEl.addEventListener('pointerup', this._onDonePointerUp);
    this._doneEl.addEventListener('click', this._onDoneBtnKey);

    this._onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onTap(); }
    };
    this._row.addEventListener('keydown', this._onKeyDown);
  }

  unsubscribe() {
    this._deleteEl?.removeEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl?.removeEventListener('pointerup', this._onDeletePointerUp);
    this._deleteEl?.removeEventListener('click', this._onDeleteBtnKey);
    this._doneEl?.removeEventListener('pointerdown', this._stopPointerDown);
    this._doneEl?.removeEventListener('pointerup', this._onDonePointerUp);
    this._doneEl?.removeEventListener('click', this._onDoneBtnKey);
    this._row?.removeEventListener('keydown', this._onKeyDown);
  }

  // ── Gestures ──────────────────────────────────────────────────────────────

  onTap() {
    if (this._revealedDir) {
      this._closeReveal();
      return;
    }
    this.dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: this._item },
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
      // Delete revealed — only allow closing (moving right toward 0, not past)
      offset = Math.min(0, -DELETE_WIDTH + e.dx);
    } else if (this._revealedDir === 'right') {
      // Done revealed — only allow closing (moving left toward 0, not past)
      offset = Math.max(0, DONE_WIDTH + e.dx);
    } else {
      offset = Math.max(-DELETE_WIDTH, Math.min(DONE_WIDTH, e.dx));
    }
    this._row.style.transform = `translateX(${offset}px)`;
  }

  onSwipe(e) {
    // If a side is already open, any swipe closes it — never opens the other side.
    if (this._revealedDir) {
      this._closeReveal();
      return;
    }

    const revealWidth = e.direction === 'right' ? DONE_WIDTH : DELETE_WIDTH;
    const commit = e.distance >= revealWidth * COMMIT_RATIO || e.velocity >= COMMIT_VELOCITY;

    if (commit && e.direction === 'left') {
      this._row.style.transform = `translateX(-${DELETE_WIDTH}px)`;
      this._revealedDir = 'left';
    } else if (commit && e.direction === 'right') {
      this._row.style.transform = `translateX(${DONE_WIDTH}px)`;
      this._revealedDir = 'right';
    } else {
      this._closeReveal(); // _closeReveal sets its own spring transition
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _closeReveal() {
    this._row.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)';
    this._row.style.transform  = '';
    this._revealedDir = null;
    if (this._deleteConfirm) {
      this._deleteConfirm = false;
      this._deleteEl.textContent = t('list-item.delete');
    }
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
    this._doneEl.textContent   = isDone ? '↺' : '✓';
    this._doneEl.setAttribute('aria-label', isDone ? t('list-item.restore') : t('list-item.mark-done'));
    this._doneEl.classList.toggle('is-restore', isDone);
  }
}

customElements.define('list-item', ListItem);
