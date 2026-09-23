// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../core/app-element.js';
import './modal-dialog.js';
import { defineStrings } from '../../core/strings.js';

defineStrings({ 'modal-dialog.tab-label': 'Page {index} of {count}' });

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

const BODY_WIDTH = 300;

function pointerXY(type, clientX, clientY = 0, extra = {}) {
  return new PointerEvent(type, { button: 0, pointerId: 2, clientX, clientY, bubbles: true, ...extra });
}

function mountWithTabs(count) {
  const el = mount();
  el.shadowRoot.querySelector('.body').getBoundingClientRect = () => ({ width: BODY_WIDTH });
  el.tabCount = count;
  return el;
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

  it('default slot is wrapped in a .body container', () => {
    const el = mount();
    const body = el.shadowRoot.querySelector('.body');
    expect(body).toBeTruthy();
    expect(body.querySelector('slot:not([name])')).toBeTruthy();
  });

  it('handle grab zone spans full width and meets the touch-target min-size', () => {
    // Media-query rules are not applied by happy-dom getComputedStyle, so assert the
    // authored rule: the grab zone is full-width and at least --touch-target tall.
    const el = mount();
    const css = el.shadowRoot.querySelector('style').textContent;
    const handleRule = css.slice(css.indexOf('.handle {'), css.indexOf('.handle::before'));
    expect(handleRule).toMatch(/inline-size:\s*100%/);
    expect(handleRule).toMatch(/min-block-size:\s*var\(--space-6\)/);
    expect(handleRule).toMatch(/touch-action:\s*none/);
    // Visible pill unchanged: 36×4 rendered on ::before.
    expect(css).toMatch(/\.handle::before[^}]*inline-size:\s*36px/);
  });

  it('dialog[open] is a column flex container with a max-block-size cap on the bare rule', () => {
    const el = mount();
    const css = el.shadowRoot.querySelector('style').textContent;
    const bareRule   = css.slice(css.indexOf('dialog {'), css.indexOf('dialog[open]'));
    const openRule   = css.slice(css.indexOf('dialog[open] {'), css.indexOf('dialog::backdrop'));
    // flex layout only when open — bare rule must not set display (regression guard)
    expect(bareRule).not.toMatch(/display:/);
    expect(openRule).toMatch(/display:\s*flex/);
    expect(openRule).toMatch(/flex-direction:\s*column/);
    // max-block-size cap is harmless on a hidden element, lives in the bare rule
    expect(bareRule).toMatch(/max-block-size:/);
  });

  it('bare dialog rule sets overflow: hidden so only .body ever scrolls', () => {
    // Without this, the UA default lets <dialog> itself become a second scroll
    // container once slotted content exceeds max-block-size, and the fixed
    // .handle/.footer regions drift with it instead of staying pinned.
    const el = mount();
    const css = el.shadowRoot.querySelector('style').textContent;
    const bareRule = css.slice(css.indexOf('dialog {'), css.indexOf('dialog[open]'));
    expect(bareRule).toMatch(/overflow:\s*hidden/);
  });

  it('.body has overflow-y: auto and flex sizing that allows it to shrink', () => {
    const el = mount();
    const css = el.shadowRoot.querySelector('style').textContent;
    const bodyRule = css.slice(css.indexOf('.body {'), css.indexOf('.body {') + 200);
    expect(bodyRule).toMatch(/overflow-y:\s*auto/);
    expect(bodyRule).toMatch(/flex:\s*1 1 auto/);
    expect(bodyRule).toMatch(/min-block-size:\s*0/);
  });

  it('.handle and .footer have flex-shrink: 0', () => {
    const el = mount();
    const css = el.shadowRoot.querySelector('style').textContent;
    const handleBaseRule = css.slice(css.indexOf('.handle {'), css.indexOf('.handle {') + 80);
    const footerRule = css.slice(css.indexOf('.footer {'), css.indexOf('.footer {') + 200);
    expect(handleBaseRule).toMatch(/flex-shrink:\s*0/);
    expect(footerRule).toMatch(/flex-shrink:\s*0/);
  });
});

