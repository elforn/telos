import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';

const REVEAL_WIDTH = 80;

class GoalItem extends Gestures(AppElement) {
  set goal(value) {
    this._goal = value;
    if (this.shadowRoot) this._update();
  }

  set editMode(v) {
    this._editMode = Boolean(v);
    this.classList.toggle('edit-mode', this._editMode);
    if (this._bar) this._closeReveal();
    if (this.shadowRoot) this._updateActionBtn();
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
          inline-size: ${REVEAL_WIDTH}px;
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

        /* delete — right side, revealed by swiping bar left */
        .delete-btn {
          inset-inline-end: 0;
          background: var(--color-danger);
        }

        /* fail / restore — left side, revealed by swiping bar right */
        .fail-btn {
          inset-inline-start: 0;
          background: var(--color-warning);
        }

        :host(.failed) .fail-btn { background: var(--color-success); }

        .bar {
          position: relative;
          z-index: 1;
          block-size: var(--goal-item-height, 40px);
          background: var(--color-surface);
          border: 0.5px solid var(--color-border);
          overflow: hidden;
          display: flex;
          align-items: center;
          padding-inline: var(--space-3);
          cursor: pointer;
          user-select: none;
          transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
          will-change: transform;
        }

        .fill {
          position: absolute;
          inset-block: 0;
          inset-inline-start: 0;
          background: color-mix(in srgb, var(--color-accent) 25%, transparent);
          transition: width 0.1s ease;
          pointer-events: none;
        }

        :host(.failed) .bar {
          background: var(--color-surface-raised);
          border-color: transparent;
        }

        :host(.failed) .fill {
          display: none;
        }

        .title {
          position: relative;
          z-index: 1;
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-inline-size: 0;
        }

        :host(.failed) .title {
          text-decoration: line-through;
          color: var(--color-text-muted);
        }

        .pct-label {
          position: relative;
          z-index: 1;
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-accent);
          flex-shrink: 0;
          margin-inline-start: var(--space-2);
        }

        :host(.hold-active) .bar {
          box-shadow: 0 0 0 2px var(--color-accent);
        }

        @keyframes fill-celebrate {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }

        .fill.celebrate {
          background: linear-gradient(
            to right,
            var(--color-accent) 25%,
            var(--color-accent-light, color-mix(in srgb, var(--color-accent) 60%, var(--color-text-inverse))) 50%,
            var(--color-accent) 75%
          );
          background-size: 300% 100%;
          animation: fill-celebrate var(--duration-slow, 600ms) ease-out forwards;
        }

        @keyframes goal-ring {
          0%   { box-shadow: 0 0 0 0    color-mix(in srgb, var(--color-accent) 80%, transparent); }
          20%  { box-shadow: 0 0 0 8px  color-mix(in srgb, var(--color-accent) 45%, transparent); }
          100% { box-shadow: 0 0 0 60px transparent; }
        }

        :host(.celebrating) {
          overflow: visible;
          animation: goal-ring 700ms ease-out forwards;
        }

