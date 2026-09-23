import { AppElement } from '../../core/app-element.js';
import { t } from '../../core/strings.js';

const MOBILE_BREAKPOINT = 600;

// Swipe-down-to-dismiss thresholds (handle drag, sheet mode only).
const DISMISS_DISTANCE_RATIO = 0.25;      // commit when dragged past 25% of sheet height
const DISMISS_VELOCITY = 0.5;             // …or a downward flick faster than 0.5 px/ms
const DRAG_TRANSITION = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
const DRAG_FALLBACK_MS = 350;             // safety net if transitionend never fires

// Horizontal swipe-to-change-tab thresholds (body drag, tabCount > 1 only) — same
// shape as the dismiss-drag thresholds above, just on the other axis.
const TAB_SWIPE_DISTANCE_RATIO = 0.28;    // commit past 28% of the body's width
const TAB_SWIPE_VELOCITY = 0.5;           // …or a flick faster than 0.5 px/ms
const TAB_SWIPE_INTENT_PX = 10;           // movement below this is too small to classify yet

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
          --dialog-block-size-cap: min(85lvh, 600px);
          max-block-size: var(--dialog-block-size-cap);
          overflow: hidden;
        }

        /* Opt-in via the fixedHeight property — see below. Adds block-size on top of
           the max-block-size cap above (harmless: block-size is already ≤ the cap) so
           .body's flex: 1 1 auto has a real height to fill regardless of active tab,
           instead of the dialog shrink-wrapping to whichever tab is showing. Reads the
           same --dialog-block-size-cap the cap itself uses, so the desktop/mobile values
           are defined once each rather than duplicated per rule. */
        dialog.fixed-height { block-size: var(--dialog-block-size-cap); }

        dialog[open] {
          display: flex;
          flex-direction: column;
          animation: fade-in 0.2s ease-out;
        }

        dialog::backdrop {
          background: var(--color-overlay);
          animation: fade-in 0.2s ease-out;
        }

        .handle { display: none; flex-shrink: 0; }
        .handle.has-tabs { display: flex; align-items: center; justify-content: center; padding-block: var(--space-2); }

        /* Static, not reactive — see the comment above _bodyDown for why this can't be
           set per-gesture inside a pointerdown handler. Applies for as long as tabs are
           active, not just during a swipe. */
        .body.has-tabs { touch-action: none; }

        .body {
          flex: 1 1 auto;
          min-block-size: 0;
          overflow-y: auto;
          overscroll-behavior-y: contain;
        }

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
            padding-block-start: var(--space-2);
          padding-block-end: calc(var(--space-2) + var(--safe-area-bottom, 0px));
            --dialog-block-size-cap: 80lvh;
            max-block-size: var(--dialog-block-size-cap);
          }

          dialog[open] {
            animation: slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          }

          .handle {
            display: flex;
            align-items: center;
            justify-content: center;
            inline-size: 100%;
            min-block-size: var(--space-6);
            margin-block-end: var(--space-2);
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
          margin-block-start: var(--space-1);
          flex-shrink: 0;
        }

        /* ── Tabs (opt-in via the tabCount property) ──────────────────────
           The pill (.handle::before, above) is untouched — has-tabs just
           hides it and shows this row instead, so a dialog that never sets
           tabCount renders exactly as before, byte-for-byte. */
        .handle.has-tabs::before { display: none; }

        .handle-tabs {
          display: flex;
          align-items: center;
          justify-content: center;
          inline-size: 100%;
        }

        .tab-seg {
          border: none;
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          /* Intentionally below --touch-target (40px): tap is a secondary affordance here —
             swipe and arrow keys are the primary ways to change pages — so this uses the
             WCAG 2.5.8 bare minimum (24px) rather than the project's standard touch target,
             to keep the indicator visually small. */
          min-inline-size: var(--space-6);
          min-block-size: var(--space-6);
          touch-action: manipulation;
        }

        .tab-seg-dash {
          inline-size: var(--space-1);
          block-size: var(--space-1);
          border-radius: var(--radius-full);
          background: var(--color-border);
          transition: inline-size 0.2s ease, background-color 0.2s ease;
        }

        .tab-seg[aria-selected="true"] .tab-seg-dash {
          inline-size: var(--space-6);
          background: var(--color-text-secondary);
        }

        @media (prefers-reduced-motion: reduce) {
          .tab-seg-dash { transition: none; }
        }
      </style>
      <dialog aria-modal="true">
        <div class="handle" aria-hidden="true">
          <div class="handle-tabs" role="tablist" hidden></div>
        </div>
        <div class="body"><slot></slot></div>
        <div class="footer"><slot name="footer"></slot></div>
      </dialog>
    `;
  }

  subscribe() {
    this._dialog = this.shadowRoot.querySelector('dialog');
    this._handle = this.shadowRoot.querySelector('.handle');
    this._handleTabs = this.shadowRoot.querySelector('.handle-tabs');
    this._body = this.shadowRoot.querySelector('.body');
    this._tabCount = 0;
    this._activeTab = 0;
    this._fixedHeight = false;

    const label = this.getAttribute('aria-label');
    if (label) {
      this._dialog.setAttribute('aria-label', label);
      this.removeAttribute('aria-label');
    }

    this._onClose = () => {
      this._teardownDrag(); // tear down any in-flight handle drag when closed by any route
      this._teardownBodyDrag();
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

    // Tabs: keyboard paging on the segment row, swipe paging on the body.
    this._onTabsKeydown = this._handleTabsKeydown.bind(this);
    this._handleTabs.addEventListener('keydown', this._onTabsKeydown);

    this._onBodyDown = this._bodyDown.bind(this);
    this._onBodyMove = this._bodyMove.bind(this);
    this._onBodyUp = this._bodyUp.bind(this);
    this._onBodyCancel = this._bodyCancel.bind(this);
    this._body.addEventListener('pointerdown', this._onBodyDown);
  }

  unsubscribe() {
    this._dialog?.removeEventListener('close', this._onClose);
    this._dialog?.removeEventListener('click', this._onBackdrop);
    this._handle?.removeEventListener('pointerdown', this._onHandleDown);
    this._handleTabs?.removeEventListener('keydown', this._onTabsKeydown);
    this._body?.removeEventListener('pointerdown', this._onBodyDown);
    this._footerSlot?.removeEventListener('slotchange', this._onFooterSlotChange);
    this._teardownDrag();
    this._teardownBodyDrag();
  }

  _isSheet() {
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
  }

  _reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ── Swipe-down-to-dismiss (handle) ──────────────────────────────────────
  // With no tabs, the handle has one gesture (dismiss) and this forks nowhere —
  // pointerdown captures immediately and every move is tracked as vertical,
  // exactly as before. With tabs, the handle is shared with the dot row, so a
  // touch there might be a tap (native click on a .tab-seg), a vertical
  // dismiss-drag, or a horizontal tab-swipe. Capture and commitment are
  // deferred until ~10px of movement classifies the direction — mirroring
  // _bodyDown/_bodyMove's approach — so a tap still resolves to its own click.

  _handleDown(e) {
    if (e.button !== 0 || !this._isSheet()) return;

    if (this._tabCount <= 1) {
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
      return;
    }

    this._drag = {
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      pointerId: e.pointerId,
      height: this._dialog.getBoundingClientRect().height,
      width: this._body.getBoundingClientRect().width,
      horizontal: null, // undecided until ~10px of movement
      lastDx: 0,
    };
    this._handle.addEventListener('pointermove', this._onHandleMove);
    this._handle.addEventListener('pointerup', this._onHandleUp);
    this._handle.addEventListener('pointercancel', this._onHandleCancel);
  }

  _handleMove(e) {
    const d = this._drag;
    if (!d) return;

    if (d.horizontal === undefined) {
      // No-tabs path: vertical-only, unchanged. Follow the finger downward;
      // clamp upward drags to rest so the sheet never rises.
      this._dialog.style.transform = `translateY(${Math.max(0, e.clientY - d.startY)}px)`;
      return;
    }

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (d.horizontal === null) {
      if (Math.abs(dx) < TAB_SWIPE_INTENT_PX && Math.abs(dy) < TAB_SWIPE_INTENT_PX) return;
      d.horizontal = Math.abs(dx) > Math.abs(dy);
      this._handle.setPointerCapture(d.pointerId);
      if (!d.horizontal) this._dialog.style.transition = 'none';
    }

    if (d.horizontal) { d.lastDx = dx; return; }
    this._dialog.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }

  _handleUp(e) {
    const d = this._drag;
    if (!d) return;
    this._removeDragListeners();
    this._drag = null;

    if (d.horizontal === undefined) {
      this._resolveDismiss(e.clientY - d.startY, d.startTime, d.height);
      return;
    }

    if (d.horizontal === null) return; // never moved past the intent threshold — a tap, let native click fire

    if (d.horizontal) {
      const elapsed = Date.now() - d.startTime;
      const velocity = elapsed > 0 ? Math.abs(d.lastDx) / elapsed : 0;
      const commit = Math.abs(d.lastDx) > d.width * TAB_SWIPE_DISTANCE_RATIO || velocity > TAB_SWIPE_VELOCITY;
      if (commit) this._selectTab(this._activeTab + (d.lastDx < 0 ? 1 : -1));
      return;
    }

    this._resolveDismiss(e.clientY - d.startY, d.startTime, d.height);
  }

  _resolveDismiss(dy, startTime, height) {
    const elapsed = Date.now() - startTime;
    const velocity = elapsed > 0 ? dy / elapsed : 0;
    const commit = dy > height * DISMISS_DISTANCE_RATIO || velocity > DISMISS_VELOCITY;

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

  // ── Tabs ─────────────────────────────────────────────────────────────────

  get tabCount() { return this._tabCount ?? 0; }

  set tabCount(n) {
    const count = Math.max(0, n | 0);
    if (count === this._tabCount) return;
    this._tabCount = count;
    this._activeTab = Math.min(this._activeTab, Math.max(0, count - 1));
    this._renderTabSegments();
  }

  get activeTab() { return this._activeTab ?? 0; }

  // Programmatic assignment — does not dispatch modal-tab-change (that event
  // is reserved for user-driven interaction: segment tap, arrow key, swipe).
  set activeTab(i) { this._selectTab(i, { emit: false }); }

  // Opt-in: render at the max-block-size ceiling instead of shrink-wrapping to
  // content, so switching tabs with different content heights doesn't resize
  // the sheet. Default false — every dialog that wants to hug its own content
  // (confirm sheets, action menus) renders exactly as before.
  get fixedHeight() { return this._fixedHeight ?? false; }

  set fixedHeight(v) {
    const val = !!v;
    if (val === this._fixedHeight) return;
    this._fixedHeight = val;
    this._dialog.classList.toggle('fixed-height', val);
  }

  _renderTabSegments() {
    const on = this._tabCount > 1;
    this._handle.classList.toggle('has-tabs', on);
    this._body.classList.toggle('has-tabs', on); // static touch-action: none — see the CSS rule and the comment above _bodyDown
    this._handleTabs.hidden = !on;
    // The handle is aria-hidden by default (a touch affordance, not a control —
    // see docs). Once it holds real, independently meaningful buttons, it must
    // stop being hidden from assistive tech.
    if (on) this._handle.removeAttribute('aria-hidden');
    else this._handle.setAttribute('aria-hidden', 'true');

    this._handleTabs.innerHTML = '';
    if (!on) return;

    for (let i = 0; i < this._tabCount; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab-seg';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-label', t('modal-dialog.tab-label', { index: i + 1, count: this._tabCount }));
      btn.setAttribute('aria-selected', String(i === this._activeTab));
      btn.tabIndex = i === this._activeTab ? 0 : -1;
      const dash = document.createElement('span');
      dash.className = 'tab-seg-dash';
      btn.appendChild(dash);
      btn.addEventListener('click', () => this._selectTab(i));
      this._handleTabs.appendChild(btn);
    }
  }

  _selectTab(index, { emit = true } = {}) {
    if (this._tabCount < 1) return;
    const clamped = Math.max(0, Math.min(this._tabCount - 1, index));
    const changed = clamped !== this._activeTab;
    this._activeTab = clamped;
    this._handleTabs.querySelectorAll('.tab-seg').forEach((btn, i) => {
      const selected = i === clamped;
      btn.setAttribute('aria-selected', String(selected));
      btn.tabIndex = selected ? 0 : -1;
    });
    if (changed && emit) {
      this.dispatchEvent(new CustomEvent('modal-tab-change', { bubbles: true, composed: true, detail: { index: clamped } }));
    }
  }

  _handleTabsKeydown(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); this._selectTab(this._activeTab + 1); this._focusActiveTab(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this._selectTab(this._activeTab - 1); this._focusActiveTab(); }
  }

  _focusActiveTab() {
    this._handleTabs.querySelector('.tab-seg[aria-selected="true"]')?.focus();
  }

  // ── Swipe-to-change-tab (body) ───────────────────────────────────────────
  // .body.has-tabs (CSS, above) gives .body a STATIC touch-action: none
  // whenever tabCount > 1 — not set reactively here in _bodyDown. Two failed
  // rounds (pan-y, then a reactive none) confirmed why: Chrome's compositor
  // thread makes its own gesture-ownership decision on a separate thread,
  // using whatever touch-action was already in effect BEFORE a pointerdown
  // handler runs — a value changed reactively, in response to the touch
  // that's already begun, is not guaranteed to apply to that same gesture.
  // .handle's touch-action: none has always been static from initial paint
  // and never had this problem; an on-device isolation test (static class,
  // same 'none' value, same gating) confirmed static is what actually fixes
  // it. setPointerCapture() never helped either way — it only redirects
  // event delivery, it can't reclaim a gesture the browser already owns.
  //
  // This has a real, permanent cost, not just during a swipe: CSS
  // touch-action intersects down the whole ancestor chain, and a descendant
  // can never loosen what an ancestor already restricted. So for as long as
  // a dialog has tabCount > 1, ANY nested horizontally-scrollable content in
  // the body (a chart with its own overflow-x: auto region, say) permanently
  // loses native panning too — not just when a swipe is attempted. A
  // consumer with that kind of content needs its own manual pointer-driven
  // scroll replication for it, the same technique used below for .body's
  // own vertical fallback. This is not something this module can solve
  // generically — it doesn't know what a consumer slots in — so it's
  // documented as a real, user-facing behaviour change (see
  // docs/modal-dialog.md), not something to design around silently here.
  // Whether this also affects native text-selection-via-drag on a nested
  // input/textarea is unverified — flagged, not yet confirmed either way.
  //
  // Vertical drags: browsers don't hand a touch-action: none gesture back to
  // native scrolling mid-touch, so a vertical classification can't hand off
  // to native scroll — JS drives .body.scrollTop itself for the rest of
  // that gesture instead (mirroring how .handle's dismiss-drag has always
  // manually driven its own transform, for the same reason). This costs a
  // ~10px dead zone during the undecided phase (nothing scrolls until
  // direction is known) — the standard, unavoidable cost of JS-driven axis
  // disambiguation.

  _bodyDown(e) {
    if (e.button !== 0 || this._tabCount <= 1) return;
    if (e.target.closest('button, a, input, textarea, select, [contenteditable]')) return;
    // Doesn't restore that descendant's native panning (touch-action: none above is
    // static on .body and can't be selectively lifted per-touch) — its purpose now is
    // purely to stop our own tab-swipe tracking from hijacking a gesture the user
    // aimed at that scroller's content.
    if (this._withinHorizontalScroller(e.target)) return;
    this._bodyDrag = {
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      width: this._body.getBoundingClientRect().width,
      pointerId: e.pointerId,
      horizontal: null, // undecided until ~10px of movement
      lastDx: 0,
    };
    this._body.addEventListener('pointermove', this._onBodyMove);
    this._body.addEventListener('pointerup', this._onBodyUp);
    this._body.addEventListener('pointercancel', this._onBodyCancel);
  }

  _withinHorizontalScroller(el) {
    let node = el;
    while (node && node !== this._body) {
      if (node.scrollWidth > node.clientWidth + 1) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  _bodyMove(e) {
    const d = this._bodyDrag;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (d.horizontal === null) {
      if (Math.abs(dx) < TAB_SWIPE_INTENT_PX && Math.abs(dy) < TAB_SWIPE_INTENT_PX) return;
      d.horizontal = Math.abs(dx) > Math.abs(dy);
      this._body.setPointerCapture(d.pointerId);
      // Vertical: dead-zone this classifying move (nothing to scroll relative to
      // yet) and pick scroll-replication up from the next one. Horizontal falls
      // through below so this same move's dx still counts toward the swipe.
      if (d.horizontal) this._body.style.transition = 'none';
      else { d.lastY = e.clientY; return; }
    }

    if (d.horizontal) {
      d.lastDx = dx;
      this._body.style.transform = `translateX(${dx}px)`;
    } else {
      this._body.scrollTop -= e.clientY - d.lastY;
      d.lastY = e.clientY;
    }
  }

  _bodyUp() {
    const d = this._bodyDrag;
    if (!d) return;
    this._removeBodyDragListeners();
    this._bodyDrag = null;
    if (!d.horizontal) return;

    const elapsed = Date.now() - d.startTime;
    const velocity = elapsed > 0 ? Math.abs(d.lastDx) / elapsed : 0;
    const commit = Math.abs(d.lastDx) > d.width * TAB_SWIPE_DISTANCE_RATIO || velocity > TAB_SWIPE_VELOCITY;

    if (commit) {
      // No animation on this path: _selectTab swaps in the new tab's content at
      // .body's natural position, and Telos's own entrance animation on that
      // incoming content takes over from there — see the module feedback.
      this._clearBodyDragStyles();
      this._selectTab(this._activeTab + (d.lastDx < 0 ? 1 : -1));
      return;
    }

    if (this._reducedMotion()) { this._clearBodyDragStyles(); return; }
    this._bodySpringBack();
  }

  _bodySpringBack() {
    const body = this._body;
    const onEnd = () => {
      clearTimeout(this._bodyDragFallback);
      body.removeEventListener('transitionend', onEnd);
      this._clearBodyDragStyles();
    };
    body.addEventListener('transitionend', onEnd);
    body.style.transition = DRAG_TRANSITION;
    body.style.transform = 'translateX(0)';
    this._bodyDragFallback = setTimeout(onEnd, DRAG_FALLBACK_MS);
  }

  _bodyCancel() {
    this._removeBodyDragListeners();
    this._bodyDrag = null;
    this._clearBodyDragStyles();
  }

  _removeBodyDragListeners() {
    this._body?.removeEventListener('pointermove', this._onBodyMove);
    this._body?.removeEventListener('pointerup', this._onBodyUp);
    this._body?.removeEventListener('pointercancel', this._onBodyCancel);
  }

  _clearBodyDragStyles() {
    if (!this._body) return;
    this._body.style.transition = '';
    this._body.style.transform = '';
  }

  _teardownBodyDrag() {
    clearTimeout(this._bodyDragFallback);
    this._removeBodyDragListeners();
    this._bodyDrag = null;
    this._clearBodyDragStyles();
  }

  show(focusEl = null) {
    // Clear any leftover inline transform/transition so a prior drag can't leave the
    // sheet — or, since the body swipe animates .body directly, its content —
    // mis-positioned on the next open.
    this._clearDragStyles();
    this._clearBodyDragStyles();
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
