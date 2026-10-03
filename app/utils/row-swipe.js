// Shared swipe mechanics for the app's three flush, edge-to-edge "row"
// components — goal-item, list-item, lists-page-item. Companion to
// row-chrome.js (which owns their shared *styles*); this file owns the
// behaviour the three had independently converged on, down to identical
// numbers: the same dead zone, the same commit thresholds, the same
// snap-back spring, and — in goal-item's and list-item's case — the same
// two-direction offset arithmetic character for character.
//
// Deliberately plain functions rather than a mixin. Each component keeps its
// own onSwipe/onSwipeMove methods (that's the Gestures mixin's interface, and
// each fires a differently-named event with a differently-shaped detail), so
// a mixin would only have added an inheritance layer between the mixin and
// the component without removing any of the per-component code that actually
// differs.
//
// NOTHING HERE TOUCHES touch-action OR REGISTERS A LISTENER. Axis arbitration
// is owned by the Gestures mixin (on the host) and is deliberately left
// undeclared by row-chrome.js — see its own comment, and CLAUDE.md's
// "Axis ownership" note, for why a descendant must never redeclare it.

export const COLOR_WIDTH = 48;      // left-side colour panel, revealed by swiping right
export const DELETE_WIDTH = 60;     // right-side delete button, revealed by swiping left
export const COMMIT_RATIO = 2.0;    // fraction of reveal width needed to commit
export const COMMIT_VELOCITY = 0.35; // px/ms — fast flick commits regardless
export const DEAD_ZONE = 15;        // px of drag before the row starts moving

// Snap-back after a non-committed swipe. Deliberately NOT row-chrome.js's
// --duration-normal/--ease-decelerate pairing: that one governs the row's
// resting transform (drag-reorder shifts), this is an overshooting spring,
// and the two were always different curves.
//
// The curve all three rows hardcoded turned out to be --ease-spring verbatim,
// so it reads the token. The 280ms stays a literal: tokens.css offers 120 /
// 220 / 380 / 480ms and none of them is this, so pointing at the nearest one
// would be a retune disguised as a cleanup. Set as an inline style, which
// resolves the custom property against the row's own computed value — the
// token inherits from :root through the shadow boundary.
const SNAP_BACK = 'transform 0.28s var(--ease-spring)';

// Did this swipe travel far enough, or fast enough, to count?
export function swipeCommitted(e, width) {
  return e.distance >= width * COMMIT_RATIO || e.velocity >= COMMIT_VELOCITY;
}

// How far the row should sit from its resting position mid-drag.
//
// `revealed === 'left'` means the delete panel is already open and this drag
// is closing it: track the finger from the open position, clamped so it can
// never be dragged further open than the panel is wide.
//
// Otherwise the finger is opening something: subtract the dead zone (so a
// vertical-ish scroll doesn't visibly nudge the row), then clamp to whatever
// each side actually has. `deleteWidth: 0` is a real, supported case —
// lists-page-item has no delete panel at all, and clamping the negative side
// to zero is exactly how it stays put against a left swipe.
export function swipeOffset(e, { revealed = null, deleteWidth = 0, colorWidth = COLOR_WIDTH } = {}) {
  if (revealed === 'left') return Math.min(0, -deleteWidth + e.dx);
  const dx = e.dx > 0 ? Math.max(0, e.dx - DEAD_ZONE) : Math.min(0, e.dx + DEAD_ZONE);
  const offset = Math.max(-deleteWidth, Math.min(colorWidth, dx));
  // Normalise -0 (what `Math.max(-0, -0)` yields on the deleteWidth: 0 path)
  // so callers never see a signed zero. It makes no difference to the CSS
  // either way — `translateX(${-0}px)` already stringifies to "0px" — but a
  // utility handing back -0 is a trap for any future caller that compares.
  return offset === 0 ? 0 : offset;
}

// Pin the row to the finger: no transition while tracking, or every frame
// would lag a fixed duration behind the pointer.
export function trackSwipe(row, offset) {
  row.style.transition = 'none';
  row.style.transform = `translateX(${offset}px)`;
}

// Spring back to rest. Callers that track a revealed direction clear it
// themselves afterwards — that's component state, not row state.
export function closeReveal(row) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  row.style.transition = reduced ? 'none' : SNAP_BACK;
  row.style.transform = '';
}