        @keyframes peek-hint {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-14px); }
          40%  { transform: translateX(0); }
          60%  { transform: translateX(14px); }
          80%  { transform: translateX(0); }
          100% { transform: translateX(0); }
        }

        :host(.peek-hint) .bar {
          animation: peek-hint 600ms var(--peek-delay, 0ms) cubic-bezier(0.32, 0.72, 0, 1) both;
        }

        @keyframes pop-confirm {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.09); }
          100% { transform: scale(1); }
        }

        :host(.pop-confirm) {
          overflow: visible;
          animation: pop-confirm 280ms var(--pop-delay, 0ms) cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .fill.celebrate { animation: none; }
          :host(.celebrating) { animation: none; }
          :host(.peek-hint) .bar { animation: none; }
          :host(.pop-confirm) { animation: none; }
        }

        .sr-only {
          position: absolute;
          inline-size: 1px;
          block-size: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
        }
      </style>

      <span role="status" class="sr-only" id="announce"></span>
      <button class="action-btn fail-btn" id="fail-btn">${t('goal-item.fail')}</button>
      <button class="action-btn delete-btn" id="delete-btn">${t('goal-item.delete')}</button>
      <div class="bar"
           tabindex="0"
           role="slider"
           aria-label=""
           aria-valuemin="0"
           aria-valuemax="100"
           aria-valuenow="0">
        <div class="fill" style="width:0%"></div>
        <span class="title"></span>
        <span class="pct-label" hidden></span>
      </div>
    `;
  }

  subscribe() {
    this.setAttribute('role', 'listitem');
    this._bar      = this.shadowRoot.querySelector('.bar');
    this._fill     = this.shadowRoot.querySelector('.fill');
    this._title    = this.shadowRoot.querySelector('.title');
    this._pctLabel = this.shadowRoot.querySelector('.pct-label');
    this._announce = this.shadowRoot.querySelector('#announce');
    this._revealedDir = null;
    this._failed      = false;
    this._editMode    = this._editMode ?? false;

    this._update();

    this._stopPointerDown = e => e.stopPropagation();

    const deleteEl = this.shadowRoot.querySelector('#delete-btn');
    this._onDeleteBtn = () => {
      this.dispatchEvent(new CustomEvent('goal-delete', {
        bubbles: true, composed: true, detail: { goal: this._goal },
      }));
      this._closeReveal();
    };
    deleteEl.addEventListener('pointerdown', this._stopPointerDown);
    deleteEl.addEventListener('click', this._onDeleteBtn);

    const failEl = this.shadowRoot.querySelector('#fail-btn');
    this._onFailBtn = () => {
      const wasFailed = this._failed;
      this.dispatchEvent(new CustomEvent('goal-progress', {
        bubbles: true, composed: true,
        detail: { percentage: wasFailed ? 0 : -1, goal: this._goal },
      }));
      if (this._announce) {
        this._announce.textContent = wasFailed
          ? t('goal-item.status-restored')
          : t('goal-item.status-failed');
      }
      this._closeReveal();
    };
    failEl.addEventListener('pointerdown', this._stopPointerDown);
    failEl.addEventListener('click', this._onFailBtn);

    this._onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._tap(); }
      if (e.key === 'ArrowRight') this.onHoldDragKey('right');
      if (e.key === 'ArrowLeft')  this.onHoldDragKey('left');
    };
    this._bar.addEventListener('keydown', this._onKeyDown);
  }

  unsubscribe() {
    const deleteEl = this.shadowRoot.querySelector('#delete-btn');
    deleteEl?.removeEventListener('pointerdown', this._stopPointerDown);
    deleteEl?.removeEventListener('click', this._onDeleteBtn);
    const failEl = this.shadowRoot.querySelector('#fail-btn');
    failEl?.removeEventListener('pointerdown', this._stopPointerDown);
    failEl?.removeEventListener('click', this._onFailBtn);
    this._bar?.removeEventListener('keydown', this._onKeyDown);
  }

  // ── Gestures ──────────────────────────────────────────────────────────────

  onTap() {
    if (this._revealedDir === 'left')  { this._onDeleteBtn(); return; }
    if (this._revealedDir === 'right') { this._onFailBtn();   return; }
    this._tap();
  }

  onHoldDragStart() {
    this._closeReveal();
    this.classList.add('hold-active');
    this._bar.style.transition = 'none';
    this._setDragMode(true);
  }

  onHoldDragKey(dir) {
    this._setPct(dir === 'right' ? Math.min(100, this._pct + 5) : Math.max(0, this._pct - 5));
    if (this._pct === 100) this._celebrate();
    this._emitProgress();
  }

  onHoldDrag(e) {
    const rect = this._bar.getBoundingClientRect();
    if (!rect.width) return;
    const pct = Math.round(Math.max(0, Math.min(100, (e.endX - rect.left) / rect.width * 100)));
    this._setPct(pct);
  }

  onHoldDragEnd() {
    this.classList.remove('hold-active');
    this._bar.style.transition = '';
    this._setDragMode(false);
    if (this._pct === 100) this._celebrate();
    this._emitProgress();
  }

  onSwipeMove(e) {
    if (!this._editMode) return;
    this._bar.style.transition = 'none';
    const base = this._revealedDir === 'left'  ? -REVEAL_WIDTH
               : this._revealedDir === 'right' ?  REVEAL_WIDTH
               : 0;
    const offset = Math.max(-REVEAL_WIDTH, Math.min(REVEAL_WIDTH, base + e.dx));
    this._bar.style.transform = `translateX(${offset}px)`;
  }

  onSwipe(e) {
    this._bar.style.transition = '';
    if (!this._editMode) return;
    if (e.direction === 'left') {
      this._bar.style.transform = `translateX(-${REVEAL_WIDTH}px)`;
      this._revealedDir = 'left';
    } else if (e.direction === 'right') {
      this._bar.style.transform = `translateX(${REVEAL_WIDTH}px)`;
      this._revealedDir = 'right';
    } else {
      this._closeReveal();
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _tap() {
    this.dispatchEvent(new CustomEvent('goal-tap', {
      bubbles: true, composed: true, detail: { goal: this._goal },
    }));
  }

  popConfirm(delay = 0) {
    this.style.setProperty('--pop-delay', `${delay}ms`);
    this.classList.remove('pop-confirm');
    void this.offsetWidth; // force reflow to restart animation
    this.classList.add('pop-confirm');
    setTimeout(() => this.classList.remove('pop-confirm'), delay + 350);
  }

  peekHint(delay = 0) {
    if (!this._editMode) return;
    this.style.setProperty('--peek-delay', `${delay}ms`);
    this.classList.remove('peek-hint');
    void this.offsetWidth; // force reflow to restart animation
    this.classList.add('peek-hint');
    setTimeout(() => this.classList.remove('peek-hint'), delay + 700);
  }

  _closeReveal() {
    this._bar.style.transition = '';
    this._bar.style.transform  = '';
    this._revealedDir = null;
  }

  _setPct(pct) {
    this._pct = Math.max(0, Math.min(100, pct));
    this._fill.style.width = `${this._pct}%`;
    this._bar.setAttribute('aria-valuenow', String(this._pct));
    if (this._pctLabel) this._pctLabel.textContent = `${this._pct}%`;
  }

  _setDragMode(active) {
    this._title.hidden    = active;
    this._pctLabel.hidden = !active;
  }

  _emitProgress() {
    this.dispatchEvent(new CustomEvent('goal-progress', {
      bubbles: true, composed: true, detail: { percentage: this._pct, goal: this._goal },
    }));
  }

  _updateActionBtn() {
    const failBtn = this.shadowRoot?.querySelector('#fail-btn');
    if (failBtn) failBtn.textContent = this._failed ? t('goal-item.restore') : t('goal-item.fail');
  }

  _celebrate() {
    this._fill.classList.add('celebrate');
    this._fill.addEventListener('animationend', () => this._fill.classList.remove('celebrate'), { once: true });
    this.classList.add('celebrating');
    this.addEventListener('animationend', () => this.classList.remove('celebrating'), { once: true });
  }

  _update() {
    if (!this._bar) return;
    const pct    = this._goal?.percentage ?? 0;
    this._failed = pct < 0;
    const prevPct = this._pct;
    this._pct    = Math.max(0, pct);
    this.classList.toggle('failed', this._failed);
    this._title.textContent = this._goal?.title ?? '';
    this._bar.setAttribute('aria-label', this._goal?.title ?? '');
    this._setPct(this._pct);
    this._updateActionBtn();
    if (this._pct === 100 && prevPct !== undefined && prevPct < 100) this._celebrate();
  }
}

customElements.define('goal-item', GoalItem);
