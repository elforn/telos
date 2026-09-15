// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineStrings } from '../../core/strings.js';
import { toast, _resetToast } from './toast.js';

// happy-dom does not implement pointer capture — no-op it so the swipe-to-
// dismiss handlers (which call setPointerCapture on pointerdown) can run.
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

defineStrings({ 'toast.close': '×' });

describe('toast', () => {
  beforeEach(() => _resetToast());
  afterEach(() => _resetToast());

  // --- basic rendering ---

  it('creates a toast element with the correct class for info', () => {
    toast('Hello');
    const el = document.querySelector('.socle-toast-info');
    expect(el).toBeTruthy();
    expect(el.textContent).toBe('Hello');
  });

  it('creates a success toast', () => {
    toast('Saved', 'success');
    expect(document.querySelector('.socle-toast-success')).toBeTruthy();
  });

  it('creates an error toast', () => {
    toast('Failed', 'error');
    expect(document.querySelector('.socle-toast-error')).toBeTruthy();
  });

  it('toast element has role=status', () => {
    toast('Info');
    expect(document.querySelector('.socle-toast').getAttribute('role')).toBe('status');
  });

  it('injects styles only once', () => {
    toast('A');
    toast('B');
    const styleCount = document.querySelectorAll('style').length;
    toast('C');
    expect(document.querySelectorAll('style').length).toBe(styleCount);
  });

  // --- one toast at a time ---

  it('new toast replaces the active one', () => {
    toast('First');
    toast('Second');
    expect(document.querySelectorAll('.socle-toast').length).toBe(1);
    expect(document.querySelector('.socle-toast-msg').textContent).toBe('Second');
  });

  it('reuses the same container', () => {
    toast('First');
    toast('Second');
    expect(document.querySelectorAll('#toast-container').length).toBe(1);
  });

  // --- top-layer popover ---

  it('marks the container as a manual popover', () => {
    toast('Hi');
    expect(document.querySelector('#toast-container').getAttribute('popover')).toBe('manual');
  });

  it('shows the popover, re-raising it above later top-layer elements on each toast', () => {
    const showPopover = vi.fn();
    const hidePopover = vi.fn();
    HTMLElement.prototype.showPopover = showPopover;
    HTMLElement.prototype.hidePopover = hidePopover;
    try {
      toast('First');
      expect(showPopover).toHaveBeenCalledTimes(1);
      expect(hidePopover).not.toHaveBeenCalled();
      toast('Second');
      expect(hidePopover).toHaveBeenCalledTimes(1); // dropped from top layer…
      expect(showPopover).toHaveBeenCalledTimes(2); // …then re-shown on top
    } finally {
      delete HTMLElement.prototype.showPopover;
      delete HTMLElement.prototype.hidePopover;
    }
  });

  it('falls back gracefully when the Popover API is unavailable', () => {
    expect(() => toast('No popover here')).not.toThrow();
    expect(document.querySelector('.socle-toast')).toBeTruthy();
  });

  // --- auto-dismiss ---

  it('removes the toast after 4000ms by default', () => {
    vi.useFakeTimers();
    toast('Bye');
    expect(document.querySelector('.socle-toast')).toBeTruthy();
    vi.advanceTimersByTime(4000); // fires dismiss; exit animation starts
    vi.advanceTimersByTime(200);  // exit animation completes
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('respects a custom duration', () => {
    vi.useFakeTimers();
    toast('Custom', 'info', { duration: 1000 });
    vi.advanceTimersByTime(999);
    expect(document.querySelector('.socle-toast')).toBeTruthy();
    vi.advanceTimersByTime(201); // 1ms fires dismiss + 200ms exit animation
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  // --- dismiss() handle ---

  it('returns a dismiss function that fades out the toast', () => {
    vi.useFakeTimers();
    const { dismiss } = toast('Handle');
    expect(document.querySelector('.socle-toast')).toBeTruthy();
    dismiss();
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('calling dismiss() twice is a no-op', () => {
    const { dismiss } = toast('Safe');
    dismiss();
    expect(() => dismiss()).not.toThrow();
  });

  // --- action button ---

  it('renders an action button with the given label', () => {
    toast('Done', 'success', { action: { label: 'Undo', onClick: () => {} } });
    const btn = document.querySelector('.socle-toast-btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Undo');
    expect(btn.type).toBe('button');
  });

  it('action button click calls onClick and dismisses', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    toast('Action', 'info', { action: { label: 'Go', onClick } });
    document.querySelector('.socle-toast-btn').click();
    expect(onClick).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('default duration is 5000 when action is present', () => {
    vi.useFakeTimers();
    toast('Act', 'info', { action: { label: 'X', onClick: () => {} } });
    vi.advanceTimersByTime(4999);
    expect(document.querySelector('.socle-toast')).toBeTruthy();
    vi.advanceTimersByTime(201); // 1ms fires dismiss + 200ms exit animation
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  // --- Escape key ---

  it('Escape key dismisses the toast', () => {
    vi.useFakeTimers();
    toast('Press Esc');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('Escape does not call action onClick', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    toast('Esc action', 'info', { action: { label: 'Do it', onClick } });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  // --- pause on focus ---

  it('focusin pauses and focusout resumes the timer', () => {
    vi.useFakeTimers();
    toast('Pause me', 'info', { duration: 3000 });
    const el = document.querySelector('.socle-toast');
    vi.advanceTimersByTime(2000); // 1000ms remaining
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(5000); // timer is paused; toast should remain
    expect(document.querySelector('.socle-toast')).toBeTruthy();
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    vi.advanceTimersByTime(1000); // fires dismiss after remaining 1000ms
    vi.advanceTimersByTime(200);  // exit animation completes
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  // --- persistent toasts ---

  it('duration: Infinity never auto-dismisses', () => {
    vi.useFakeTimers();
    toast('Forever', 'info', { duration: Infinity });
    vi.advanceTimersByTime(60000);
    expect(document.querySelector('.socle-toast')).toBeTruthy();
    vi.useRealTimers();
  });

  it('persistent toast with no action renders a × close button', () => {
    toast('Syncing…', 'info', { duration: Infinity });
    const btn = document.querySelector('.socle-toast-btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('×');
  });

  it('persistent toast × button dismisses without throwing', () => {
    vi.useFakeTimers();
    toast('Syncing…', 'info', { duration: Infinity });
    document.querySelector('.socle-toast-btn').click();
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  // --- update-in-place ---

  it('update() changes the message', () => {
    const { update } = toast('Loading…', 'info', { duration: Infinity });
    update({ message: 'Done!' });
    expect(document.querySelector('.socle-toast-msg').textContent).toBe('Done!');
  });

  it('update() changes the type class', () => {
    const { update } = toast('Loading…', 'info', { duration: Infinity });
    update({ type: 'success' });
    const el = document.querySelector('.socle-toast');
    expect(el.classList.contains('socle-toast-success')).toBe(true);
    expect(el.classList.contains('socle-toast-info')).toBe(false);
  });

  it('update() starts auto-dismiss after a persistent toast', () => {
    vi.useFakeTimers();
    const { update } = toast('Syncing…', 'info', { duration: Infinity });
    update({ message: 'Done', type: 'success' });
    vi.advanceTimersByTime(3999); // 4000ms default, 1ms before dismiss fires
    expect(document.querySelector('.socle-toast')).toBeTruthy();
    vi.advanceTimersByTime(201); // 1ms fires dismiss + 200ms exit animation
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('update() on a removed toast is a no-op', () => {
    const { dismiss, update } = toast('Gone');
    dismiss();
    expect(() => update({ message: 'Too late' })).not.toThrow();
  });

  // --- swipe to dismiss ---

  it('horizontal swipe beyond threshold dismisses the toast', () => {
    vi.useFakeTimers();
    toast('Swipe me');
    const el = document.querySelector('.socle-toast');
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { clientX: 80, bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('short swipe below threshold does not dismiss', () => {
    toast('Stay');
    const el = document.querySelector('.socle-toast');
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 30, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { clientX: 30, bubbles: true }));
    expect(document.querySelector('.socle-toast')).toBeTruthy();
  });

  it('left swipe also dismisses', () => {
    vi.useFakeTimers();
    toast('Left swipe');
    const el = document.querySelector('.socle-toast');
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { clientX: 20, bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('a fast swipe that leaves the toast bounds before release still dismisses it', () => {
    // Regression: without setPointerCapture, this pointerup would be delivered
    // to whatever's under the pointer, not `el` — and never register at all.
    vi.useFakeTimers();
    toast('Fast swipe');
    const el = document.querySelector('.socle-toast');
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { clientX: 300, bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('follows the pointer during the drag', () => {
    toast('Drag me');
    const el = document.querySelector('.socle-toast');
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 25, bubbles: true }));
    expect(el.style.transform).toBe('translateX(25px)');
    expect(Number(el.style.opacity)).toBeLessThan(1);
  });

  it('springs back to rest when released below the threshold', () => {
    toast('Stay put');
    const el = document.querySelector('.socle-toast');
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 30, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { clientX: 30, bubbles: true }));
    expect(document.querySelector('.socle-toast')).toBeTruthy();
    expect(el.style.transform).toBe('');
    expect(el.style.opacity).toBe('');
  });

  it('a cancelled drag (e.g. a system gesture) springs back instead of dismissing', () => {
    toast('Interrupted');
    const el = document.querySelector('.socle-toast');
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 90, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    expect(document.querySelector('.socle-toast')).toBeTruthy();
    expect(el.style.transform).toBe('');
  });

  it('a swipe past the threshold continues outward rather than the default fade', () => {
    vi.useFakeTimers();
    toast('Swipe out');
    const el = document.querySelector('.socle-toast');
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { clientX: 80, bubbles: true }));
    expect(el.style.transform).toBe('translateX(120%)');
    expect(el.classList.contains('socle-toast-out')).toBe(false);
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('respects prefers-reduced-motion by removing immediately on swipe-dismiss', () => {
    const matchMedia = vi.fn(query => ({ matches: query.includes('reduce') }));
    vi.stubGlobal('matchMedia', matchMedia);
    try {
      toast('Reduced motion');
      const el = document.querySelector('.socle-toast');
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
      el.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, bubbles: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { clientX: 80, bubbles: true }));
      expect(document.querySelector('.socle-toast')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not treat a near-zero-movement press as a drag', () => {
    toast('Tap only');
    const el = document.querySelector('.socle-toast');
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 3, bubbles: true }));
    expect(el.style.transform).toBe('');
    el.dispatchEvent(new PointerEvent('pointerup', { clientX: 3, bubbles: true }));
    expect(document.querySelector('.socle-toast')).toBeTruthy();
  });

  // --- action button vs. swipe gesture (regression) ---
  //
  // 0.17.0 fixed the missing setPointerCapture above, but that fix captured
  // immediately on pointerdown — which redirects the resulting click to `el`,
  // silently breaking clicks on the action/close button (a child of `el`,
  // so its own pointerdown bubbles up here too). Capture is now deferred
  // until DRAG_CONFIRM_THRESHOLD is crossed, so a plain press-and-release
  // anywhere — including directly on the button — never captures at all.

  it('does not engage pointer capture for a plain press-and-release on the action button', () => {
    const captureSpy = vi.fn();
    const original = HTMLElement.prototype.setPointerCapture;
    HTMLElement.prototype.setPointerCapture = captureSpy;
    try {
      toast('Deleted', 'info', { action: { label: 'Undo', onClick: () => {} } });
      const btn = document.querySelector('.socle-toast-btn');
      btn.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, bubbles: true }));
      btn.dispatchEvent(new PointerEvent('pointerup', { clientX: 50, bubbles: true }));
      expect(captureSpy).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.setPointerCapture = original;
    }
  });

  it('pressing and releasing directly on the action button still fires onClick', () => {
    const onClick = vi.fn();
    toast('Deleted', 'info', { action: { label: 'Undo', onClick } });
    const btn = document.querySelector('.socle-toast-btn');
    btn.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, bubbles: true }));
    btn.dispatchEvent(new PointerEvent('pointerup', { clientX: 50, bubbles: true }));
    btn.click(); // happy-dom doesn't synthesize click from pointer events; this is what proves the click isn't lost
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('a drag starting on the toast body still dismisses even when an action button is present', () => {
    vi.useFakeTimers();
    toast('Deleted', 'info', { action: { label: 'Undo', onClick: () => {} } });
    const el = document.querySelector('.socle-toast');
    const msg = document.querySelector('.socle-toast-msg');
    msg.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { clientX: 80, bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  // --- mouseenter / mouseleave pause ---

  it('mouseenter pauses and mouseleave resumes the timer', () => {
    vi.useFakeTimers();
    toast('Hover pause', 'info', { duration: 3000 });
    const el = document.querySelector('.socle-toast');
    vi.advanceTimersByTime(2000); // 1000ms remaining
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(5000); // timer paused; toast should remain
    expect(document.querySelector('.socle-toast')).toBeTruthy();
    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    vi.advanceTimersByTime(1000); // fires dismiss after remaining 1000ms
    vi.advanceTimersByTime(200);  // exit animation completes
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  // --- keydown listener cleanup ---

  it('Escape after dismiss is a no-op', () => {
    vi.useFakeTimers();
    const { dismiss } = toast('Gone soon');
    dismiss();
    vi.advanceTimersByTime(200); // let exit animation complete
    expect(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    ).not.toThrow();
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('Escape dismisses only the current toast after replacement', () => {
    vi.useFakeTimers();
    toast('First');
    toast('Second'); // replaces first instantly; also removes its keydown listener
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });
});
