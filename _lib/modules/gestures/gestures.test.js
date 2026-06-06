// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Gestures } from './gestures.js';

HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};
navigator.vibrate = () => {};

let tapSpy, longPressSpy, swipeSpy, swipeMoveSpy;
let holdDragStartSpy, holdDragSpy, holdDragEndSpy, holdDragKeySpy;

customElements.define('t-tap', class extends Gestures(HTMLElement) {
  onTap(e) { tapSpy(e); }
});

customElements.define('t-lp', class extends Gestures(HTMLElement) {
  onLongPress(e) { longPressSpy(e); }
});

customElements.define('t-both', class extends Gestures(HTMLElement) {
  onTap(e) { tapSpy(e); }
  onLongPress(e) { longPressSpy(e); }
});

customElements.define('t-none', class extends Gestures(HTMLElement) {});

customElements.define('t-swipe', class extends Gestures(HTMLElement) {
  onSwipe(e) { swipeSpy(e); }
  onSwipeMove(e) { swipeMoveSpy(e); }
});

customElements.define('t-swipe-tap', class extends Gestures(HTMLElement) {
  onTap(e) { tapSpy(e); }
  onSwipe(e) { swipeSpy(e); }
});

customElements.define('t-holddrag', class extends Gestures(HTMLElement) {
  onHoldDragStart(e) { holdDragStartSpy(e); }
  onHoldDrag(e) { holdDragSpy(e); }
  onHoldDragEnd(e) { holdDragEndSpy(e); }
});

customElements.define('t-holddrag-key', class extends Gestures(HTMLElement) {
  onHoldDragStart(e) { holdDragStartSpy(e); }
  onHoldDrag(e) { holdDragSpy(e); }
  onHoldDragEnd(e) { holdDragEndSpy(e); }
  onHoldDragKey(dir) { holdDragKeySpy(dir); }
});

const pdown = (el, x = 0, y = 0) =>
  el.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true }));
const pmove = (el, x, y) =>
  el.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
const pup = (el, x = 0, y = 0) =>
  el.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true }));
const pcancel = (el) =>
  el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));

describe('Gestures — tap', () => {
  let el;

  beforeEach(() => {
    tapSpy = vi.fn();
    el = document.createElement('t-tap');
    document.body.appendChild(el);
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('fires onTap on pointerup within threshold', () => {
    pdown(el); pup(el);
    expect(tapSpy).toHaveBeenCalledTimes(1);
  });

  it('does not fire when movement exceeds 18px', () => {
    pdown(el, 0, 0); pmove(el, 20, 0); pup(el, 20, 0);
    expect(tapSpy).not.toHaveBeenCalled();
  });

  it('does not fire on pointercancel', () => {
    pdown(el); pcancel(el);
    expect(tapSpy).not.toHaveBeenCalled();
  });

  it('fires for multiple sequential taps', () => {
    pdown(el); pup(el);
    pdown(el); pup(el);
    expect(tapSpy).toHaveBeenCalledTimes(2);
  });

  it('ignores non-primary button', () => {
    el.dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true }));
    pup(el);
    expect(tapSpy).not.toHaveBeenCalled();
  });

  it('passes normalised event to onTap', () => {
    pdown(el, 10, 20); pup(el, 11, 21);
    const e = tapSpy.mock.calls[0][0];
    expect(e.type).toBe('tap');
    expect(e.startX).toBe(10);
    expect(e.startY).toBe(20);
    expect(e.endX).toBe(11);
    expect(e.endY).toBe(21);
    expect(typeof e.distance).toBe('number');
    expect(typeof e.duration).toBe('number');
    expect(e.direction).toBeNull();
    expect(e.velocity).toBeNull();
    expect(e.originalEvent).toBeInstanceOf(PointerEvent);
  });

  it('sets touch-action: manipulation', () => {
    expect(el.style.touchAction).toBe('manipulation');
  });
});

