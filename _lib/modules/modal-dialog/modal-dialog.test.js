// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../core/app-element.js';
import './modal-dialog.js';

// happy-dom does not implement pointer capture — no-op stubs (see CLAUDE.md testing notes).
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

const SHEET_HEIGHT = 400;

// Deterministic media-query stub: sheet mode (max-width) and reduced-motion controlled per test.
function stubMatchMedia({ sheet = true, reduced = false } = {}) {
  window.matchMedia = vi.fn(query => ({
    media: query,
    matches: query.includes('prefers-reduced-motion') ? reduced
      : query.includes('max-width') ? sheet
      : false,
  }));
}

function mount(attrs = {}) {
  const el = document.createElement('modal-dialog');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  const dialog = el.shadowRoot.querySelector('dialog');
  dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
  // Faithful close mock: real dialog.close() fires a native 'close' event.
  dialog.close = vi.fn(() => { dialog.removeAttribute('open'); dialog.dispatchEvent(new Event('close')); });
  dialog.getBoundingClientRect = () => ({ height: SHEET_HEIGHT });
  return el;
}

function pointer(type, clientY, extra = {}) {
  return new PointerEvent(type, { button: 0, pointerId: 1, clientY, bubbles: true, ...extra });
}

function transitionEnd(dialog, propertyName = 'transform') {
  const e = new Event('transitionend');
  e.propertyName = propertyName;
  dialog.dispatchEvent(e);
}

beforeEach(() => stubMatchMedia());
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('modal-dialog — open / close', () => {
  it('show() opens the dialog', () => {
    const el = mount();
    el.show();
    expect(el.shadowRoot.querySelector('dialog').hasAttribute('open')).toBe(true);
  });

  it('show(focusEl) calls focus() on the element after the setTimeout fires', () => {
    vi.useFakeTimers();
    const el = mount();
    const focusEl = { focus: vi.fn() };
    el.show(focusEl);
    expect(focusEl.focus).not.toHaveBeenCalled(); // not yet — setTimeout pending
    vi.runAllTimers();
    expect(focusEl.focus).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('show() with no argument does not throw', () => {
    const el = mount();
    expect(() => el.show()).not.toThrow();
  });

  it('close() removes the open attribute', () => {
    const el = mount();
    el.show();
    el.close();
    expect(el.shadowRoot.querySelector('dialog').hasAttribute('open')).toBe(false);
  });
});

describe('modal-dialog — modal-close event', () => {
  it('dispatches modal-close when the native close event fires', () => {
    const el = mount();
    const handler = vi.fn();
    el.addEventListener('modal-close', handler);
    el.shadowRoot.querySelector('dialog').dispatchEvent(new Event('close'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('modal-close event bubbles and is composed', () => {
    const el = mount();
    let captured = null;
    document.addEventListener('modal-close', e => { captured = e; }, { once: true });
    el.shadowRoot.querySelector('dialog').dispatchEvent(new Event('close'));
    expect(captured).not.toBeNull();
    expect(captured.bubbles).toBe(true);
    expect(captured.composed).toBe(true);
  });
});

describe('modal-dialog — backdrop dismiss', () => {
  it('clicking the dialog element (backdrop area) calls close()', () => {
    const el = mount();
    el.show();
    el._justOpened = false; // simulate setTimeout callback having fired
    const dialog = el.shadowRoot.querySelector('dialog');
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.close).toHaveBeenCalledOnce();
  });

  it('backdrop click is ignored immediately after show() (_justOpened guard)', () => {
    const el = mount();
    el.show(); // _justOpened is true until rAF fires
    const dialog = el.shadowRoot.querySelector('dialog');
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it('_justOpened stays true until the setTimeout fires (guards against same-task synthetic click)', () => {
    vi.useFakeTimers();
    const el = mount();
    el.show();
    expect(el._justOpened).toBe(true);
    vi.runAllTimers();
    expect(el._justOpened).toBe(false);
    vi.useRealTimers();
  });

  it('clicking dialog content (not backdrop) does not dismiss', () => {
    const el = mount();
    el.show();
    el._justOpened = false;
    const dialog = el.shadowRoot.querySelector('dialog');
    const handle = el.shadowRoot.querySelector('.handle');
    // click on child element — e.target is .handle, not the dialog
    handle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.close).not.toHaveBeenCalled();
  });
});

describe('modal-dialog — slots and structure', () => {
  it('has default and footer slots', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('slot:not([name])')).toBeTruthy();
    expect(el.shadowRoot.querySelector('slot[name="footer"]')).toBeTruthy();
  });

  it('has a handle element', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.handle')).toBeTruthy();
  });
});

describe('modal-dialog — accessibility attributes', () => {
  it('dialog has aria-modal="true"', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('dialog').getAttribute('aria-modal')).toBe('true');
  });

  it('handle has aria-hidden="true"', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.handle').getAttribute('aria-hidden')).toBe('true');
  });

  it('forwards aria-label to the inner dialog when the attribute is set', () => {
    const el = mount({ 'aria-label': 'Edit goal' });
    expect(el.shadowRoot.querySelector('dialog').getAttribute('aria-label')).toBe('Edit goal');
  });

  it('does not set aria-label on the inner dialog when the attribute is absent', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('dialog').hasAttribute('aria-label')).toBe(false);
  });
});

