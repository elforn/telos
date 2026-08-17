import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';
import { icons } from '../../icons.js';
import { tagStrip } from '../../utils/tag-color.js';
import { urgencyOf } from '../../utils/urgency.js';
import { urgencyBadgeMarkup, urgencyBadgeStyles } from '../../utils/urgency-badge.js';
import { markDelete } from '../../utils/delete-ghost-guard.js';
import { percentValue, isFrequency, recentDots, isLoggedOn, currentPeriodCount } from '../../utils/tracking.js';

const REVEAL_WIDTH = 60;
const COMMIT_RATIO = 2.0;  // fraction of reveal width needed to commit
const COMMIT_VELOCITY = 0.35; // px/ms — fast flick commits regardless
const SWIPE_DEAD_ZONE = 15;   // px of drag before bar starts moving

// Frequency "today" token geometry — a 40px box (== --touch-target) holding a
// 30px dot with room for a 2px gap to the ring around it. Weekly renders the
// ring/dot as a true circle (rx = half the box); monthly as a soft square —
// shape is the only thing on the row that says which unit you're looking at.
const TODAY_BOX = 40;
const TODAY_RING_SIZE = 34;   // the <rect>'s width/height, inset within TODAY_BOX
const TODAY_RING_INSET = (TODAY_BOX - TODAY_RING_SIZE) / 2;
const TODAY_RING_RX = { weekly: TODAY_RING_SIZE / 2, monthly: 8 };

