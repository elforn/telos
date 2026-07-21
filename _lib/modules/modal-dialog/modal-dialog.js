import { AppElement } from '../../core/app-element.js';

const MOBILE_BREAKPOINT = 600;

// Swipe-down-to-dismiss thresholds (handle drag, sheet mode only).
const DISMISS_DISTANCE_RATIO = 0.25;      // commit when dragged past 25% of sheet height
const DISMISS_VELOCITY = 0.5;             // …or a downward flick faster than 0.5 px/ms
const DRAG_TRANSITION = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
const DRAG_FALLBACK_MS = 350;             // safety net if transitionend never fires

class ModalDialog extends AppElement {
  template() {
    return `
      <style>
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        dialog {
          border: none;
          border-radius: var(--radius-lg);
          padding: var(--space-6) var(--space-5);
          max-inline-size: min(90vw, 400px);
          inline-size: 100%;
          background: var(--color-surface);
          color: var(--color-text-primary);
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          box-shadow: var(--shadow-sheet);
          overscroll-behavior-y: contain;
        }

        dialog[open] {
          animation: fade-in 0.2s ease-out;
        }

        dialog::backdrop {
          background: var(--color-overlay);
          animation: fade-in 0.2s ease-out;
        }

        .handle { display: none; }

        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          dialog {
            position: fixed;
            inset-block-end: 0;
            inset-inline-start: 0;
            inset-block-start: auto;
            margin: 0;
            inline-size: 100%;
            max-inline-size: 100%;
            border-end-start-radius: 0;
            border-end-end-radius: 0;
            border-start-start-radius: var(--radius-lg);
            border-start-end-radius: var(--radius-lg);
            padding-block-end: calc(var(--space-6) + var(--safe-area-bottom, 0px));
          }

          dialog[open] {
            animation: slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          }

          .handle {
            display: flex;
            align-items: center;
            justify-content: center;
            inline-size: 100%;
            min-block-size: var(--space-8);
            margin-block-start: calc(-1 * var(--space-4));
            margin-block-end: calc(-1 * var(--space-4));
            position: relative;
            z-index: 1;
            touch-action: none;
          }

          .handle::before {
            content: '';
            inline-size: 36px;
            block-size: 4px;
            border-radius: var(--radius-full);
            background: var(--color-border);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          dialog[open],
          dialog::backdrop { animation: none; }
        }

        .footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-2);
          margin-block-start: var(--space-4);
        }
      </style>
      <dialog aria-modal="true">
        <div class="handle" aria-hidden="true"></div>
        <slot></slot>
        <div class="footer"><slot name="footer"></slot></div>
      </dialog>
    `;
  }

  subscribe() {
    this._dialog = this.shadowRoot.querySelector('dialog');
    this._handle = this.shadowRoot.querySelector('.handle');
    const label = this.getAttribute('aria-label');
    if (label) this._dialog.setAttribute('aria-label', label);

    this._onClose = () => {
      this._teardownDrag(); // tear down any in-flight handle drag when closed by any route
      this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
    };
    this._dialog.addEventListener('close', this._onClose);

    // Guard prevents the gesture that opened the dialog from immediately dismissing it.
    // Backdrop clicks (outside dialog box) have e.target === the dialog element itself.
    this._onBackdrop = e => { if (!this._justOpened && e.target === this._dialog) this.close(); };
    this._dialog.addEventListener('click', this._onBackdrop);

    // Collapse the footer wrapper when nothing is slotted into it (action sheets / menus),
    // so it contributes no margin or height. [hidden] collapses to display:none via the
    // base stylesheet's `[hidden] { display: none !important; }` rule.
    this._footer = this.shadowRoot.querySelector('.footer');
    this._footerSlot = this.shadowRoot.querySelector('slot[name="footer"]');
    this._onFooterSlotChange = () => {
      this._footer.hidden = this._footerSlot.assignedNodes({ flatten: true }).length === 0;
    };
    this._footerSlot.addEventListener('slotchange', this._onFooterSlotChange);
    this._onFooterSlotChange();

    // Swipe-down-to-dismiss on the handle only, so it never competes with scrolling
    // long slotted content. Per-drag move/up/cancel listeners are added on pointerdown
    // and removed on up/cancel — mirroring modules/gestures/ lifecycle management.
    this._onHandleDown = this._handleDown.bind(this);
    this._onHandleMove = this._handleMove.bind(this);
    this._onHandleUp = this._handleUp.bind(this);
    this._onHandleCancel = this._handleCancel.bind(this);
    this._handle.addEventListener('pointerdown', this._onHandleDown);
  }

