// A delete button fires on `pointerup` and removes its row. On touch the browser
// then synthesizes a `click` (~10ms later) at the same screen point — by which
// time the row is gone and the add row that shifted up under the finger receives
// it, opening an unwanted dialog. Rather than swallow the click globally (which
// would also eat an undo tap), record when a delete happened; the add-dialog
// click handlers consult this and ignore a click within the ghost-click window.

let lastDeleteAt = -Infinity;

export function markDelete() {
  lastDeleteAt = performance.now();
}

export function isGhostClickAfterDelete(windowMs = 350) {
  return performance.now() - lastDeleteAt < windowMs;
}

// Test isolation.
export function _resetDeleteGuard() { lastDeleteAt = -Infinity; }
