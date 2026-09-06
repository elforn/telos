// Shared row/bar chrome for the app's three flush, edge-to-edge "row"
// components — goal-item, list-item, lists-page-item. Extracted once all
// three had independently converged on the same values (a 56px floor height,
// a 5px accent stripe, a border-block-end divider suppressed on the last
// child, transform-based swipe with matching reduced-motion handling) —
// same rationale/pattern as urgency-badge.js's shared calendar-icon styles.
//
// Callers keep their own class name (list-item/lists-page-item use .row,
// goal-item uses .bar — renaming goal-item's ~1000 lines of existing
// [data-*] selectors and JS querySelectors for a naming-only gain wasn't
// worth the risk) and set the shared --row-accent-color custom property
// themselves in _update(), e.g. `this._row.style.setProperty('--row-accent-color', color ?? 'transparent')`.
// Callers layer their own extra properties (block-size, padding-block, gap,
// overflow) in a separate rule using the same selector — genuinely different
// per component (goal-item has no gap; lists-page-item deliberately has no
// overflow:hidden, see its own archive-dot comment for why).
//
// Two real inconsistencies surfaced while unifying these three and are fixed
// here rather than carried forward: only lists-page-item disabled the base
// transform transition under prefers-reduced-motion (list-item/goal-item
// didn't, so a reduced-motion user still got an animated shift on drag-
// reorder there); and only lists-page-item had a :focus-visible outline on
// its row at all (the other two had no keyboard-focus indication), despite
// `outline: 2px solid var(--color-accent); outline-offset: 2px;` being this
// app's universal focus-visible convention everywhere else.
//
// --row-accent-width and the transition's duration/easing were all
// previously hand-picked literals (0.25s cubic-bezier(0.32, 0.72, 0, 1))
// duplicated identically across all three components — centralising them
// here was the point to swap in tokens.css's own --duration-normal (220ms,
// closest defined step to the original 250ms) and --ease-decelerate
// (cubic-bezier(0.05, 0.7, 0.1, 1), the closest defined curve to the
// original) rather than carry the un-tokenised values forward again.
export function rowChromeStyles(selector) {
  return `
    ${selector} {
      position: relative;
      z-index: 1;
      background: var(--color-surface);
      border-block-end: 1px solid var(--color-border);
      border-inline-start: var(--row-accent-width) solid var(--row-accent-color, transparent);
      display: flex;
      align-items: center;
      padding-inline-start: calc(var(--space-3) - var(--row-accent-width));
      padding-inline-end: var(--space-3);
      cursor: pointer;
      user-select: none;
      touch-action: pan-y;
      transition: transform var(--duration-normal) var(--ease-decelerate);
      will-change: transform;
    }

    ${selector}:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    :host(:last-child) ${selector} {
      border-block-end: none;
    }

    @media (prefers-reduced-motion: reduce) {
      ${selector} { transition: none; }
    }
  `;
}