describe('Gestures — long press', () => {
  let el;

  beforeEach(() => {
    vi.useFakeTimers();
    longPressSpy = vi.fn();
    el = document.createElement('t-lp');
    document.body.appendChild(el);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('fires onLongPress after 500ms with no movement', () => {
    pdown(el);
    vi.advanceTimersByTime(500);
    expect(longPressSpy).toHaveBeenCalledTimes(1);
  });

  it('does not fire before 500ms', () => {
    pdown(el);
    vi.advanceTimersByTime(499);
    expect(longPressSpy).not.toHaveBeenCalled();
  });

  it('does not fire when movement exceeds 18px before timer', () => {
    pdown(el, 0, 0);
    pmove(el, 20, 0);
    vi.advanceTimersByTime(500);
    expect(longPressSpy).not.toHaveBeenCalled();
  });

  it('does not fire when pointerup before 500ms', () => {
    pdown(el);
    vi.advanceTimersByTime(300);
    pup(el);
    vi.advanceTimersByTime(200);
    expect(longPressSpy).not.toHaveBeenCalled();
  });

  it('passes normalised event to onLongPress', () => {
    pdown(el, 5, 10);
    vi.advanceTimersByTime(500);
    const e = longPressSpy.mock.calls[0][0];
    expect(e.type).toBe('longpress');
    expect(e.startX).toBe(5);
    expect(e.startY).toBe(10);
    expect(e.endX).toBe(5);
    expect(e.endY).toBe(10);
    expect(e.distance).toBe(0);
    expect(e.direction).toBeNull();
    expect(e.velocity).toBeNull();
    expect(e.originalEvent).toBeInstanceOf(PointerEvent);
  });

  it('sets user-select: none', () => {
    expect(el.style.userSelect).toBe('none');
  });
});

describe('Gestures — tap suppressed after long press', () => {
  let el;

  beforeEach(() => {
    vi.useFakeTimers();
    tapSpy = vi.fn();
    longPressSpy = vi.fn();
    el = document.createElement('t-both');
    document.body.appendChild(el);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('does not fire onTap after onLongPress fires', () => {
    pdown(el);
    vi.advanceTimersByTime(500);
    pup(el);
    expect(longPressSpy).toHaveBeenCalledTimes(1);
    expect(tapSpy).not.toHaveBeenCalled();
  });
});

describe('Gestures — no handlers registered', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('does not set touch-action', () => {
    const el = document.createElement('t-none');
    document.body.appendChild(el);
    expect(el.style.touchAction).toBe('');
  });
});

describe('Gestures — lifecycle', () => {
  let el;

  beforeEach(() => {
    tapSpy = vi.fn();
    el = document.createElement('t-tap');
    document.body.appendChild(el);
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('does not fire after disconnect', () => {
    pdown(el);
    document.body.removeChild(el);
    pup(el);
    expect(tapSpy).not.toHaveBeenCalled();
  });

  it('fires after reconnect', () => {
    document.body.removeChild(el);
    document.body.appendChild(el);
    pdown(el); pup(el);
    expect(tapSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── swipe ───────────────────────────────────────────────────────────────────

describe('Gestures — swipe', () => {
  let el;

  beforeEach(() => {
    swipeSpy = vi.fn();
    swipeMoveSpy = vi.fn();
    el = document.createElement('t-swipe');
    document.body.appendChild(el);
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('fires onSwipe on horizontal swipe right', () => {
    pdown(el, 0, 0); pmove(el, 50, 2); pup(el, 50, 2);
    expect(swipeSpy).toHaveBeenCalledTimes(1);
  });

  it('fires onSwipe on horizontal swipe left', () => {
    pdown(el, 100, 0); pmove(el, 50, 2); pup(el, 50, 2);
    expect(swipeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not fire on vertical movement', () => {
    pdown(el, 0, 0); pmove(el, 2, 50); pup(el, 2, 50);
    expect(swipeSpy).not.toHaveBeenCalled();
  });

  it('does not fire below threshold', () => {
    pdown(el, 0, 0); pmove(el, 5, 0); pup(el, 5, 0);
    expect(swipeSpy).not.toHaveBeenCalled();
  });

  it('direction is right for positive dx', () => {
    pdown(el, 0, 0); pmove(el, 50, 0); pup(el, 50, 0);
    expect(swipeSpy.mock.calls[0][0].direction).toBe('right');
  });

  it('direction is left for negative dx', () => {
    pdown(el, 100, 0); pmove(el, 50, 0); pup(el, 50, 0);
    expect(swipeSpy.mock.calls[0][0].direction).toBe('left');
  });

  it('velocity is a positive number', () => {
    vi.useFakeTimers();
    pdown(el, 0, 0);
    vi.advanceTimersByTime(100);
    pmove(el, 80, 0); pup(el, 80, 0);
    vi.useRealTimers();
    expect(swipeSpy.mock.calls[0][0].velocity).toBeGreaterThan(0);
  });

  it('distance equals absolute dx', () => {
    pdown(el, 0, 0); pmove(el, 80, 0); pup(el, 80, 0);
    expect(swipeSpy.mock.calls[0][0].distance).toBe(80);
  });

  it('fires onSwipeMove during horizontal lock', () => {
    pdown(el, 0, 0); pmove(el, 30, 2); pmove(el, 60, 2); pup(el, 60, 2);
    expect(swipeMoveSpy).toHaveBeenCalled();
    expect(swipeMoveSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('does not fire onSwipeMove on vertical movement', () => {
    pdown(el, 0, 0); pmove(el, 2, 50); pup(el, 2, 50);
    expect(swipeMoveSpy).not.toHaveBeenCalled();
  });

  it('onSwipeMove event has dx field', () => {
    pdown(el, 0, 0); pmove(el, 50, 0); pup(el, 50, 0);
    const e = swipeMoveSpy.mock.calls[0][0];
    expect(e.type).toBe('swipemove');
    expect(typeof e.dx).toBe('number');
  });

  it('sets touch-action: pan-y', () => {
    expect(el.style.touchAction).toBe('pan-y');
  });
});

describe('Gestures — swipe + tap coexistence', () => {
  let el;

  beforeEach(() => {
    tapSpy = vi.fn();
    swipeSpy = vi.fn();
    el = document.createElement('t-swipe-tap');
    document.body.appendChild(el);
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('tap fires on pointerup with no movement', () => {
    pdown(el); pup(el);
    expect(tapSpy).toHaveBeenCalledTimes(1);
    expect(swipeSpy).not.toHaveBeenCalled();
  });

  it('swipe fires and tap does not on horizontal movement', () => {
    pdown(el, 0, 0); pmove(el, 50, 0); pup(el, 50, 0);
    expect(swipeSpy).toHaveBeenCalledTimes(1);
    expect(tapSpy).not.toHaveBeenCalled();
  });

  it('neither fires on vertical movement (yield to scroll)', () => {
    pdown(el, 0, 0); pmove(el, 2, 50); pup(el, 2, 50);
    expect(swipeSpy).not.toHaveBeenCalled();
    expect(tapSpy).not.toHaveBeenCalled();
  });
});

// ─── holdDrag ────────────────────────────────────────────────────────────────

describe('Gestures — holdDrag', () => {
  let el;

  beforeEach(() => {
    vi.useFakeTimers();
    holdDragStartSpy = vi.fn();
    holdDragSpy = vi.fn();
    holdDragEndSpy = vi.fn();
    el = document.createElement('t-holddrag');
    document.body.appendChild(el);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('fires onHoldDragStart after 500ms hold', () => {
    pdown(el);
    vi.advanceTimersByTime(500);
    expect(holdDragStartSpy).toHaveBeenCalledTimes(1);
  });

  it('does not fire onHoldDragStart before 500ms', () => {
    pdown(el);
    vi.advanceTimersByTime(499);
    expect(holdDragStartSpy).not.toHaveBeenCalled();
  });

  it('fires onHoldDrag on pointermove after hold fires', () => {
    pdown(el, 0, 0);
    vi.advanceTimersByTime(500);
    pmove(el, 30, 0);
    expect(holdDragSpy).toHaveBeenCalledTimes(1);
  });

  it('fires onHoldDrag with correct dx', () => {
    pdown(el, 0, 0);
    vi.advanceTimersByTime(500);
    pmove(el, 40, 0);
    expect(holdDragSpy.mock.calls[0][0].dx).toBe(40);
  });

  it('fires onHoldDragEnd on pointerup after hold', () => {
    pdown(el, 0, 0);
    vi.advanceTimersByTime(500);
    pmove(el, 40, 0);
    pup(el, 40, 0);
    expect(holdDragEndSpy).toHaveBeenCalledTimes(1);
  });

  it('fires onHoldDragEnd on pointercancel after hold', () => {
    pdown(el);
    vi.advanceTimersByTime(500);
    pcancel(el);
    expect(holdDragEndSpy).toHaveBeenCalledTimes(1);
  });

  it('cancels when movement exceeds threshold before hold fires', () => {
    pdown(el, 0, 0);
    pmove(el, 20, 0);
    vi.advanceTimersByTime(500);
    expect(holdDragStartSpy).not.toHaveBeenCalled();
  });

  it('does not fire onHoldDrag before hold fires', () => {
    pdown(el, 0, 0);
    pmove(el, 30, 0); // movement before 500ms
    vi.advanceTimersByTime(500);
    expect(holdDragSpy).not.toHaveBeenCalled();
  });

  it('onHoldDragStart event has type holddragstart', () => {
    pdown(el);
    vi.advanceTimersByTime(500);
    expect(holdDragStartSpy.mock.calls[0][0].type).toBe('holddragstart');
  });

  it('onHoldDrag event has type holddrag and direction', () => {
    pdown(el, 0, 0);
    vi.advanceTimersByTime(500);
    pmove(el, 30, 0);
    const e = holdDragSpy.mock.calls[0][0];
    expect(e.type).toBe('holddrag');
    expect(e.direction).toBe('right');
  });

  it('does not fire hold when vertical movement before timer', () => {
    pdown(el, 0, 0);
    pmove(el, 2, 50);
    vi.advanceTimersByTime(500);
    expect(holdDragStartSpy).not.toHaveBeenCalled();
  });

  it('sets touch-action: pan-y', () => {
    expect(el.style.touchAction).toBe('pan-y');
  });

  it('sets user-select: none', () => {
    expect(el.style.userSelect).toBe('none');
  });

  it('calls navigator.vibrate(40) when hold fires', () => {
    const vibrateSpy = vi.spyOn(navigator, 'vibrate');
    pdown(el);
    vi.advanceTimersByTime(500);
    expect(vibrateSpy).toHaveBeenCalledWith(40);
  });
});

// ─── Gestures.attach ─────────────────────────────────────────────────────────

describe('Gestures.attach', () => {
  let child, parent;

  beforeEach(() => {
    vi.useFakeTimers();
    holdDragStartSpy = vi.fn();
    holdDragSpy = vi.fn();
    holdDragEndSpy = vi.fn();
    parent = document.createElement('div');
    child = document.createElement('div');
    parent.appendChild(child);
    document.body.appendChild(parent);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('fires onHoldDragStart after 500ms hold on child element', () => {
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy });
    child.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(holdDragStartSpy).toHaveBeenCalledTimes(1);
  });

  it('fires onHoldDrag on move after hold', () => {
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy, onHoldDrag: holdDragSpy });
    child.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, button: 0, bubbles: true }));
    vi.advanceTimersByTime(500);
    child.dispatchEvent(new PointerEvent('pointermove', { clientX: 40, clientY: 0, bubbles: true }));
    expect(holdDragSpy).toHaveBeenCalledTimes(1);
    expect(holdDragSpy.mock.calls[0][0].dx).toBe(40);
  });

  it('fires onHoldDragEnd on pointerup after hold', () => {
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy, onHoldDragEnd: holdDragEndSpy });
    child.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    vi.advanceTimersByTime(500);
    child.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(holdDragEndSpy).toHaveBeenCalledTimes(1);
  });

  it('fires onHoldDragEnd on pointercancel', () => {
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy, onHoldDragEnd: holdDragEndSpy });
    child.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    vi.advanceTimersByTime(500);
    child.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    expect(holdDragEndSpy).toHaveBeenCalledTimes(1);
  });

  it('cancels when movement before hold fires', () => {
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy });
    child.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, button: 0, bubbles: true }));
    child.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 0, bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(holdDragStartSpy).not.toHaveBeenCalled();
  });

  it('cleanup removes all listeners', () => {
    const cleanup = Gestures.attach(child, { onHoldDragStart: holdDragStartSpy });
    cleanup();
    child.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(holdDragStartSpy).not.toHaveBeenCalled();
  });

  it('stopPropagation prevents parent receiving pointerdown', () => {
    const parentSpy = vi.fn();
    parent.addEventListener('pointerdown', parentSpy);
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy });
    child.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    expect(parentSpy).not.toHaveBeenCalled();
  });

  it('does not fire hold on vertical movement before timer', () => {
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy });
    child.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, button: 0, bubbles: true }));
    child.dispatchEvent(new PointerEvent('pointermove', { clientX: 2, clientY: 50, bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(holdDragStartSpy).not.toHaveBeenCalled();
  });

  it('sets touch-action: pan-y on element', () => {
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy });
    expect(child.style.touchAction).toBe('pan-y');
  });

  it('calls navigator.vibrate(40) when hold fires', () => {
    const vibrateSpy = vi.spyOn(navigator, 'vibrate');
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy });
    child.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(vibrateSpy).toHaveBeenCalledWith(40);
  });
});

