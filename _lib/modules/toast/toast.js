import { t } from '../../core/strings.js';
import { attachScrollClaim, dominantAxis } from '../../core/scroll-claim.js';

const SWIPE_THRESHOLD = 120; // calibrated on-device — 60 dismissed too easily on a real swipe
const TAP_THRESHOLD = 18; // matches modules/gestures/gestures.js's own constant
const DISMISS_DURATION = 200; // fallback when transitionend doesn't fire
const DRAG_TRANSITION = 'transform var(--duration-fast, 120ms) ease, opacity var(--duration-fast, 120ms) ease';

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let container = null;
let stylesInjected = false;
let activeToast = null;
let containerOpen = false;

function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    #toast-container {
      position: fixed;
      inset: auto;
      inset-block-end: calc(var(--space-4, 16px) + var(--safe-area-bottom, 0px));
      inset-inline-start: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      gap: var(--space-2, 8px);
      z-index: 9999;
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      overflow: visible;
      pointer-events: none;
    }
    #toast-container:not(:popover-open) { display: none; }
    .socle-toast {
      padding: var(--space-2, 8px) var(--space-4, 16px);
      border-radius: var(--radius-full, 9999px);
      font-size: var(--font-size-body, 1rem);
      font-family: var(--font-family, sans-serif);
      font-weight: var(--font-weight-medium, 500);
      line-height: var(--line-height-normal, 1.5);
      box-shadow: var(--shadow-sheet);
      pointer-events: auto;
      white-space: nowrap;
      /* Not 'manipulation': that leaves pan-x with the browser, so Chrome's
         compositor arbitration can commit to native panning before any JS runs
         and fire pointercancel mid-drag — on-device, swipe-to-dismiss did not
         work at all under 'manipulation'. But not 'none' either, which was the
         previous fix here: taking both axes means a flick still starts a fling
         that has nothing to move, so it runs invisibly and spends the user's
         next tap cancelling itself. pan-y removes pan-x (which is what makes the
         swipe reliable) while leaving vertical with the browser, so the page can
         still be scrolled with a finger that lands on a toast. The horizontal
         axis is then claimed explicitly — see core/scroll-claim.js. */
      touch-action: pan-y pinch-zoom;
      animation: socle-toast-in var(--duration-normal, 220ms) var(--ease-out, ease);
    }
    .socle-toast-out {
      opacity: 0;
      transform: translateY(4px);
      transition: opacity var(--duration-fast, 120ms) ease,
                  transform var(--duration-fast, 120ms) ease;
      pointer-events: none;
    }
    .socle-toast-has-btn {
      border-radius: var(--radius-lg, 20px);
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
    }
    .socle-toast-msg {
      flex: 1;
    }
    .socle-toast-btn {
      color: inherit;
      font-weight: var(--font-weight-semibold, 600);
      font-size: inherit;
      font-family: inherit;
      line-height: inherit;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      white-space: nowrap;
    }
    .socle-toast-info .socle-toast-btn {
      color: var(--color-accent);
    }
    .socle-toast-info    { background: var(--color-action-dark, #1C1C1E); color: var(--color-on-dark, rgba(255,255,255,0.85)); }
    .socle-toast-success { background: var(--color-success, #3D9A6E);     color: #fff; }
    .socle-toast-error   { background: var(--color-danger, #E53535);       color: #fff; }
    @keyframes socle-toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .socle-toast { animation: none; }
      .socle-toast-out { transition: none; }
    }
  `;
  document.head.appendChild(s);
}

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    container.setAttribute('popover', 'manual');
    document.body.appendChild(container);
  }
  return container;
}

// Show (or re-show) the container as a manual popover so it enters the top
// layer above any open <dialog>. Top-layer order follows show order, so
// re-showing on every toast keeps it above a dialog that opened after it.
// Feature-detected — environments without the Popover API (happy-dom) fall
// back to the plain fixed-position container.
function raiseContainer(c) {
  if (typeof c.showPopover !== 'function') return;
  if (containerOpen) { try { c.hidePopover(); } catch { /* already hidden */ } }
  try { c.showPopover(); containerOpen = true; } catch { /* not connected */ }
}

export function toast(message, type = 'info', { duration, action } = {}) {
  activeToast?.dismiss({ instant: true });

  ensureStyles();
  const c = getContainer();
  raiseContainer(c);

  const hasAction = !!action;
  const persistent = duration === Infinity;
  const showBtn = hasAction || persistent;
  const defaultDuration = hasAction ? 5000 : 4000;
  const effectiveDuration = persistent ? Infinity : (duration ?? defaultDuration);

  const el = document.createElement('div');
  let currentType = type;
  el.className = `socle-toast socle-toast-${type}${showBtn ? ' socle-toast-has-btn' : ''}`;
  el.setAttribute('role', 'status');

  const msgEl = document.createElement('span');
  msgEl.className = 'socle-toast-msg';
  msgEl.textContent = message;
  el.appendChild(msgEl);

  let btn;
  if (showBtn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'socle-toast-btn';
    btn.textContent = hasAction ? action.label : t('toast.close');
    el.appendChild(btn);
  }

  let timerId = null;
  let paused = false;
  let dismissed = false;
  let remaining = effectiveDuration;
  let timerStart = null;

  const onKeyDown = e => {
    if (e.key === 'Escape') dismiss();
  };

  const dismiss = ({ instant = false, swipeDx } = {}) => {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(timerId);
    removeScrollClaim();
    document.removeEventListener('keydown', onKeyDown);
    if (activeToast === handle) activeToast = null;

    if (instant || (swipeDx !== undefined && reducedMotion())) {
      el.remove();
      return;
    }

    const removeEl = () => { if (el.isConnected) el.remove(); };
    if (swipeDx !== undefined) {
      // Continue the swipe outward from wherever the drag left off, instead
      // of the default upward fade, so release reads as one continuous motion.
      el.style.transition = DRAG_TRANSITION;
      el.style.transform = `translateX(${swipeDx > 0 ? '120%' : '-120%'})`;
      el.style.opacity = '0';
    } else {
      el.classList.add('socle-toast-out');
    }
    el.addEventListener('transitionend', removeEl, { once: true });
    setTimeout(removeEl, DISMISS_DURATION);
  };

  const startTimer = () => {
    if (remaining === Infinity) return;
    timerStart = Date.now();
    timerId = setTimeout(dismiss, remaining);
  };

  const pauseTimer = () => {
    if (remaining === Infinity || paused) return;
    paused = true;
    clearTimeout(timerId);
    remaining -= Date.now() - timerStart;
  };

  const resumeTimer = () => {
    if (!paused) return;
    paused = false;
    startTimer();
  };

  if (btn) {
    btn.addEventListener('click', () => {
      if (hasAction) action.onClick();
      dismiss();
    });
  }

  el.addEventListener('mouseenter', pauseTimer);
  el.addEventListener('mouseleave', resumeTimer);
  el.addEventListener('focusin', pauseTimer);
  el.addEventListener('focusout', resumeTimer);
  document.addEventListener('keydown', onKeyDown);

  // Swipe-to-dismiss — pointer capture is essential here, not optional: without
  // it, a fast swipe that carries the pointer outside the toast's own bounds
  // never delivers pointerup back to `el`, so the gesture silently does
  // nothing. Follows the finger live (no transition while dragging) and
  // either continues the motion out (past SWIPE_THRESHOLD) or springs back.
  //
  // Direction-lock mirrors modules/gestures/gestures.js's own _gestureMove:
  // track dx AND dy from pointerdown, wait for the euclidean distance to
  // cross TAP_THRESHOLD before deciding anything (so a plain tap never
  // engages the gesture at all), then classify by whichever axis moved more.
  // A vertical-dominant move is 'cancelled' — never becomes a drag — so a
  // vertical swipe on the toast does nothing, rather than a confused partial
  // horizontal drag.
  //
  // Capture (and 'swipe' phase) only starts for a confirmed horizontal move.
  // This is also what keeps a plain press-and-release on the action/close
  // button from ever capturing the pointer: same reasoning as the gesture
  // mixin's own comment — capturing on pointerdown would redirect the
  // resulting click to `el`, breaking the button.
  let dragStartX = null;
  let dragStartY = null;
  let dragPhase = 'idle'; // 'idle' | 'tracking' | 'swipe' | 'cancelled'
  // Decided on its own, smaller threshold than the phase transition above: by the time
  // an 18px euclidean move is confirmed the browser has already committed, and a fling
  // it generates outlives the gesture to eat the next tap.
  let dragClaim; // 'x' = ours, 'browser' = conceded, undefined = undecided
  const removeScrollClaim = attachScrollClaim(el, () => dragClaim === 'x');

  const onDragMove = e => {
    if (dragClaim === undefined) dragClaim = dominantAxis(e.clientX - dragStartX, e.clientY - dragStartY);
    if (dragPhase === 'cancelled') return;
    const dx = e.clientX - dragStartX;
    if (dragPhase === 'tracking') {
      const dy = e.clientY - dragStartY;
      if (Math.sqrt(dx * dx + dy * dy) <= TAP_THRESHOLD) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        dragPhase = 'cancelled';
        return;
      }
      dragPhase = 'swipe';
      el.setPointerCapture(e.pointerId);
      el.style.transition = 'none';
    }
    el.style.transform = `translateX(${dx}px)`;
    el.style.opacity = String(Math.max(0.3, 1 - Math.abs(dx) / (SWIPE_THRESHOLD * 2)));
  };

  const removeDragListeners = () => {
    el.removeEventListener('pointermove', onDragMove);
    el.removeEventListener('pointerup', onDragEnd);
    el.removeEventListener('pointercancel', onDragCancel);
  };

  const springBack = () => {
    if (reducedMotion()) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
      return;
    }
    el.style.transition = DRAG_TRANSITION;
    el.style.transform = '';
    el.style.opacity = '';
    el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true });
  };

  function onDragEnd(e) {
    removeDragListeners();
    const dx = e.clientX - dragStartX;
    const wasSwipe = dragPhase === 'swipe';
    dragStartX = null;
    dragStartY = null;
    dragPhase = 'idle';
    dragClaim = undefined;
    if (!wasSwipe) return; // plain tap, or a vertical/cancelled move — never captured
    if (Math.abs(dx) > SWIPE_THRESHOLD) dismiss({ swipeDx: dx });
    else springBack();
  }

  function onDragCancel() {
    const wasSwipe = dragPhase === 'swipe';
    removeDragListeners();
    dragStartX = null;
    dragStartY = null;
    dragPhase = 'idle';
    dragClaim = undefined;
    if (wasSwipe) springBack();
  }

  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragPhase = 'tracking';
    dragClaim = undefined;
    el.addEventListener('pointermove', onDragMove);
    el.addEventListener('pointerup', onDragEnd);
    el.addEventListener('pointercancel', onDragCancel);
  });

  c.appendChild(el);
  startTimer();

  const update = ({ message: newMsg, type: newType } = {}) => {
    if (dismissed) return;
    if (newMsg !== undefined) msgEl.textContent = newMsg;
    if (newType !== undefined && newType !== currentType) {
      el.classList.replace(`socle-toast-${currentType}`, `socle-toast-${newType}`);
      currentType = newType;
    }
    clearTimeout(timerId);
    paused = false;
    remaining = hasAction ? 5000 : 4000;
    startTimer();
  };

  const handle = { dismiss, update };
  activeToast = handle;
  return handle;
}

// Reset for test isolation
export function _resetToast() {
  activeToast?.dismiss({ instant: true });
  container?.remove();
  container = null;
  stylesInjected = false;
  activeToast = null;
  containerOpen = false;
}
