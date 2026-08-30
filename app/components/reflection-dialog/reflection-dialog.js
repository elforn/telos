import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';
import { icons } from '../../icons.js';
import { REFLECTION_ASPECTS, aggregateScore } from '../../utils/reflection.js';

const STAR_VALUES = [1, 2, 3, 4, 5];
const POP_DURATION_MS = 350;

// UI-tier: property-in (open()) / event-out (reflection-score-changed,
// reflection-comment-changed, reflection-visibility-changed, modal-close from
// the wrapped modal-dialog), zero store knowledge — the host (year-header.js)
// owns reading/writing `reflections` and the session-undo toast. aggregateScore
// is used here only for the live in-dialog score badge (a pure function over
// this component's own in-memory scores, not a store read).
class ReflectionDialog extends AppElement {
  template() {
    return `
      <style>
        @keyframes star-pop {
          0%   { transform: scale(1); }
          45%  { transform: scale(1.4); }
          100% { transform: scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .star-btn.pop svg { animation: none; }
        }

        /* Consistent modal padding across the app: --space-5 on both axes. */
        #dialog { --space-6: var(--space-5); }

        /* modal-dialog's own .body (never edited — _lib/) is the thing that
           scrolls; slotting a single flex-column frame into it, with only
           .reflection-scroll (not the title) set to overflow-y:auto, means
           .body's content exactly fills its box and never itself needs to
           scroll — so its native scrollbar never bleeds up alongside the
           title. The title stays a fixed sibling above the actual scrolling
           region, not a sticky element inside it. */
        .reflection-frame {
          display: flex;
          flex-direction: column;
          block-size: 100%;
        }

        .reflection-scroll {
          flex: 1;
          min-block-size: 0;
          overflow-y: auto;
        }

        .reflection-header {
          flex-shrink: 0;
          padding-block-end: var(--space-3);
          margin-block-end: var(--space-3);
          border-block-end: 0.5px solid var(--color-border);
        }

        .reflection-title {
          margin: 0;
          font-size: var(--font-size-heading);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
        }

        /* Lines, not raised boxes — a full card per aspect (5 of them) read
           heavy; a plain divider between rows is the same idiom modal-dialog
           menus already use throughout the app. */
        .reflection-row {
          padding-block: var(--space-3);
          border-block-start: 0.5px solid var(--color-border);
        }

        .reflection-row:first-of-type {
          padding-block-start: 0;
          border-block-start: none;
        }

        .reflection-label {
          margin: 0;
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-primary);
        }

        .reflection-hint {
          margin: 2px 0 var(--space-2);
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
        }

        .star-group {
          display: flex;
          gap: var(--space-1);
          margin-inline-start: calc(-1 * var(--space-2));
        }

        .star-btn {
          min-inline-size: var(--touch-target-lg);
          min-block-size: var(--touch-target-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          cursor: pointer;
          /* Matches the app's existing icon-button baseline (.nav-btn/.menu-btn/
             .filter-btn), not --color-border (dividers) — an interactive
             control's own icon needs more than a hairline's contrast. */
          color: var(--color-text-secondary);
        }

        .star-btn svg {
          inline-size: 34px;
          block-size: 34px;
          pointer-events: none;
          transform-origin: center;
        }

        /* Empty (unfilled) stars read a touch heavy at this larger size with
           the shared icon helper's default stroke-width (2, tuned for 20px
           icons) — thin it slightly, filled stars are unaffected (solid fill,
           not stroke-dependent). */
        .star-btn:not(.filled) svg {
          stroke-width: 1.5;
        }

        .star-btn.pop svg {
          animation: star-pop ${POP_DURATION_MS}ms ease-out;
        }

        .star-btn.filled {
          color: var(--color-accent);
        }

        .star-btn.filled svg {
          fill: currentColor;
        }

        .star-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .comment-label {
          display: block;
          margin-block: var(--space-2) var(--space-2);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
        }

        .comment-input {
          box-sizing: border-box;
          inline-size: 100%;
          min-block-size: 80px;
          padding: var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-surface);
          color: var(--color-text-primary);
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          resize: vertical;
        }

        .comment-input:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* Single footer slot child spanning the full width, so it can lay out
           space-between itself — modal-dialog's own .footer (_lib/, never
           edited) is justify-content:flex-end, which would otherwise push
           both buttons together against the end. */
        .dialog-footer {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
        }

        .footer-end {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .reflection-live-score {
          font-size: var(--font-size-subheading);
          font-weight: var(--font-weight-semibold);
          color: var(--color-accent);
        }

        /* Text, not an icon — icons in this dialog represent state (the
           stars), not actions, so the one action button in the footer stays
           text-only for that distinction. */
        .visibility-toggle {
          min-block-size: var(--touch-target);
          padding-inline: var(--space-2);
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
        }

        .visibility-toggle:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* Matches goal-dialog's own #close exactly: a plain text button, not
           a filled accent pill — this dialog has no separate "save" action
           (everything already commits live), so Close shouldn't read as a
           primary/confirming action. */
        .close-btn {
          min-block-size: var(--touch-target);
          padding-inline: var(--space-2);
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          background: none;
          color: var(--color-text-secondary);
        }

        .close-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>

      <modal-dialog id="dialog" aria-label="${t('reflection.dialog-heading')}">
        <div class="reflection-frame">
          <div class="reflection-header">
            <h2 class="reflection-title">${t('reflection.dialog-heading')}</h2>
          </div>
          <div class="reflection-scroll">
            ${REFLECTION_ASPECTS.map(a => `
              <div class="reflection-row">
                <p class="reflection-label">${t(a.labelKey)}</p>
                <p class="reflection-hint">${t(a.hintKey)}</p>
                <div class="star-group" role="radiogroup" data-aspect="${a.key}" aria-label="${t(a.labelKey)}">
                  ${STAR_VALUES.map(n => `
                    <button type="button" class="star-btn" role="radio" data-value="${n}" aria-checked="false" tabindex="-1" aria-label="${t('reflection.star-aria', { n })}">${icons.star}</button>
                  `).join('')}
                </div>
              </div>
            `).join('')}
            <label class="comment-label" for="reflection-comment">${t('reflection.highlights-label')}</label>
            <textarea id="reflection-comment" class="comment-input" rows="3" placeholder="${t('reflection.highlights-placeholder')}"></textarea>
          </div>
        </div>

        <div slot="footer" class="dialog-footer">
          <button type="button" class="visibility-toggle" id="reflection-visibility-btn"></button>
          <div class="footer-end">
            <span class="reflection-live-score" id="reflection-live-score" hidden></span>
            <button type="button" class="close-btn" id="reflection-close-btn" aria-label="${t('reflection.close')}">${t('reflection.close')}</button>
          </div>
        </div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._dialog        = this.shadowRoot.querySelector('#dialog');
    this._commentInput  = this.shadowRoot.querySelector('#reflection-comment');
    this._liveScoreEl   = this.shadowRoot.querySelector('#reflection-live-score');
    this._visibilityBtn = this.shadowRoot.querySelector('#reflection-visibility-btn');
    this._scores         = {};
    this._initialComment = '';
    this._visible         = true;
    this._popTimers       = {};

    this.listen(this.shadowRoot, 'click', e => {
      const btn = e.target.closest('.star-btn');
      if (btn) this._selectStar(btn.closest('.star-group').dataset.aspect, Number(btn.dataset.value));
    });

    // Roving-tabindex arrow-key navigation, mirroring the WAI-ARIA radiogroup
    // pattern used by goal-dialog's type-pill group: arrows both move focus
    // and commit the new value (radio semantics — selection follows focus).
    this.listen(this.shadowRoot, 'keydown', e => {
      const btn = e.target.closest('.star-btn');
      if (!btn) return;
      const group  = btn.closest('.star-group');
      const aspect = group.dataset.aspect;
      const current = this._scores[aspect] ?? 0;
      let next;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(5, current + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(1, (current || 1) - 1);
      else if (e.key === 'Home') next = 1;
      else if (e.key === 'End') next = 5;
      else return;
      e.preventDefault();
      this._selectStar(aspect, next);
      group.querySelector(`.star-btn[data-value="${next}"]`)?.focus();
    });

    this.listen(this._commentInput, 'blur', () => {
      const value = this._commentInput.value;
      if (value === this._initialComment) return;
      this._initialComment = value;
      this.dispatchEvent(new CustomEvent('reflection-comment-changed', {
        bubbles: true, composed: true, detail: { comment: value },
      }));
    });

    this.listen(this._visibilityBtn, 'click', () => {
      this._visible = !this._visible;
      this._renderVisibilityBtn();
      this.dispatchEvent(new CustomEvent('reflection-visibility-changed', {
        bubbles: true, composed: true, detail: { visible: this._visible },
      }));
    });

    this.listen(this.shadowRoot.querySelector('#reflection-close-btn'), 'click', () => this._dialog.close());
  }

  _selectStar(aspect, value) {
    this._scores = { ...this._scores, [aspect]: value };
    this._renderGroup(aspect);
    this._popStars(aspect, value);
    this._renderLiveScore();
    this.dispatchEvent(new CustomEvent('reflection-score-changed', {
      bubbles: true, composed: true, detail: { key: aspect, value },
    }));
  }

  _renderGroup(aspect) {
    const group = this.shadowRoot.querySelector(`.star-group[data-aspect="${aspect}"]`);
    if (!group) return;
    const value = this._scores[aspect] ?? 0;
    group.querySelectorAll('.star-btn').forEach(btn => {
      const n = Number(btn.dataset.value);
      btn.classList.toggle('filled', n <= value);
      btn.setAttribute('aria-checked', String(n === value));
      btn.tabIndex = n === (value || 1) ? 0 : -1;
    });
  }

  // Pops every filled star (1..value), not just the one tapped — a single
  // star popping read as "only the last one changed" when really the whole
  // rating up to that point is new. Restarts even on a repeat tap of the same
  // value (reflow trick); a setTimeout removes the class rather than relying
  // on `animationend`, matching this app's existing tap-feedback idiom (see
  // list-item's done-celebrate ring) so a reduced-motion environment (where
  // the animation never runs at all) can't leave the class stuck.
  _popStars(aspect, value) {
    const group = this.shadowRoot.querySelector(`.star-group[data-aspect="${aspect}"]`);
    if (!group) return;
    clearTimeout(this._popTimers[aspect]);
    const popped = [];
    group.querySelectorAll('.star-btn').forEach(btn => {
      if (Number(btn.dataset.value) > value) return;
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
      popped.push(btn);
    });
    this._popTimers[aspect] = setTimeout(() => popped.forEach(btn => btn.classList.remove('pop')), POP_DURATION_MS);
  }

  _renderLiveScore() {
    const score = aggregateScore({ scores: this._scores });
    this._liveScoreEl.hidden = score == null;
    this._liveScoreEl.textContent = score != null ? t('year-header.reflection-score', { score: score.toFixed(1) }) : '';
  }

  _renderVisibilityBtn() {
    this._visibilityBtn.setAttribute('aria-pressed', String(this._visible));
    this._visibilityBtn.textContent = t(this._visible ? 'reflection.hide' : 'reflection.show');
  }

  // Pre-fills from `reflection` (the store's reflections[year], or null/undefined
  // for a year with no report yet) and opens. Individual edits commit immediately
  // (star tap/keyboard move, comment blur, visibility toggle) via the events
  // above — this component never itself decides when to persist.
  open(reflection = null) {
    this._scores          = { ...(reflection?.scores ?? {}) };
    this._initialComment  = reflection?.comment ?? '';
    this._commentInput.value = this._initialComment;
    this._visible = reflection?.showCard !== false;
    REFLECTION_ASPECTS.forEach(a => this._renderGroup(a.key));
    this._renderLiveScore();
    this._renderVisibilityBtn();
    this._dialog.show();
  }
}

customElements.define('reflection-dialog', ReflectionDialog);