describe('modal-dialog — swipe-down-to-dismiss', () => {
  function drag(el, { from = 0, to, downAt, upAt } = {}) {
    const handle = el.shadowRoot.querySelector('.handle');
    // _handleDown reads Date.now() once (startTime), _handleUp reads it once (elapsed).
    if (downAt !== undefined) vi.spyOn(Date, 'now').mockReturnValueOnce(downAt).mockReturnValueOnce(upAt);
    handle.dispatchEvent(pointer('pointerdown', from));
    handle.dispatchEvent(pointer('pointermove', to));
    handle.dispatchEvent(pointer('pointerup', to));
    return handle;
  }

  it('drag past the distance threshold animates out, then dismisses and fires modal-close', () => {
    const el = mount();
    const dialog = el.shadowRoot.querySelector('dialog');
    const onClose = vi.fn();
    el.addEventListener('modal-close', onClose);
    el.show();

    drag(el, { to: SHEET_HEIGHT * 0.5 }); // 200px > 25% of 400
    expect(dialog.style.transform).toBe('translateY(100%)'); // committing animation
    expect(dialog.close).not.toHaveBeenCalled();             // waits for transitionend

    transitionEnd(dialog);
    expect(dialog.close).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(dialog.style.transform).toBe('');                 // styles cleared after close
  });

  it('commit falls back to setTimeout when transitionend never fires', () => {
    vi.useFakeTimers();
    const el = mount();
    const dialog = el.shadowRoot.querySelector('dialog');
    el.show();
    drag(el, { to: 300 });
    expect(dialog.close).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(dialog.close).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('drag below the threshold springs back with no close and clears the transform', () => {
    const el = mount();
    const dialog = el.shadowRoot.querySelector('dialog');
    el.show();

    // 40px < 25% of 400, over 1000ms → 0.04 px/ms, well below the velocity threshold
    drag(el, { to: 40, downAt: 1000, upAt: 2000 });
    expect(dialog.close).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe('translateY(0)'); // spring-back target

    transitionEnd(dialog);
    expect(dialog.style.transform).toBe('');
    expect(dialog.style.transition).toBe('');
  });

  it('commits on a fast downward flick even below the distance threshold (velocity)', () => {
    const el = mount();
    const dialog = el.shadowRoot.querySelector('dialog');
    el.show();

    // 40px in 50ms = 0.8 px/ms > 0.5 threshold, despite 40px < 25% of 400.
    drag(el, { to: 40, downAt: 1000, upAt: 1050 });
    expect(dialog.style.transform).toBe('translateY(100%)');
    transitionEnd(dialog);
    expect(dialog.close).toHaveBeenCalledOnce();
  });

  it('follows the finger downward and clamps upward drags to rest', () => {
    const el = mount();
    const dialog = el.shadowRoot.querySelector('dialog');
    const handle = el.shadowRoot.querySelector('.handle');
    el.show();

    handle.dispatchEvent(pointer('pointerdown', 100));
    handle.dispatchEvent(pointer('pointermove', 160)); // dy = +60
    expect(dialog.style.transform).toBe('translateY(60px)');
    handle.dispatchEvent(pointer('pointermove', 40));  // dy = -60 → clamped
    expect(dialog.style.transform).toBe('translateY(0px)');
    handle.dispatchEvent(pointer('pointercancel', 40));
  });

  it('is inert on a desktop-width viewport (handle hidden)', () => {
    stubMatchMedia({ sheet: false });
    const el = mount();
    const dialog = el.shadowRoot.querySelector('dialog');
    el.show();

    drag(el, { to: 300 });
    expect(dialog.style.transform).toBe(''); // pointerdown was a no-op
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it('pointercancel resets the transform without closing', () => {
    const el = mount();
    const dialog = el.shadowRoot.querySelector('dialog');
    const handle = el.shadowRoot.querySelector('.handle');
    el.show();

    handle.dispatchEvent(pointer('pointerdown', 0));
    handle.dispatchEvent(pointer('pointermove', 200));
    expect(dialog.style.transform).toBe('translateY(200px)');
    handle.dispatchEvent(pointer('pointercancel', 200));
    expect(dialog.style.transform).toBe('');
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it('reduced motion: a past-threshold release closes immediately without animating', () => {
    stubMatchMedia({ reduced: true });
    const el = mount();
    const dialog = el.shadowRoot.querySelector('dialog');
    const onClose = vi.fn();
    el.addEventListener('modal-close', onClose);
    el.show();

    drag(el, { to: 300 });
    expect(dialog.close).toHaveBeenCalledOnce();       // no transitionend wait
    expect(onClose).toHaveBeenCalledOnce();
    expect(dialog.style.transform).toBe('');
  });

  it('reduced motion: a below-threshold release resets without animating or closing', () => {
    stubMatchMedia({ reduced: true });
    const el = mount();
    const dialog = el.shadowRoot.querySelector('dialog');
    el.show();

    drag(el, { to: 40, downAt: 1000, upAt: 2000 }); // slow, below distance + velocity thresholds
    expect(dialog.close).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe('');
  });

  it('show() clears a stale transform left by a prior drag', () => {
    const el = mount();
    const dialog = el.shadowRoot.querySelector('dialog');
    dialog.style.transform = 'translateY(120px)';
    dialog.style.transition = 'none';
    el.show();
    expect(dialog.style.transform).toBe('');
    expect(dialog.style.transition).toBe('');
  });

  it('tears down an in-flight drag when the dialog is closed by another route', () => {
    const el = mount();
    const dialog = el.shadowRoot.querySelector('dialog');
    const handle = el.shadowRoot.querySelector('.handle');
    el.show();

    handle.dispatchEvent(pointer('pointerdown', 0));
    handle.dispatchEvent(pointer('pointermove', 150));
    el.close(); // backdrop / native route — fires close → teardown
    expect(dialog.style.transform).toBe('');

    // further move events are inert after teardown
    handle.dispatchEvent(pointer('pointermove', 300));
    expect(dialog.style.transform).toBe('');
  });
});