describe('modal-dialog — footer collapse', () => {
  function mountWithFooter() {
    const el = document.createElement('modal-dialog');
    const btn = document.createElement('button');
    btn.setAttribute('slot', 'footer');
    btn.textContent = 'Save';
    el.appendChild(btn);
    document.body.appendChild(el);
    return el;
  }

  it('collapses the footer (hidden, no layout box) when no footer content is slotted', () => {
    const el = mount();
    const footer = el.shadowRoot.querySelector('.footer');
    expect(footer.hidden).toBe(true);
    // [hidden] collapses to display:none via the base stylesheet — no margin, no height.
    expect(getComputedStyle(footer).display).toBe('none');
  });

  it('keeps the footer present when content is slotted', () => {
    const el = mountWithFooter();
    const footer = el.shadowRoot.querySelector('.footer');
    expect(footer.hidden).toBe(false);
    expect(getComputedStyle(footer).display).not.toBe('none');
  });

  it('re-collapses when footer content is removed (slotchange)', () => {
    const el = mountWithFooter();
    const footer = el.shadowRoot.querySelector('.footer');
    expect(footer.hidden).toBe(false);
    el.querySelector('button[slot="footer"]').remove();
    el.shadowRoot.querySelector('slot[name="footer"]').dispatchEvent(new Event('slotchange'));
    expect(footer.hidden).toBe(true);
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

  it('removes aria-label from the host after forwarding it (role-less element must not carry aria-label)', () => {
    const el = mount({ 'aria-label': 'Edit goal' });
    expect(el.hasAttribute('aria-label')).toBe(false);
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

describe('modal-dialog — tabs: swipe and tap on the handle', () => {
  function handlePointer(type, clientX, clientY, extra = {}) {
    return new PointerEvent(type, { button: 0, pointerId: 3, clientX, clientY, bubbles: true, ...extra });
  }

  it('a horizontal drag on the handle margin changes tabs, same thresholds as the body', () => {
    const el = mountWithTabs(3);
    const handle = el.shadowRoot.querySelector('.handle');
    const dialog = el.shadowRoot.querySelector('dialog');
    const onChange = vi.fn();
    el.addEventListener('modal-tab-change', onChange);

    handle.dispatchEvent(handlePointer('pointerdown', 200, 20));
    handle.dispatchEvent(handlePointer('pointermove', 110, 20)); // dx = -90, > 28% of 300
    handle.dispatchEvent(handlePointer('pointerup', 110, 20));

    expect(el.activeTab).toBe(1);
    expect(onChange.mock.calls[0][0].detail).toEqual({ index: 1 });
    expect(dialog.style.transform).toBe(''); // never touched the dismiss-drag path
  });

  it('a horizontal drag starting directly on a dot changes tabs (dot no longer swallows the drag)', () => {
    const el = mountWithTabs(3);
    const dot = el.shadowRoot.querySelectorAll('.tab-seg')[0];
    const handle = el.shadowRoot.querySelector('.handle');

    dot.dispatchEvent(handlePointer('pointerdown', 200, 20));
    handle.dispatchEvent(handlePointer('pointermove', 110, 20));
    handle.dispatchEvent(handlePointer('pointerup', 110, 20));

    expect(el.activeTab).toBe(1);
  });

  it('a vertical drag starting directly on a dot still dismisses (dot no longer swallows the drag)', () => {
    const el = mountWithTabs(3);
    const dot = el.shadowRoot.querySelectorAll('.tab-seg')[0];
    const dialog = el.shadowRoot.querySelector('dialog');
    el.show();

    dot.dispatchEvent(handlePointer('pointerdown', 200, 0));
    el.shadowRoot.querySelector('.handle').dispatchEvent(handlePointer('pointermove', 200, 200)); // dy = 200 > 25% of 400
    el.shadowRoot.querySelector('.handle').dispatchEvent(handlePointer('pointerup', 200, 200));

    expect(dialog.style.transform).toBe('translateY(100%)'); // committing animation
    transitionEnd(dialog);
    expect(dialog.close).toHaveBeenCalledOnce();
  });

  it('a vertical drag on the handle margin still dismisses when tabs are present', () => {
    const el = mountWithTabs(2);
    const handle = el.shadowRoot.querySelector('.handle');
    const dialog = el.shadowRoot.querySelector('dialog');
    el.show();

    handle.dispatchEvent(handlePointer('pointerdown', 150, 0));
    handle.dispatchEvent(handlePointer('pointermove', 150, 300)); // dy = 300 > 25% of 400
    handle.dispatchEvent(handlePointer('pointerup', 150, 300));

    expect(dialog.style.transform).toBe('translateY(100%)');
    transitionEnd(dialog);
    expect(dialog.close).toHaveBeenCalledOnce();
  });

  it('a tap on a dot (no movement past the intent threshold) never captures the pointer or moves the dialog', () => {
    const el = mountWithTabs(3);
    const dot = el.shadowRoot.querySelectorAll('.tab-seg')[1];
    const dialog = el.shadowRoot.querySelector('dialog');
    const captureSpy = vi.spyOn(el.shadowRoot.querySelector('.handle'), 'setPointerCapture');

    dot.dispatchEvent(handlePointer('pointerdown', 100, 20));
    dot.dispatchEvent(handlePointer('pointerup', 100, 20)); // no movement — a tap
    dot.click(); // the browser's own synthetic click, unaffected by the drag path

    expect(captureSpy).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe('');
    expect(el.activeTab).toBe(1); // click-driven selection still works
  });

  it('movement below the intent threshold does not classify a direction or move the dialog', () => {
    const el = mountWithTabs(3);
    const handle = el.shadowRoot.querySelector('.handle');
    const dialog = el.shadowRoot.querySelector('dialog');

    handle.dispatchEvent(handlePointer('pointerdown', 100, 20));
    handle.dispatchEvent(handlePointer('pointermove', 105, 22)); // 5px, below TAB_SWIPE_INTENT_PX
    expect(dialog.style.transform).toBe('');
    handle.dispatchEvent(handlePointer('pointerup', 105, 22));
    expect(el.activeTab).toBe(0);
  });

  it('a horizontal drag on the handle is a no-op when there is only one tab', () => {
    const el = mountWithTabs(1);
    const handle = el.shadowRoot.querySelector('.handle');
    const dialog = el.shadowRoot.querySelector('dialog');
    el.show();

    handle.dispatchEvent(pointer('pointerdown', 20)); // tabCount <= 1 → the unchanged vertical-only path
    handle.dispatchEvent(pointer('pointermove', 25)); // 5px — below the dismiss commit threshold anyway
    handle.dispatchEvent(pointer('pointerup', 25));

    expect(dialog.close).not.toHaveBeenCalled();
  });

  it('a rightward drag on the handle goes to the previous tab', () => {
    const el = mountWithTabs(3);
    el.activeTab = 1;
    const handle = el.shadowRoot.querySelector('.handle');

    handle.dispatchEvent(handlePointer('pointerdown', 100, 20));
    handle.dispatchEvent(handlePointer('pointermove', 190, 20)); // dx = +90
    handle.dispatchEvent(handlePointer('pointerup', 190, 20));

    expect(el.activeTab).toBe(0);
  });

  it('pointercancel tears down an in-flight handle drag on a tabbed dialog without side effects', () => {
    const el = mountWithTabs(3);
    const handle = el.shadowRoot.querySelector('.handle');
    const dialog = el.shadowRoot.querySelector('dialog');

    handle.dispatchEvent(handlePointer('pointerdown', 200, 20));
    handle.dispatchEvent(handlePointer('pointermove', 130, 20));
    handle.dispatchEvent(handlePointer('pointercancel', 130, 20));

    expect(el.activeTab).toBe(0);
    expect(dialog.style.transform).toBe('');
  });
});

describe('modal-dialog — fixedHeight', () => {
  it('defaults to false and does not add the fixed-height class', () => {
    const el = mount();
    expect(el.fixedHeight).toBe(false);
    expect(el.shadowRoot.querySelector('dialog').classList.contains('fixed-height')).toBe(false);
  });

  it('setting fixedHeight true adds the fixed-height class', () => {
    const el = mount();
    el.fixedHeight = true;
    expect(el.fixedHeight).toBe(true);
    expect(el.shadowRoot.querySelector('dialog').classList.contains('fixed-height')).toBe(true);
  });

  it('setting fixedHeight back to false removes the class', () => {
    const el = mount();
    el.fixedHeight = true;
    el.fixedHeight = false;
    expect(el.shadowRoot.querySelector('dialog').classList.contains('fixed-height')).toBe(false);
  });

  it('.fixed-height reads the same --dialog-block-size-cap variable the max-block-size cap sets, once per breakpoint', () => {
    const el = mount();
    const css = el.shadowRoot.querySelector('style').textContent;
    // One rule, driven by a custom property — not duplicated per breakpoint.
    expect(css).toMatch(/dialog\.fixed-height\s*\{\s*block-size:\s*var\(--dialog-block-size-cap\);?\s*\}/);
    // The bare rule defines the desktop value...
    const bareRule = css.slice(css.indexOf('dialog {'), css.indexOf('dialog[open]'));
    expect(bareRule).toMatch(/--dialog-block-size-cap:\s*min\(85lvh,\s*600px\)/);
    expect(bareRule).toMatch(/max-block-size:\s*var\(--dialog-block-size-cap\)/);
    // ...and the mobile media query overrides it to the sheet value.
    const mediaRule = css.slice(css.indexOf('@media (max-width'), css.indexOf('dialog[open]', css.indexOf('@media (max-width')));
    expect(mediaRule).toMatch(/--dialog-block-size-cap:\s*80lvh/);
    expect(mediaRule).toMatch(/max-block-size:\s*var\(--dialog-block-size-cap\)/);
  });
});

describe('modal-dialog — tabs: setup and rendering', () => {
  it('defaults to tabCount 0, activeTab 0, no tab segments, pill untouched', () => {
    const el = mount();
    expect(el.tabCount).toBe(0);
    expect(el.activeTab).toBe(0);
    expect(el.shadowRoot.querySelector('.handle').classList.contains('has-tabs')).toBe(false);
    expect(el.shadowRoot.querySelector('.body').classList.contains('has-tabs')).toBe(false);
    expect(el.shadowRoot.querySelectorAll('.tab-seg').length).toBe(0);
  });

  it('tabCount of 1 does not switch on tabs mode (nothing to page between)', () => {
    const el = mountWithTabs(1);
    expect(el.shadowRoot.querySelector('.handle').classList.contains('has-tabs')).toBe(false);
    expect(el.shadowRoot.querySelector('.body').classList.contains('has-tabs')).toBe(false);
    expect(el.shadowRoot.querySelectorAll('.tab-seg').length).toBe(0);
  });

  it('tabCount > 1 renders that many segment buttons and switches on has-tabs (handle and body alike)', () => {
    const el = mountWithTabs(4);
    expect(el.shadowRoot.querySelector('.handle').classList.contains('has-tabs')).toBe(true);
    // .body gets the same class — it's what gives .body its static touch-action: none
    // (see the CSS rule and the comment above _bodyDown); it must switch on in lockstep
    // with the handle's, not independently.
    expect(el.shadowRoot.querySelector('.body').classList.contains('has-tabs')).toBe(true);
    expect(el.shadowRoot.querySelectorAll('.tab-seg').length).toBe(4);
    expect(el.shadowRoot.querySelector('.handle-tabs').hidden).toBe(false);
  });

  it('segments are real role="tab" buttons, and the first is selected by default', () => {
    const el = mountWithTabs(3);
    const segs = el.shadowRoot.querySelectorAll('.tab-seg');
    segs.forEach(s => expect(s.getAttribute('role')).toBe('tab'));
    expect(segs[0].getAttribute('aria-selected')).toBe('true');
    expect(segs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('labels each segment via t() with its 1-based position and the total count', () => {
    const el = mountWithTabs(3);
    const segs = el.shadowRoot.querySelectorAll('.tab-seg');
    expect(segs[0].getAttribute('aria-label')).toBe('Page 1 of 3');
    expect(segs[2].getAttribute('aria-label')).toBe('Page 3 of 3');
  });

  it('removes aria-hidden from the handle once it holds real controls', () => {
    const el = mountWithTabs(3);
    expect(el.shadowRoot.querySelector('.handle').hasAttribute('aria-hidden')).toBe(false);
  });

  it('going back to tabCount 1 restores aria-hidden, removes the segments, and lifts .body\'s touch-action restriction', () => {
    const el = mountWithTabs(3);
    el.tabCount = 1;
    expect(el.shadowRoot.querySelector('.handle').getAttribute('aria-hidden')).toBe('true');
    expect(el.shadowRoot.querySelector('.handle').classList.contains('has-tabs')).toBe(false);
    expect(el.shadowRoot.querySelector('.body').classList.contains('has-tabs')).toBe(false);
    expect(el.shadowRoot.querySelectorAll('.tab-seg').length).toBe(0);
  });

  it('shrinking tabCount clamps an out-of-range activeTab', () => {
    const el = mountWithTabs(5);
    el.activeTab = 4;
    el.tabCount = 2;
    expect(el.activeTab).toBe(1);
  });

  it('a negative tabCount clamps to 0 rather than throwing', () => {
    const el = mountWithTabs(3);
    el.tabCount = -2;
    expect(el.tabCount).toBe(0);
    expect(el.shadowRoot.querySelectorAll('.tab-seg').length).toBe(0);
  });

  it('setting activeTab while tabCount is 0 is a no-op, not a throw', () => {
    const el = mount();
    expect(() => { el.activeTab = 2; }).not.toThrow();
    expect(el.activeTab).toBe(0);
  });
});

describe('modal-dialog — tabs: selection', () => {
  it('clicking a segment updates activeTab and fires modal-tab-change with its index', () => {
    const el = mountWithTabs(3);
    const onChange = vi.fn();
    el.addEventListener('modal-tab-change', onChange);
    el.shadowRoot.querySelectorAll('.tab-seg')[2].click();
    expect(el.activeTab).toBe(2);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].detail).toEqual({ index: 2 });
  });

  it('modal-tab-change bubbles and is composed', () => {
    const el = mountWithTabs(3);
    let captured = null;
    document.addEventListener('modal-tab-change', e => { captured = e; }, { once: true });
    el.shadowRoot.querySelectorAll('.tab-seg')[1].click();
    expect(captured).not.toBeNull();
    expect(captured.bubbles).toBe(true);
    expect(captured.composed).toBe(true);
  });

  it('clicking the already-active segment does not fire modal-tab-change', () => {
    const el = mountWithTabs(3);
    const onChange = vi.fn();
    el.addEventListener('modal-tab-change', onChange);
    el.shadowRoot.querySelectorAll('.tab-seg')[0].click(); // already active
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clicking updates aria-selected across all segments, not just the clicked one', () => {
    const el = mountWithTabs(3);
    el.shadowRoot.querySelectorAll('.tab-seg')[2].click();
    const segs = el.shadowRoot.querySelectorAll('.tab-seg');
    expect(segs[0].getAttribute('aria-selected')).toBe('false');
    expect(segs[2].getAttribute('aria-selected')).toBe('true');
  });

  it('the activeTab property setter updates state without dispatching modal-tab-change', () => {
    const el = mountWithTabs(3);
    const onChange = vi.fn();
    el.addEventListener('modal-tab-change', onChange);
    el.activeTab = 2;
    expect(el.activeTab).toBe(2);
    expect(el.shadowRoot.querySelectorAll('.tab-seg')[2].getAttribute('aria-selected')).toBe('true');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps out-of-range indices from either direction', () => {
    const el = mountWithTabs(3);
    el.activeTab = 99;
    expect(el.activeTab).toBe(2);
    el.activeTab = -5;
    expect(el.activeTab).toBe(0);
  });
});

describe('modal-dialog — tabs: keyboard paging', () => {
  it('ArrowRight/ArrowLeft on the segment row page through tabs and move focus', () => {
    const el = mountWithTabs(3);
    const tabs = el.shadowRoot.querySelector('.handle-tabs');
    tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(el.activeTab).toBe(1);
    tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(el.activeTab).toBe(2);
    tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(el.activeTab).toBe(1);
  });

  it('arrow keys fire modal-tab-change like a click would', () => {
    const el = mountWithTabs(3);
    const onChange = vi.fn();
    el.addEventListener('modal-tab-change', onChange);
    el.shadowRoot.querySelector('.handle-tabs').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].detail).toEqual({ index: 1 });
  });

  it('arrow keys clamp at the first and last tab rather than wrapping', () => {
    const el = mountWithTabs(2);
    const tabs = el.shadowRoot.querySelector('.handle-tabs');
    tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); // already at 0
    expect(el.activeTab).toBe(0);
    el.activeTab = 1;
    tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); // already at last
    expect(el.activeTab).toBe(1);
  });

  it('only the active segment is keyboard-tabbable (roving tabindex)', () => {
    const el = mountWithTabs(3);
    let segs = el.shadowRoot.querySelectorAll('.tab-seg');
    expect(segs[0].tabIndex).toBe(0);
    expect(segs[1].tabIndex).toBe(-1);
    el.activeTab = 1;
    segs = el.shadowRoot.querySelectorAll('.tab-seg');
    expect(segs[0].tabIndex).toBe(-1);
    expect(segs[1].tabIndex).toBe(0);
  });
});

describe('modal-dialog — tabs: swipe on the body', () => {
  it('a horizontal drag past the distance threshold changes tabs (left = next)', () => {
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');
    const onChange = vi.fn();
    el.addEventListener('modal-tab-change', onChange);

    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 110, 100)); // dx = -90, > 28% of 300
    body.dispatchEvent(pointerXY('pointerup', 110, 100));

    expect(el.activeTab).toBe(1);
    expect(onChange.mock.calls[0][0].detail).toEqual({ index: 1 });
  });

  it('a rightward drag past threshold goes to the previous tab', () => {
    const el = mountWithTabs(3);
    el.activeTab = 1;
    const body = el.shadowRoot.querySelector('.body');

    body.dispatchEvent(pointerXY('pointerdown', 100, 100));
    body.dispatchEvent(pointerXY('pointermove', 190, 100)); // dx = +90
    body.dispatchEvent(pointerXY('pointerup', 190, 100));

    expect(el.activeTab).toBe(0);
  });

  it('follows the finger live during a horizontal drag', () => {
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');

    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 170, 100)); // dx = -30, classifies horizontal
    expect(body.style.transform).toBe('translateX(-30px)');
    expect(body.style.transition).toBe('none');

    body.dispatchEvent(pointerXY('pointermove', 150, 100)); // dx = -50
    expect(body.style.transform).toBe('translateX(-50px)');

    body.dispatchEvent(pointerXY('pointerup', 150, 100));
  });

  it('a below-threshold release springs the body back to rest via the drag transition', () => {
    vi.useFakeTimers(); // freezes Date.now() too, so elapsed is 0 — a slow drag, below the velocity threshold
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');

    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 190, 100)); // dx = -10, below threshold
    body.dispatchEvent(pointerXY('pointerup', 190, 100));

    expect(body.style.transform).toBe('translateX(0)');
    expect(body.style.transition).not.toBe('');
    expect(el.activeTab).toBe(0);

    transitionEnd(body);
    expect(body.style.transform).toBe('');
    expect(body.style.transition).toBe('');
    vi.useRealTimers();
  });

  it('spring-back falls back to setTimeout when transitionend never fires', () => {
    vi.useFakeTimers(); // freezes Date.now() too, so elapsed is 0 — a slow drag, below the velocity threshold
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');

    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 190, 100));
    body.dispatchEvent(pointerXY('pointerup', 190, 100));

    vi.runAllTimers();
    expect(body.style.transform).toBe('');
    vi.useRealTimers();
  });

  it('reduced motion: a below-threshold release resets the transform instantly without animating', () => {
    stubMatchMedia({ reduced: true });
    vi.useFakeTimers(); // freezes Date.now() too, so elapsed is 0 — a slow drag, below the velocity threshold
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');

    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 190, 100));
    body.dispatchEvent(pointerXY('pointerup', 190, 100));

    expect(body.style.transform).toBe('');
    expect(body.style.transition).toBe('');
    vi.useRealTimers();
  });

  it('a committing release resets the transform immediately with no transition', () => {
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');

    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 110, 100)); // dx = -90, past threshold
    body.dispatchEvent(pointerXY('pointerup', 110, 100));

    expect(el.activeTab).toBe(1);
    expect(body.style.transform).toBe('');
    expect(body.style.transition).toBe('');
  });

  it('a drag below the distance and velocity thresholds does not change tabs', () => {
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');
    const onChange = vi.fn();
    el.addEventListener('modal-tab-change', onChange);

    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000); // slow drag
    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 190, 100)); // dx = -10, well under 20% of 300
    body.dispatchEvent(pointerXY('pointerup', 190, 100));

    expect(el.activeTab).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a fast small flick commits via velocity even below the distance threshold', () => {
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');

    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1050); // 50ms
    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 160, 100)); // dx = -40 in 50ms = 0.8 px/ms > 0.5
    body.dispatchEvent(pointerXY('pointerup', 160, 100));

    expect(el.activeTab).toBe(1);
  });

  it('a vertical-dominant drag drives .body\'s own scroll manually (no native hand-off) and does not change tabs', () => {
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');
    const onChange = vi.fn();
    el.addEventListener('modal-tab-change', onChange);
    body.scrollTop = 0;

    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 190, 250)); // dx=-10, dy=+150 — classifies vertical here
    expect(body.scrollTop).toBe(0); // the classifying move itself doesn't scroll yet (the ~10px dead zone)

    body.dispatchEvent(pointerXY('pointermove', 190, 200)); // finger moves up 50px from its last position
    expect(body.scrollTop).toBe(50); // content follows the finger, same direction native scroll would

    body.dispatchEvent(pointerXY('pointerup', 190, 200));
    expect(el.activeTab).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does nothing when tabCount is 1 or 0', () => {
    const el = mount(); // tabCount defaults to 0
    const body = el.shadowRoot.querySelector('.body');
    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 100, 100));
    body.dispatchEvent(pointerXY('pointerup', 100, 100));
    expect(el.activeTab).toBe(0); // no throw, no change
  });

  it('ignores a drag starting on an interactive element (e.g. a <select> inside slotted content)', () => {
    const el = mountWithTabs(3);
    const select = document.createElement('select');
    el.appendChild(select); // lands in the default slot, inside .body
    const body = el.shadowRoot.querySelector('.body');

    select.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 130, 100));
    body.dispatchEvent(pointerXY('pointerup', 130, 100));

    expect(el.activeTab).toBe(0);
  });

  it('defers to a nested horizontally-scrollable descendant instead of paging tabs', () => {
    const el = mountWithTabs(3);
    const scroller = document.createElement('div');
    Object.defineProperty(scroller, 'scrollWidth', { value: 600 });
    Object.defineProperty(scroller, 'clientWidth', { value: 200 });
    scroller.style.overflowX = 'auto';
    el.appendChild(scroller);

    scroller.dispatchEvent(pointerXY('pointerdown', 200, 100));
    el.shadowRoot.querySelector('.body').dispatchEvent(pointerXY('pointermove', 130, 100));
    el.shadowRoot.querySelector('.body').dispatchEvent(pointerXY('pointerup', 130, 100));

    expect(el.activeTab).toBe(0);
  });

  it('pointercancel tears the in-flight body drag down without changing tabs', () => {
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');
    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 130, 100));
    expect(body.style.transform).toBe('translateX(-70px)');
    body.dispatchEvent(pointerXY('pointercancel', 130, 100));
    expect(el.activeTab).toBe(0);
    expect(body.style.transform).toBe('');
    expect(body.style.transition).toBe('');
  });

  it('pointercancel mid vertical-scroll-replication tears down cleanly without changing tabs', () => {
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');
    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 190, 250)); // classifies vertical
    body.dispatchEvent(pointerXY('pointermove', 190, 220)); // mid manual-scroll replication
    expect(() => body.dispatchEvent(pointerXY('pointercancel', 190, 220))).not.toThrow();
    expect(el.activeTab).toBe(0);
  });

  it('closing the dialog tears down an in-flight body drag', () => {
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');
    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 130, 100));
    expect(() => el.close()).not.toThrow();
    expect(body.style.transform).toBe(''); // teardown clears the live drag transform too
    body.dispatchEvent(pointerXY('pointerup', 130, 100));
    expect(el.activeTab).toBe(0); // teardown already removed the listeners' effect
  });

  it('show() clears a stale body transform left by a prior drag', () => {
    const el = mountWithTabs(3);
    const body = el.shadowRoot.querySelector('.body');
    body.dispatchEvent(pointerXY('pointerdown', 200, 100));
    body.dispatchEvent(pointerXY('pointermove', 130, 100));
    el.close();

    el.show();
    expect(body.style.transform).toBe('');
    expect(body.style.transition).toBe('');
  });

});
