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
      /* Spacing between a row's own children. Not a token: 6px sits between
         --space-1 (4px) and --space-2 (8px), and all three rows had
         independently picked it — lists-page-item as a named custom property,
         list-item and goal-item as bare literals. Declared here so there is
         one definition and three readers. goal-item applies it as a start
         margin on its title column rather than as a gap, since a gap on the
         row would also re-space its right-hand cluster; it inherits this
         value from here all the same. */
      --row-gap: 6px;
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
      /* No touch-action here. The Gestures mixin sets pan-y pinch-zoom on the
         HOST for any component with onSwipe, and touch-action intersects down
         the tree — a descendant can only ever subtract. Declaring pan-y here
         stripped pinch-zoom from every row in the app. */
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

// ── Drag handle ──────────────────────────────────────────────────────────────
// All three rows carry an identical ⠿ grip button, and all three had an
// identical 17-declaration rule for it. The `-5px` start margin pulls the
// button's own padding box back so the glyph lands on the row's padding edge;
// `min-block-size` is the full touch target even though the glyph is small
// (see the accepted-exception note in memory about its inline size).
//
// Deliberately does NOT include `svg { pointer-events: none }` — only
// lists-page-item ever had that, and adding it to the other two would change
// which element a pointerdown targets. It makes no functional difference
// (the listener is on the button and pointer events bubble), but this helper
// exists to remove duplication, not to quietly change behaviour; the one
// component that wants it keeps declaring it locally.
export function dragHandleStyles(selector) {
  return `
    ${selector} {
      position: relative;
      z-index: 1;
      flex-shrink: 0;
      min-block-size: var(--touch-target);
      background: none;
      border: none;
      cursor: grab;
      color: var(--color-text-muted);
      opacity: 0.45;
      font-size: var(--font-size-body);
      display: flex;
      align-items: center;
      justify-content: center;
      padding-block: 0;
      padding-inline: 0 2px;
      margin-inline-start: -5px;
      font-family: var(--font-family);
      /* No touch-action. Hold-drag claims the touch sequence on activation
         (core/scroll-claim.js); taking both axes here only stopped the page
         scrolling from the handle, and left the browser flinging invisibly —
         which costs the user's next tap. */
    }
  `;
}

// ── Swipe panels ─────────────────────────────────────────────────────────────
// The colour panel sits under the row's start edge and is uncovered by
// swiping right; the action (delete) button sits under the end edge and is
// uncovered by swiping left. Both are plain siblings *behind* the row —
// neither moves; the row slides over them (see row-swipe.js).
//
// Widths come from row-swipe.js's COLOR_WIDTH/DELETE_WIDTH and are passed in
// rather than imported here, so this stays a pure styles module with no
// behavioural dependency.
export function colorPanelStyles(selector, width) {
  return `
    ${selector} {
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: ${width}px;
      background: var(--color-panel-bg, var(--color-surface-raised));
    }
  `;
}

export function actionButtonStyles(selector, width) {
  return `
    ${selector} {
      position: absolute;
      inset-block: 0;
      inline-size: ${width}px;
      color: var(--color-text-inverse);
      border: none;
      cursor: pointer;
      font-size: var(--font-size-caption);
      font-weight: var(--font-weight-semibold);
      font-family: var(--font-family);
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `;
}

// ── Tag pills ────────────────────────────────────────────────────────────────
// A row of short pill/oval dots, one per tag, no text — goal-item and
// list-item render identical strips and had identical rules for them.
//
// Replaced an earlier full-width strip along the row's bottom edge (list-item
// first, goal-item later): once rows sit flush against each other, a bar
// spanning the whole row width reads as a second divider line touching the
// next row's own border. Each dot's colour is tag-color.js's hash-derived
// hue, set inline per pill.
//
// Never wraps — a row that runs out of horizontal space clips the overflow
// tags rather than growing past its fixed height.
//
// `displayVar` is the page-level show/hide custom property for that row type
// (--goal-item-tags-display / --list-item-tags-display), written onto
// documentElement by year-header.js and list-detail-page.js respectively.
export function tagPillStyles(displayVar) {
  return `
    .tag-pills {
      display: var(${displayVar}, flex);
      align-items: center;
      flex-wrap: nowrap;
      gap: var(--tag-pill-gap);
      overflow: hidden;
      pointer-events: none;
    }

    /* Required, not defensive: the rule above sets a display value
       unconditionally, and author CSS beats the UA [hidden] rule regardless
       of specificity — without this the container still renders (as an empty
       gap) while hidden. happy-dom cannot catch this; it needs a real
       getComputedStyle assertion. */
    .tag-pills[hidden] { display: none; }

    .tag-pill {
      flex-shrink: 0;
      inline-size: var(--tag-pill-width);
      block-size: var(--tag-pill-height);
      border-radius: var(--radius-full);
    }

    /* On a Failed row the whole surface goes red, and a tag's hash-derived
       hue has no contrast left against it (measured: 1.0–2.9:1 for every hue
       in the palette, in both themes). Every other element on the row
       re-themes to --color-text-inverse here; the pills deliberately don't —
       that would flatten every tag to the same colour and throw away the one
       thing they encode. An outline instead keeps the hue and just gives the
       shape a legible edge.

       Inset rather than an outer ring or a border: .tag-pills clips its
       overflow, so an outer ring would be shaved off the first pill's start
       edge, and a real border would eat 2 of the pill's 9px of height. */
    :host([data-failed]) .tag-pill {
      box-shadow: inset 0 0 0 1px var(--color-text-inverse);
    }
  `;
}