describe('Gestures — onHoldDragKey (mixin)', () => {
  let el;

  beforeEach(() => {
    holdDragStartSpy = vi.fn();
    holdDragSpy      = vi.fn();
    holdDragEndSpy   = vi.fn();
    holdDragKeySpy   = vi.fn();
    el = document.createElement('t-holddrag-key');
    document.body.appendChild(el);
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('calls onHoldDragKey("right") on ArrowRight', () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(holdDragKeySpy).toHaveBeenCalledWith('right');
  });

  it('calls onHoldDragKey("left") on ArrowLeft', () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(holdDragKeySpy).toHaveBeenCalledWith('left');
  });

  it('does not call onHoldDragKey for other keys', () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(holdDragKeySpy).not.toHaveBeenCalled();
  });

  it('does not wire keyboard on element without onHoldDragKey', () => {
    const plain = document.createElement('t-holddrag');
    document.body.appendChild(plain);
    const spy = vi.fn();
    plain.onHoldDragKey = spy;
    plain.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('Gestures.attach — keyboard parity', () => {
  let child;

  beforeEach(() => {
    holdDragStartSpy = vi.fn();
    holdDragKeySpy   = vi.fn();
    child = document.createElement('div');
    document.body.appendChild(child);
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('auto-sets tabindex="0" on hold-drag element', () => {
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy });
    expect(child.getAttribute('tabindex')).toBe('0');
  });

  it('does not overwrite existing tabindex', () => {
    child.setAttribute('tabindex', '-1');
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy });
    expect(child.getAttribute('tabindex')).toBe('-1');
  });

  it('calls onHoldDragKey("right") on ArrowRight', () => {
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy, onHoldDragKey: holdDragKeySpy });
    child.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(holdDragKeySpy).toHaveBeenCalledWith('right');
  });

  it('calls onHoldDragKey("left") on ArrowLeft', () => {
    Gestures.attach(child, { onHoldDragStart: holdDragStartSpy, onHoldDragKey: holdDragKeySpy });
    child.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(holdDragKeySpy).toHaveBeenCalledWith('left');
  });

  it('cleanup removes keyboard listener', () => {
    const cleanup = Gestures.attach(child, { onHoldDragStart: holdDragStartSpy, onHoldDragKey: holdDragKeySpy });
    cleanup();
    child.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(holdDragKeySpy).not.toHaveBeenCalled();
  });
});