  unsubscribe() {
    this._dialog?.removeEventListener('close', this._onClose);
    this._dialog?.removeEventListener('click', this._onBackdrop);
    this._handle?.removeEventListener('pointerdown', this._onHandleDown);
    this._footerSlot?.removeEventListener('slotchange', this._onFooterSlotChange);
    this._teardownDrag();
  }

  _isSheet() {
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
  }

  _reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  _handleDown(e) {
    if (e.button !== 0 || !this._isSheet()) return;
    this._handle.setPointerCapture(e.pointerId);
    this._drag = {
      startY: e.clientY,
      startTime: Date.now(),
      pointerId: e.pointerId,
      height: this._dialog.getBoundingClientRect().height,
    };
    this._dialog.style.transition = 'none';
    this._handle.addEventListener('pointermove', this._onHandleMove);
    this._handle.addEventListener('pointerup', this._onHandleUp);
    this._handle.addEventListener('pointercancel', this._onHandleCancel);
  }

  _handleMove(e) {
    if (!this._drag) return;
    // Follow the finger downward; clamp upward drags to rest so the sheet never rises.
    const dy = Math.max(0, e.clientY - this._drag.startY);
    this._dialog.style.transform = `translateY(${dy}px)`;
  }

  _handleUp(e) {
    const d = this._drag;
    if (!d) return;
    this._removeDragListeners();
    this._drag = null;

    const dy = e.clientY - d.startY;
    const elapsed = Date.now() - d.startTime;
    const velocity = elapsed > 0 ? dy / elapsed : 0;
    const commit = dy > d.height * DISMISS_DISTANCE_RATIO || velocity > DISMISS_VELOCITY;

    if (this._reducedMotion()) {
      this._clearDragStyles();
      if (commit) this.close();
      return;
    }

    if (commit) this._commitDismiss();
    else this._springBack();
  }

  _handleCancel() {
    if (!this._drag) return;
    this._removeDragListeners();
    this._drag = null;
    this._clearDragStyles();
  }

  _commitDismiss() {
    const dialog = this._dialog;
    const done = () => {
      clearTimeout(this._dragFallback);
      dialog.removeEventListener('transitionend', onEnd);
      this.close(); // → native close event → modal-close
      this._clearDragStyles();
    };
    const onEnd = e => { if (e.propertyName === 'transform') done(); };
    dialog.addEventListener('transitionend', onEnd);
    dialog.style.transition = DRAG_TRANSITION;
    dialog.style.transform = 'translateY(100%)';
    this._dragFallback = setTimeout(done, DRAG_FALLBACK_MS);
  }

  _springBack() {
    const dialog = this._dialog;
    const onEnd = () => {
      clearTimeout(this._dragFallback);
      dialog.removeEventListener('transitionend', onEnd);
      this._clearDragStyles();
    };
    dialog.addEventListener('transitionend', onEnd);
    dialog.style.transition = DRAG_TRANSITION;
    dialog.style.transform = 'translateY(0)';
    this._dragFallback = setTimeout(onEnd, DRAG_FALLBACK_MS);
  }

  _removeDragListeners() {
    this._handle?.removeEventListener('pointermove', this._onHandleMove);
    this._handle?.removeEventListener('pointerup', this._onHandleUp);
    this._handle?.removeEventListener('pointercancel', this._onHandleCancel);
  }

  _clearDragStyles() {
    if (!this._dialog) return;
    this._dialog.style.transition = '';
    this._dialog.style.transform = '';
  }

  _teardownDrag() {
    clearTimeout(this._dragFallback);
    this._removeDragListeners();
    this._drag = null;
    this._clearDragStyles();
  }

  show(focusEl = null) {
    // Clear any leftover inline transform/transition so a prior drag can't leave the
    // sheet mis-positioned on the next open.
    this._clearDragStyles();
    this._justOpened = true;
    this._dialog?.showModal();
    // setTimeout(0) rather than rAF: on Android Chrome the synthetic click from the
    // touch that opened the dialog fires after a rAF but before a macrotask, so rAF
    // would clear the guard before the click arrives and the backdrop handler would
    // immediately close the dialog. focusEl overrides showModal()'s default focus.
    setTimeout(() => {
      this._justOpened = false;
      focusEl?.focus();
    }, 0);
  }

  close() { this._dialog?.close(); }
}

customElements.define('modal-dialog', ModalDialog);
