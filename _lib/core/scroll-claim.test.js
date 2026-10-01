// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { attachScrollClaim, dominantAxis, CLAIM_THRESHOLD } from './scroll-claim.js';

// happy-dom has no TouchEvent constructor; the handler only reads touches.length,
// cancelable and preventDefault, so a plain cancelable Event carries enough.
const tmove = (el, { touches = 1, cancelable = true } = {}) => {
  const ev = new Event('touchmove', { cancelable, bubbles: true });
  Object.defineProperty(ev, 'touches', { value: new Array(touches).fill({}) });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
};

describe('dominantAxis', () => {
  it('stays undecided below the threshold on both axes', () => {
    expect(dominantAxis(0, 0)).toBeUndefined();
    expect(dominantAxis(CLAIM_THRESHOLD - 1, CLAIM_THRESHOLD - 1)).toBeUndefined();
  });

  it('reports x when horizontal movement dominates', () => {
    expect(dominantAxis(CLAIM_THRESHOLD, 1)).toBe('x');
    expect(dominantAxis(-40, 10)).toBe('x');
  });

  it('reports y when vertical movement dominates', () => {
    expect(dominantAxis(1, CLAIM_THRESHOLD)).toBe('y');
    expect(dominantAxis(10, -40)).toBe('y');
  });

  it('gives a perfect diagonal to y, so an ambiguous drag scrolls rather than swipes', () => {
    expect(dominantAxis(20, 20)).toBe('y');
  });

  it('still reports x for a shallow diagonal — real swipes are rarely axis-perfect', () => {
    expect(dominantAxis(20, 18)).toBe('x');
  });

  it('decides on either axis crossing the threshold, not on radial distance', () => {
    expect(dominantAxis(CLAIM_THRESHOLD, 0)).toBe('x');
    expect(dominantAxis(0, CLAIM_THRESHOLD)).toBe('y');
  });

  it('serves a vertical-owning consumer as well as a horizontal one', () => {
    // A sheet's dismiss-drag owns 'y'; a tab swipe owns 'x'. Same function, the consumer
    // compares against the axis it owns.
    const drag = { dx: 4, dy: 40 };
    expect(dominantAxis(drag.dx, drag.dy) === 'y').toBe(true);
    expect(dominantAxis(drag.dx, drag.dy) === 'x').toBe(false);
  });
});

describe('attachScrollClaim', () => {
  let el, remove, pending;

  beforeEach(() => {
    pending = false;
    el = document.createElement('div');
    document.body.appendChild(el);
    remove = attachScrollClaim(el, () => pending);
  });

  afterEach(() => { remove?.(); document.body.innerHTML = ''; });

  it('does not prevent touchmove while no claim is pending', () => {
    expect(tmove(el)).toBe(false);
  });

  it('prevents touchmove while a claim is pending', () => {
    pending = true;
    expect(tmove(el)).toBe(true);
  });

  it('leaves multi-touch alone so pinch-zoom keeps working', () => {
    pending = true;
    expect(tmove(el, { touches: 2 })).toBe(false);
  });

  it('does not attempt to cancel an already-uncancelable touchmove', () => {
    pending = true;
    expect(tmove(el, { cancelable: false })).toBe(false);
  });

  it('re-reads the pending state on every move rather than latching', () => {
    pending = true;
    expect(tmove(el)).toBe(true);
    pending = false;
    expect(tmove(el)).toBe(false);
  });

  it('stops preventing once removed', () => {
    pending = true;
    remove();
    remove = null;
    expect(tmove(el)).toBe(false);
  });

  it('registers non-passively, or preventDefault would be ignored', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    const off = attachScrollClaim(document.createElement('div'), () => false);
    const call = spy.mock.calls.find(c => c[0] === 'touchmove');
    expect(call[2]).toEqual({ passive: false });
    off(); spy.mockRestore();
  });
});