class GoalItem extends Gestures(AppElement) {
  set goal(value) {
    this._goal = value;
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

        .action-btn svg { pointer-events: none; }

        .delete-btn {
          inset-inline-end: 0;
          background: var(--color-danger);
        }

        .bar {
          position: relative;
          z-index: 1;
          block-size: var(--goal-item-height, 44px);
          background: var(--color-surface);
          border: 0.5px solid var(--color-border);
          overflow: hidden;
          display: flex;
          align-items: center;
          padding-inline: var(--space-3);
          cursor: pointer;
          user-select: none;
          touch-action: pan-y;
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

        .content {
          position: relative;
          z-index: 1;
          flex: 1;
          min-inline-size: 0;
          overflow: hidden;
        }

        .title {
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tag-strip {
          position: absolute;
          inset-block-end: 0;
          inset-inline-start: var(--space-10);
          inset-inline-end: var(--space-4);
          block-size: 3px;
          pointer-events: none;
          z-index: 2;
          display: var(--tag-strip-display, block);
        }

        .desc-icon {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          color: var(--color-text-muted);
          display: none;
          line-height: 1;
          margin-inline-start: var(--space-1);
        }

        .desc-icon svg {
          display: block;
          inline-size: var(--icon-size-sm);
          block-size: var(--icon-size-sm);
        }

        .bar[data-has-desc="true"] .desc-icon { display: block; }

        /* Deadline calendar — shared with list-item's due-date badge, see
           app/utils/urgency-badge.js. Gated by --goal-deadline-display so the
           year menu can hide it for non-current years (default on for the
           current year — set by year-header); list-item's due-date badge is
           never gated this way. */
        .urgency-icon { margin-inline-start: var(--space-1); }
        ${urgencyBadgeStyles('var(--goal-deadline-display, block)')}

        /* ── Frequency goals: dot-strip + today token ────────────────────
           Replaces the pct-label's slot — hold-drag scrub has no meaning
           here, so that space becomes a read-only glance strip instead. */

        .freq-cluster {
          position: relative;
          z-index: 1;
          display: none;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
          margin-inline-start: var(--space-2);
        }

        .bar[data-freq="true"] .freq-cluster { display: flex; }
        .bar[data-freq="true"] .pct-label { display: none; }

        /* Bare <span>, so it defaults to display:inline — width/height (and
           their logical equivalents) are spec-ignored on inline, non-replaced
           boxes. Without this, every history dot renders at zero effective
           size: invisible, not just "hard to see". (.freq-today's children
           escape the same trap only because grid/flex children get
           auto-blockified regardless of their own declared display.) */
        .freq-dots {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .freq-dot {
          inline-size: 13px;
          block-size: 13px;
          border-radius: var(--radius-full);
          background: var(--color-border);
          flex-shrink: 0;
        }
        .freq-dot.met { background: var(--color-accent); }
        .freq-dot.partial {
          background: conic-gradient(var(--color-accent) var(--frac, 50%), var(--color-border) 0);
        }
        .bar[data-freq-type="monthly"] .freq-dot { border-radius: 5px; }

        .freq-today {
          position: relative;
          inline-size: ${TODAY_BOX}px;
          block-size: ${TODAY_BOX}px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
        }

        .freq-today .freq-dot {
          inline-size: 30px;
          block-size: 30px;
        }
        .bar[data-freq-type="monthly"] .freq-today .freq-dot {
          inline-size: 24px;
          block-size: 24px;
          border-radius: 6px;
        }

        /* Plain complete stroke, no sweep animation — the 500ms hold is
           confirmed all at once (a single setTimeout in the gestures mixin,
           no intermediate progress callback), so there's nothing to animate
           mid-hold; the ring just appears once logged. */
        .freq-ring {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .freq-today.logged .freq-ring { opacity: 1; }
        .freq-ring .progress { fill: none; stroke: var(--color-success); stroke-width: 2; }

        /* Small tick — every successful log. Same recipe as list-item's own
           done-celebrate (outline pulse + background wash), just retargeted
           at this component's .bar instead of a shared .row class. Reserved
           for the ROUTINE action; the big particle-burst .celebrating above
           stays for the rare "whole window met" moment (percentValue hits
           100 only when every period in the window is fully met — same
           crossing check as the percentage case, no separate detection). */
        @keyframes log-ring {
          0%   { outline-color: transparent; }
          30%  { outline-color: color-mix(in srgb, var(--color-accent) 60%, transparent); }
          100% { outline-color: transparent; }
        }
        @keyframes log-wash {
          0%   { background: var(--color-surface); }
          25%  { background: color-mix(in srgb, var(--color-accent) 30%, var(--color-surface)); }
          100% { background: var(--color-surface); }
        }
        :host(.log-tick) .bar {
          outline: 3px solid transparent;
          outline-offset: 1px;
          animation: log-ring 500ms ease-out, log-wash 500ms ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          :host(.log-tick) .bar { animation: none; outline: none; }
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

        .drag-btn {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          background: none;
          border: none;
          cursor: grab;
          color: var(--color-text-muted);
          opacity: 0.45;
          font-size: var(--font-size-body);
          display: flex;
          align-items: center;
          justify-content: center;
          padding-block: 0;
          padding-inline: 0 2px;
          margin-inline-start: -5px;
          font-family: var(--font-family);
          touch-action: none;
        }

        :host(.hold-active) .bar {
          box-shadow: 0 0 0 2px var(--color-accent);
        }

        .archive-dot {
          display: none;
          position: absolute;
          inset-block-start: 50%;
          transform: translateY(-50%);
          inset-inline-start: calc(var(--space-1) * 1.3);
          inline-size: var(--space-1);
          block-size: var(--space-1);
          border-radius: var(--radius-full);
          background: var(--color-accent);
          z-index: 0;
          opacity: 0.2;
          pointer-events: none;
          user-select: none;
        }

        :host([data-archived="true"]) .archive-dot {
          display: block;
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

        /* ── Particle bursts ─────────────────────────────────────────────────── */

        :host(.celebrating)::before,
        :host(.celebrating)::after {
          content: '';
          position: absolute;
          width: 0;
          height: 0;
          top: 50%;
          left: 50%;
          pointer-events: none;
          z-index: 10;
        }

        :host(.celebrating)::before {
          animation: burst-1 1500ms ease-out forwards;
          transform: rotate(var(--b1-rot, 0deg)) scale(var(--b-scale, 1));
          border-radius: var(--b1-radius, 50%);
        }

        :host(.celebrating)::after {
          animation: burst-2 1500ms var(--b2-delay, 120ms) ease-out forwards;
          transform: rotate(var(--b2-rot, 0deg)) scale(var(--b-scale, 1));
          border-radius: var(--b2-radius, 50%);
        }

        @keyframes burst-1 {
          0% {
            opacity: 1;
            box-shadow:
              -175px 0px 0 5px #FFFFFF,
              -142px 0px 0 5px var(--color-accent),
              -110px 0px 0 5px var(--color-accent-dark),
               -77px 0px 0 5px #FFFFFF,
               -44px 0px 0 5px var(--color-accent),
               -11px 0px 0 5px var(--color-accent-dark),
                21px 0px 0 5px #FFFFFF,
                54px 0px 0 5px var(--color-accent),
                87px 0px 0 5px var(--color-accent-dark),
               120px 0px 0 5px #FFFFFF,
               152px 0px 0 5px var(--color-accent),
               185px 0px 0 5px var(--color-accent-dark);
          }
          60% {
            opacity: 0.85;
            box-shadow:
              -175px -50px 0 4px #FFFFFF,
              -142px -68px 0 4px var(--color-accent),
              -110px -57px 0 4px var(--color-accent-dark),
               -77px -75px 0 4px #FFFFFF,
               -44px -63px 0 4px var(--color-accent),
               -11px -51px 0 4px var(--color-accent-dark),
                21px -70px 0 4px #FFFFFF,
                54px -58px 0 4px var(--color-accent),
                87px -76px 0 4px var(--color-accent-dark),
               120px -64px 0 4px #FFFFFF,
               152px -53px 0 4px var(--color-accent),
               185px -71px 0 4px var(--color-accent-dark);
          }
          100% {
            opacity: 0;
            box-shadow:
              -175px  -78px 0 2px #FFFFFF,
              -142px -102px 0 2px var(--color-accent),
              -110px  -87px 0 2px var(--color-accent-dark),
               -77px -111px 0 2px #FFFFFF,
               -44px  -95px 0 2px var(--color-accent),
               -11px  -80px 0 2px var(--color-accent-dark),
                21px -104px 0 2px #FFFFFF,
                54px  -88px 0 2px var(--color-accent),
                87px -113px 0 2px var(--color-accent-dark),
               120px  -97px 0 2px #FFFFFF,
               152px  -81px 0 2px var(--color-accent),
               185px -106px 0 2px var(--color-accent-dark);
          }
        }

        @keyframes burst-2 {
          0% {
            opacity: 1;
            box-shadow:
              -155px 0px 0 5px var(--color-accent),
              -126px 0px 0 5px #FFFFFF,
               -97px 0px 0 5px var(--color-accent-dark),
               -68px 0px 0 5px var(--color-accent),
               -39px 0px 0 5px #FFFFFF,
               -10px 0px 0 5px var(--color-accent-dark),
                20px 0px 0 5px var(--color-accent),
                49px 0px 0 5px #FFFFFF,
                78px 0px 0 5px var(--color-accent-dark),
               107px 0px 0 5px var(--color-accent),
               136px 0px 0 5px #FFFFFF,
               165px 0px 0 5px var(--color-accent-dark);
          }
          60% {
            opacity: 0.85;
            box-shadow:
              -155px -57px 0 4px var(--color-accent),
              -126px -75px 0 4px #FFFFFF,
               -97px -63px 0 4px var(--color-accent-dark),
               -68px -51px 0 4px var(--color-accent),
               -39px -70px 0 4px #FFFFFF,
               -10px -58px 0 4px var(--color-accent-dark),
                20px -76px 0 4px var(--color-accent),
                49px -64px 0 4px #FFFFFF,
                78px -53px 0 4px var(--color-accent-dark),
               107px -71px 0 4px var(--color-accent),
               136px -59px 0 4px #FFFFFF,
               165px -77px 0 4px var(--color-accent-dark);
          }
          100% {
            opacity: 0;
            box-shadow:
              -155px  -87px 0 2px var(--color-accent),
              -126px -111px 0 2px #FFFFFF,
               -97px  -95px 0 2px var(--color-accent-dark),
               -68px  -80px 0 2px var(--color-accent),
               -39px -104px 0 2px #FFFFFF,
               -10px  -88px 0 2px var(--color-accent-dark),
                20px -113px 0 2px var(--color-accent),
                49px  -97px 0 2px #FFFFFF,
                78px  -81px 0 2px var(--color-accent-dark),
               107px -106px 0 2px var(--color-accent),
               136px  -90px 0 2px #FFFFFF,
               165px -115px 0 2px var(--color-accent-dark);
          }
        }

        @keyframes peek-hint {
          0%   { transform: translateX(0); }
          30%  { transform: translateX(-18px); }
          70%  { transform: translateX(0); }
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
          :host(.celebrating)::before { animation: none; }
          :host(.celebrating)::after  { animation: none; }
          :host(.peek-hint) .bar { animation: none; }
          :host(.pop-confirm) { animation: none; }
        }
      </style>

      <button class="action-btn delete-btn" id="delete-btn" aria-label="${t('goal-item.delete')}">${icons.trash}</button>
      <div class="bar"
           tabindex="0"
           role="slider"
           aria-label=""
           aria-valuemin="0"
           aria-valuemax="100"
           aria-valuenow="0">
        <div class="fill" style="width:0%"></div>
        <span class="archive-dot" aria-hidden="true"></span>
        <button class="drag-btn" id="drag-btn" type="button" aria-label=""></button>
        <span class="content">
          <span class="title"></span>
        </span>
        <span class="tag-strip" aria-hidden="true"></span>
        <span class="desc-icon" aria-hidden="true">${icons.info}</span>
        ${urgencyBadgeMarkup}
        <span class="pct-label" hidden></span>
        <span class="freq-cluster" aria-hidden="true">
          <span class="freq-dots"></span>
          <span class="freq-today">
            <span class="freq-dot"></span>
            <svg class="freq-ring" viewBox="0 0 ${TODAY_BOX} ${TODAY_BOX}" width="${TODAY_BOX}" height="${TODAY_BOX}">
              <rect class="progress" x="${TODAY_RING_INSET}" y="${TODAY_RING_INSET}" width="${TODAY_RING_SIZE}" height="${TODAY_RING_SIZE}" rx="${TODAY_RING_SIZE / 2}"></rect>
            </svg>
          </span>
        </span>
      </div>
    `;
  }

  subscribe() {
    this.setAttribute('role', 'listitem');
    this._bar = this.shadowRoot.querySelector('.bar');
    this._fill = this.shadowRoot.querySelector('.fill');
    this._title = this.shadowRoot.querySelector('.title');
    this._stripEl = this.shadowRoot.querySelector('.tag-strip');
    this._pctLabel = this.shadowRoot.querySelector('.pct-label');
    this._freqDots = this.shadowRoot.querySelector('.freq-dots');
    this._freqToday = this.shadowRoot.querySelector('.freq-today');
    this._freqTodayDot = this._freqToday.querySelector('.freq-dot');
    this._freqRing = this.shadowRoot.querySelector('.freq-ring .progress');
    this._revealedDir = null;
    this._wasLoggedToday = undefined; // undefined (not false) so the first _update() never ticks — mirrors _celebrate()'s prevPct guard below

    this._update();

    this._stopPointerDown = e => e.stopPropagation();

    this._deleteEl = this.shadowRoot.querySelector('#delete-btn');

    // useDelay: rAF lets the browser's synthesized click fire on the still-present button before DOM removal
    this._onDeleteBtn = (useDelay = false) => {
      const fire = () => {
        this.dispatchEvent(new CustomEvent('goal-delete', {
          bubbles: true, composed: true, detail: { goal: this._goal },
        }));
        this._closeReveal();
      };
      if (useDelay) requestAnimationFrame(fire);
      else fire();
    };
    // Delete fires on pointerup; note the time so the add row (which shifts up
    // when the last goal is removed) can ignore the touch's synthesized click.
    this._onDeletePointerUp = e => { e.stopPropagation(); e.preventDefault(); markDelete(); this._onDeleteBtn(true); };
    this._onDeleteBtnKey = e => { e.stopPropagation(); if (e.detail === 0) this._onDeleteBtn(); };
    this._deleteEl.addEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl.addEventListener('pointerup', this._onDeletePointerUp);
    this._deleteEl.addEventListener('click', this._onDeleteBtnKey);

    this._onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._tap(); }
      if (e.key === 'ArrowRight') this.onHoldDragKey('right');
      if (e.key === 'ArrowLeft') this.onHoldDragKey('left');
    };
    this._bar.addEventListener('keydown', this._onKeyDown);

    this._dragBtn = this.shadowRoot.querySelector('#drag-btn');
    this._dragBtn.setAttribute('aria-label', t('goal-item.drag'));
    this._dragBtn.innerHTML = icons.grip;
    this._onDragBtnDown = e => {
      e.stopPropagation();
      this._dragBtn.setPointerCapture(e.pointerId);
      this.dispatchEvent(new CustomEvent('goal-drag-start', {
        bubbles: true, composed: true,
        detail: { goal: this._goal, element: this, startX: e.clientX, startY: e.clientY },
      }));
    };
    this._onDragBtnKey = e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('goal-reorder-key', {
        bubbles: true, composed: true,
        detail: { goal: this._goal, direction: e.key === 'ArrowUp' ? -1 : 1 },
      }));
    };
    this._dragBtn.addEventListener('pointerdown', this._onDragBtnDown);
    this._dragBtn.addEventListener('keydown', this._onDragBtnKey);
  }

  unsubscribe() {
    this._deleteEl?.removeEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl?.removeEventListener('pointerup', this._onDeletePointerUp);
    this._deleteEl?.removeEventListener('click', this._onDeleteBtnKey);
    this._bar?.removeEventListener('keydown', this._onKeyDown);
    this._dragBtn?.removeEventListener('pointerdown', this._onDragBtnDown);
    this._dragBtn?.removeEventListener('keydown', this._onDragBtnKey);
  }

  // ── Gestures ──────────────────────────────────────────────────────────────

  // The "today" token is the one part of a frequency row where a plain tap
  // (not a hold) toggles the log — it's the row's primary action target, so
  // it shouldn't cost a 500ms dwell. Everywhere else on the bar, tap still
  // opens the goal dialog and hold still toggles (see onHoldDragStart below).
  onTap(e) {
    if (this._revealedDir) {
      this._closeReveal();
      return;
    }
    if (isFrequency(this._goal) && e?.originalEvent?.composedPath().includes(this._freqToday)) {
      this._toggleLog();
      return;
    }
    this._tap();
  }

  // Frequency goals have no continuous value to scrub — the 500ms dwell that
  // starts a percentage-goal's hold-drag instead commits a log toggle
  // immediately (the gestures mixin fires onHoldDragStart exactly once, at
  // dwell-confirmation, with a free haptic buzz already built in — nothing
  // to animate mid-hold, so unlike the percentage case there's no drag phase
  // to enter). onHoldDrag/onHoldDragEnd are no-ops for this type: the action
  // already happened at the start. This still fires for a hold anywhere on
  // the bar, including the "today" token — the token's plain-tap shortcut
  // above doesn't remove the hold path, it adds a faster one.

  onHoldDragStart() {
    this._closeReveal();
    if (isFrequency(this._goal)) { this._toggleLog(); return; }
    this.classList.add('hold-active');
    this._bar.style.transition = 'none';
    this._setDragMode(true);
  }

  onHoldDragKey(dir) {
    if (isFrequency(this._goal)) { this._toggleLog(); return; } // either arrow — it's a toggle, not a scrub
    this._setPct(dir === 'right' ? Math.min(100, this._pct + 5) : Math.max(0, this._pct - 5));
    if (this._pct === 100) this._celebrate();
    this._emitProgress();
  }

  onHoldDrag(e) {
    if (isFrequency(this._goal)) return;
    const rect = this._bar.getBoundingClientRect();
    if (!rect.width) return;
    const pct = Math.round(Math.max(0, Math.min(100, (e.endX - rect.left) / rect.width * 100)));
    this._setPct(pct);
  }

  onHoldDragEnd() {
    if (isFrequency(this._goal)) return;
    this.classList.remove('hold-active');
    this._bar.style.transition = '';
    this._setDragMode(false);
    if (this._pct === 100) this._celebrate();
    this._emitProgress();
  }

  _gestureCancel(e) {
    if (this._gesture?.phase === 'swipe') this._closeReveal();
    super._gestureCancel(e);
  }

  onSwipeMove(e) {
    this._bar.style.transition = 'none';
    let offset;
    if (this._revealedDir === 'left') {
      offset = Math.min(0, -REVEAL_WIDTH + e.dx);
    } else {
      const dx = e.dx < 0 ? Math.min(0, e.dx + SWIPE_DEAD_ZONE) : 0;
      offset = Math.max(-REVEAL_WIDTH, dx);
    }
    this._bar.style.transform = `translateX(${offset}px)`;
  }

  onSwipe(e) {
    if (this._revealedDir) {
      this._closeReveal();
      return;
    }

    const commit = e.distance >= REVEAL_WIDTH * COMMIT_RATIO || e.velocity >= COMMIT_VELOCITY;

    if (commit && e.direction === 'left') {
      this._bar.style.transform = `translateX(-${REVEAL_WIDTH}px)`;
      this._revealedDir = 'left';
    } else {
      this._closeReveal(); // _closeReveal sets its own spring transition
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _tap() {
    this.dispatchEvent(new CustomEvent('goal-tap', {
      bubbles: true, composed: true, detail: { goal: this._goal },
    }));
  }

  _closeReveal() {
    this._bar.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
    this._bar.style.transform = '';
    this._revealedDir = null;
  }

  _setPct(pct) {
    this._pct = Math.max(0, Math.min(100, pct));
    this._fill.style.width = `${this._pct}%`;
    if (!isFrequency(this._goal)) this._bar.setAttribute('aria-valuenow', String(this._pct));
    if (this._pctLabel) this._pctLabel.textContent = `${this._pct}%`;
  }

  _setDragMode(active) {
    this._title.hidden = active;
    this._pctLabel.hidden = !active;
  }

  // Toggling is the row's one frequency action, reachable by hold or by
  // Left/Right arrow — dispatched upward, same shape as _emitProgress(),
  // because the store mutation lives in the page, not the component.
  _toggleLog() {
    this.dispatchEvent(new CustomEvent('goal-log-toggle', {
      bubbles: true, composed: true, detail: { goal: this._goal },
    }));
  }

  // Small tick — every successful log. See the .log-tick keyframes above for
  // why this is a separate, quieter thing from ._celebrate()'s particle burst.
  // setTimeout rather than animationend, matching _celebrate() below — under
  // prefers-reduced-motion the animation is `none`, so animationend would
  // never fire and the class would stick until the next toggle force-removed it.
  _logTick() {
    clearTimeout(this._logTickTimer);
    this.classList.remove('log-tick');
    void this.offsetWidth; // force reflow so a rapid re-log restarts the animation
    this.classList.add('log-tick');
    this._logTickTimer = setTimeout(() => this.classList.remove('log-tick'), 500);
  }

  _emitProgress() {
    this.dispatchEvent(new CustomEvent('goal-progress', {
      bubbles: true, composed: true, detail: { percentage: this._pct, goal: this._goal },
    }));
  }

  _celebrate() {
    this._fill.classList.add('celebrate');
    this._fill.addEventListener('animationend', () => this._fill.classList.remove('celebrate'), { once: true });
    const r = (a, b) => +(a + Math.random() * (b - a)).toFixed(1);
    const shape = () => ['50%', '50%', '20%', '0%'][Math.floor(Math.random() * 4)];
    this.style.setProperty('--b1-rot', `${r(-20, 20)}deg`);
    this.style.setProperty('--b2-rot', `${r(-20, 20)}deg`);
    this.style.setProperty('--b-scale', `${r(0.82, 1.18)}`);
    this.style.setProperty('--b2-delay', `${Math.round(80 + Math.random() * 120)}ms`);
    this.style.setProperty('--b1-radius', shape());
    this.style.setProperty('--b2-radius', shape());
    this.classList.add('celebrating');
    // Use setTimeout rather than animationend — multiple animations run on :host
    // (goal-ring 700ms, burst-1 1500ms, burst-2 1500ms+120ms delay) and we
    // must keep .celebrating alive until the last one finishes.
    setTimeout(() => this.classList.remove('celebrating'), 1700);
  }

  _update() {
    if (!this._bar) return;
    const isFreq = isFrequency(this._goal);
    const pct = percentValue(this._goal);
    const prevPct = this._pct;
    this._pct = Math.max(0, pct);
    const title = this._goal?.title ?? '';
    const active = this._pct < 100 && !this._goal?.archived;
    const urgency = urgencyOf(this._goal?.dueDate, active);
    this._title.textContent = title;

    let label = urgency === 'none' ? title : t('goal-item.duedate-aria', { title, when: t(`urgency.${urgency}`) });
    if (isFreq) {
      const { type, target } = this._goal.tracking;
      const count = currentPeriodCount(this._goal.tracking);
      label = t(`goal-item.freq-aria-${type}`, { title: label, count, target });
      if (isLoggedOn(this._goal)) label += t('goal-item.freq-logged-suffix');
    }
    this._bar.setAttribute('aria-label', label);

    this._bar.dataset.hasDesc = String(!!this._goal?.notes);
    this.dataset.archived = String(!!this._goal?.archived);
    this.dataset.urgency = urgency;
    this._setPct(this._pct);
    if (this._pct === 100 && prevPct !== undefined && prevPct < 100) this._celebrate();
    if (this._stripEl) {
      const bg = tagStrip(this._goal?.tags ?? []);
      this._stripEl.style.background = bg;
      this._stripEl.hidden = !bg;
    }

    // role="slider" only makes sense for a continuous, draggable value — a
    // frequency goal's row is closer to a toggle (hold logs/unlogs today),
    // so it drops the slider role and its min/max/now triad entirely rather
    // than carry attributes that would misdescribe it.
    this._bar.setAttribute('role', isFreq ? 'button' : 'slider');
    if (isFreq) {
      this._bar.removeAttribute('aria-valuemin');
      this._bar.removeAttribute('aria-valuemax');
      this._bar.removeAttribute('aria-valuenow');
      this._bar.setAttribute('aria-pressed', String(isLoggedOn(this._goal)));
    } else {
      this._bar.setAttribute('aria-valuemin', '0');
      this._bar.setAttribute('aria-valuemax', '100');
      this._bar.removeAttribute('aria-pressed');
    }

    this._bar.dataset.freq = String(isFreq);
    if (isFreq) {
      this._bar.dataset.freqType = this._goal.tracking.type;
      this._renderFreqCluster();
    }
  }

  // Dot-strip (read-only, whatever recentDots() returns — up to DOT_WINDOW[type]
  // history dots, trimmed at the front so a losing streak that runs the whole
  // window doesn't visually anchor the row) + the "today" token (bigger,
  // doubles as the hold target — see .freq-today above). One shared shape
  // per goal: circle for weekly, soft square for monthly. No length
  // assumptions here on purpose — the trim/window sizing lives entirely in
  // tracking.js, this component just renders however many dots come back.
  _renderFreqCluster() {
    const dots = recentDots(this._goal);
    const history = dots.slice(0, -1);
    const today = dots[dots.length - 1];

    this._freqDots.replaceChildren(...history.map(d => {
      const el = document.createElement('span');
      el.className = 'freq-dot' + (d.state === 'met' ? ' met' : d.state === 'partial' ? ' partial' : '');
      if (d.state === 'partial') el.style.setProperty('--frac', `${Math.round(d.fraction * 100)}%`);
      return el;
    }));

    this._freqTodayDot.className = 'freq-dot' + (today.state === 'met' ? ' met' : today.state === 'partial' ? ' partial' : '');
    if (today.state === 'partial') this._freqTodayDot.style.setProperty('--frac', `${Math.round(today.fraction * 100)}%`);
    else this._freqTodayDot.style.removeProperty('--frac');

    const rx = TODAY_RING_RX[this._goal.tracking.type];
    this._freqRing.setAttribute('rx', rx);

    const logged = isLoggedOn(this._goal);
    this._freqToday.classList.toggle('logged', logged);
    if (this._wasLoggedToday !== undefined && logged && !this._wasLoggedToday) this._logTick();
    this._wasLoggedToday = logged;
  }
}

customElements.define('goal-item', GoalItem);
