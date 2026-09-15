import { t } from '../../core/strings.js';

const SWIPE_THRESHOLD = 60;
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
      touch-action: manipulation;
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
  // Capture is deferred until movement crosses DRAG_CONFIRM_THRESHOLD — same
  // reasoning as the gesture mixin (modules/gestures/gestures.js): capturing
  // immediately on pointerdown redirects the resulting click to `el`, which
  // would silently break the action/close button (a child of `el`) on a
  // plain press-and-release. Deferring means a tap on that button never
  // triggers capture at all, regardless of what's nested inside the toast —
  // no need to enumerate "interactive" elements to exclude.
  const DRAG_CONFIRM_THRESHOLD = 10;
  let dragStartX = null;
  let dragConfirmed = false;

  const onDragMove = e => {
    const dx = e.clientX - dragStartX;
    if (!dragConfirmed) {
      if (Math.abs(dx) <= DRAG_CONFIRM_THRESHOLD) return;
      dragConfirmed = true;
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
    const wasConfirmed = dragConfirmed;
    dragStartX = null;
    dragConfirmed = false;
    if (!wasConfirmed) return; // plain tap/click — never captured, let it reach its real target
    if (Math.abs(dx) > SWIPE_THRESHOLD) dismiss({ swipeDx: dx });
    else springBack();
  }

  function onDragCancel() {
    const wasConfirmed = dragConfirmed;
    removeDragListeners();
    dragStartX = null;
    dragConfirmed = false;
    if (wasConfirmed) springBack();
  }

  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragStartX = e.clientX;
    dragConfirmed = false;
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
