import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';

const REVEAL_WIDTH    = 80;
const COMMIT_RATIO    = 1.2;
const COMMIT_VELOCITY = 0.35;

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
        }

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

        .row {
          position: relative;
          z-index: 1;
          min-block-size: var(--goal-item-height, 44px);
          background: var(--color-surface);
          border: 0.5px solid var(--color-border);
          border-inline-start: 3px solid var(--list-item-color, transparent);
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

        .row:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .list-name {
          flex: 1;
          min-inline-size: 0;
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-count {
          flex-shrink: 0;
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          padding-inline-end: var(--space-1);
        }

        .edit-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-family);
        }

        .edit-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>

      <button class="delete-btn" id="delete-btn">${t('list-item.delete')}</button>
      <div class="row" tabindex="0" role="button" aria-label="">
        <span class="list-name"></span>
        <span class="item-count"></span>
        <button class="edit-btn" id="edit-btn" type="button" aria-label="">···</button>
      </div>
    `;
  }

  subscribe() {
    this.setAttribute('role', 'listitem');
    this._row      = this.shadowRoot.querySelector('.row');
    this._nameEl   = this.shadowRoot.querySelector('.list-name');
    this._countEl  = this.shadowRoot.querySelector('.item-count');
    this._deleteEl = this.shadowRoot.querySelector('#delete-btn');
    this._editBtn  = this.shadowRoot.querySelector('#edit-btn');
    this._revealedDir   = null;
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
    this._deleteEl.addEventListener('pointerup', this._onDeletePointerUp);
    this._deleteEl.addEventListener('click', this._onDeleteBtnKey);

    this._onEditClick = e => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('list-edit', {
        bubbles: true, composed: true, detail: { list: this._list },
      }));
    };
    this._editBtn.addEventListener('pointerdown', this._stopPointerDown);
    this._editBtn.addEventListener('click', this._onEditClick);

    this._onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onTap(); }
    };
    this._row.addEventListener('keydown', this._onKeyDown);
  }

  unsubscribe() {
    this._deleteEl?.removeEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl?.removeEventListener('pointerup', this._onDeletePointerUp);
    this._deleteEl?.removeEventListener('click', this._onDeleteBtnKey);
    this._editBtn?.removeEventListener('pointerdown', this._stopPointerDown);
    this._editBtn?.removeEventListener('click', this._onEditClick);
    this._row?.removeEventListener('keydown', this._onKeyDown);
  }

  // ── Gestures ──────────────────────────────────────────────────────────────

  onTap() {
    if (this._revealedDir) {
      this._closeReveal();
      return;
    }
    this.dispatchEvent(new CustomEvent('list-tap', {
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
      offset = Math.max(-REVEAL_WIDTH, Math.min(0, e.dx));
    }
    this._row.style.transform = `translateX(${offset}px)`;
  }

  onSwipe(e) {
    if (this._revealedDir) {
      this._closeReveal();
      return;
    }

    if (e.direction !== 'left') {
      this._row.style.transition = '';
      return;
    }

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
    this._row.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)';
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
    const color = this._list?.color ?? 'transparent';
    this._nameEl.textContent  = name;
    this._countEl.textContent = String(count);
    this._row.style.setProperty('--list-item-color', color);
    this.setAttribute('aria-label', name);
    this._row.setAttribute('aria-label', name);
    this._editBtn.setAttribute('aria-label', `${t('lists-page.edit')} ${name}`);
  }
}

customElements.define('lists-page-item', ListsPageItem);
