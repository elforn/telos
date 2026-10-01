// Claiming a touch sequence from the browser.
//
// A gesture that moves content horizontally has to stop the browser scrolling, or the browser
// generates a fling for the same finger movement. Under `touch-action: none` that fling has
// nothing to move, so it runs invisibly and spends the user's next tap cancelling itself — a
// tap lost for no visible reason. The fix is not to take both axes away, but to leave the
// browser the axis it should own and claim the other one explicitly.
//
// Pointer events cannot do this: they are passive with respect to scrolling, so
// `preventDefault()` on pointermove has no effect. Only a non-passive `touchmove` listener can.
//
// The listener must be registered permanently on the element, NOT per-gesture on pointerdown.
// Chrome only leaves `touchmove` cancelable when a blocking listener already existed as the
// touch sequence began. Verified on-device: registering inside `pointerdown` missed the claim
// on a 3.2 px/ms diagonal flick (`cancelable` was already false), while permanent registration
// missed none in ten at comparable speeds.

// Axis decision threshold. Deliberately smaller than a tap/swipe threshold: at flick speed the
// first touchmove is already a ~50px jump, so a decision taken later arrives after the browser
// has committed and there is no earlier move left to claim on.
export const CLAIM_THRESHOLD = 6;

// Which axis this movement is, once it is big enough to tell: 'x', 'y', or undefined while
// still undecided. Plain axis dominance — matching what was validated on-device, where
// diagonal swipes up to ~43 degrees were still correctly claimed.
//
// Each consumer owns one axis and compares against it, so the same function serves a
// horizontal gesture (a tab swipe, which owns 'x') and a vertical one (a sheet's
// dismiss-drag, which owns 'y'). A consumer that has decided the gesture is not its own
// stores null — distinct from undefined, so it never re-decides.
export const dominantAxis = (dx, dy) => {
  if (Math.abs(dx) < CLAIM_THRESHOLD && Math.abs(dy) < CLAIM_THRESHOLD) return undefined;
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
};

// `claimPending` is called on every touchmove and must return true only while the gesture is
// ours. Returns a function that removes the listener.
export const attachScrollClaim = (element, claimPending) => {
  const onTouchMove = (e) => {
    if (e.touches.length !== 1) return; // never interfere with pinch-zoom
    if (claimPending() && e.cancelable) e.preventDefault();
  };
  element.addEventListener('touchmove', onTouchMove, { passive: false });
  return () => element.removeEventListener('touchmove', onTouchMove, { passive: false });
};
