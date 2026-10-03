import { describe, it, expect } from 'vitest';
import {
  rowChromeStyles, dragHandleStyles, colorPanelStyles, actionButtonStyles, tagPillStyles,
} from '../../app/utils/row-chrome.js';
import { COLOR_WIDTH, DELETE_WIDTH } from '../../app/utils/row-swipe.js';

// These helpers build CSS text for three components at once (goal-item,
// list-item, lists-page-item), so a typo that used to break one row now
// breaks every row in the app. Hence a direct test: the component tests only
// ever assert the handful of properties they each happen to care about.

const ALL = [
  ['rowChromeStyles', rowChromeStyles('.row')],
  ['dragHandleStyles', dragHandleStyles('.drag-btn')],
  ['colorPanelStyles', colorPanelStyles('.color-panel', COLOR_WIDTH)],
  ['actionButtonStyles', actionButtonStyles('.action-btn', DELETE_WIDTH)],
  ['tagPillStyles', tagPillStyles('--goal-item-tags-display')],
];

describe('row-chrome — the touch-action invariant', () => {
  // The single most expensive mistake available in this file. The Gestures
  // mixin sets touch-action on the HOST, and touch-action intersects down the
  // tree — any value declared here could only ever subtract from it, and
  // subtracting to `none` leaves the browser flinging invisibly, which costs
  // the user's next tap. Three Socle releases shipped a wrong value here.
  // See CLAUDE.md, "Axis ownership".
  it.each(ALL)('%s declares no touch-action', (_name, css) => {
    expect(css).not.toMatch(/touch-action\s*:/);
  });
});

describe('row-chrome — selector interpolation', () => {
  it.each(ALL)('%s writes rules for the selector it was given', (_name, css) => {
    expect(css).toMatch(/\.(row|drag-btn|color-panel|action-btn|tag-pills?)\s*[,:[{]/);
  });

  it('scopes every rule to the caller selector, never a bare element', () => {
    // goal-item calls these with '.bar' rather than '.row' — nothing may
    // leak out and style an unrelated element in the same shadow root.
    const css = rowChromeStyles('.bar');
    expect(css).toContain('.bar');
    expect(css).not.toMatch(/(^|\s)\.row[\s{,:]/);
  });
});

describe('row-chrome — rowChromeStyles', () => {
  const css = rowChromeStyles('.row');

  it('owns --row-gap, the one definition all three rows read', () => {
    expect(css).toMatch(/--row-gap:\s*6px/);
  });

  it('draws the accent stripe from the caller-set --row-accent-color', () => {
    expect(css).toContain('var(--row-accent-width) solid var(--row-accent-color, transparent)');
  });

  it('drops the divider on the last row', () => {
    expect(css).toMatch(/:host\(:last-child\)\s*\.row\s*{\s*border-block-end:\s*none/);
  });

  it('gives the row a focus-visible outline', () => {
    expect(css).toMatch(/\.row:focus-visible/);
    expect(css).toContain('outline: 2px solid var(--color-accent)');
  });

  it('disables the transform transition under prefers-reduced-motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.row\s*{\s*transition:\s*none/);
  });

  it('uses tokens for duration and easing rather than hand-picked literals', () => {
    expect(css).toContain('var(--duration-normal) var(--ease-decelerate)');
  });
});

describe('row-chrome — dragHandleStyles', () => {
  const css = dragHandleStyles('.drag-btn');

  it('meets the full touch target in the block axis', () => {
    expect(css).toContain('min-block-size: var(--touch-target)');
  });

  it('pulls the glyph back onto the row padding edge', () => {
    expect(css).toContain('margin-inline-start: -5px');
  });

  it('leaves svg pointer-events alone — lists-page-item declares that locally', () => {
    expect(css).not.toContain('pointer-events');
  });
});

describe('row-chrome — panel widths', () => {
  it('colorPanelStyles renders the width it is handed', () => {
    expect(colorPanelStyles('.color-panel', COLOR_WIDTH)).toContain('inline-size: 48px');
    expect(colorPanelStyles('.color-panel', 99)).toContain('inline-size: 99px');
  });

  it('actionButtonStyles renders the width it is handed', () => {
    expect(actionButtonStyles('.action-btn', DELETE_WIDTH)).toContain('inline-size: 60px');
  });

  // The widths are passed in rather than imported, so nothing stops a caller
  // pairing a panel with the wrong constant — the panel would then render one
  // width while row-swipe.js commits at another. These pin the pairing the
  // three components actually use.
  it('pairs the colour panel with the colour-swipe width', () => {
    expect(colorPanelStyles('.color-panel', COLOR_WIDTH)).toContain(`inline-size: ${COLOR_WIDTH}px`);
  });

  it('pairs the action button with the delete-swipe width', () => {
    expect(actionButtonStyles('.action-btn', DELETE_WIDTH)).toContain(`inline-size: ${DELETE_WIDTH}px`);
  });

  it('anchors each panel to its own edge', () => {
    expect(colorPanelStyles('.color-panel', COLOR_WIDTH)).toContain('inset-inline-start: 0');
    expect(actionButtonStyles('.action-btn', DELETE_WIDTH)).not.toContain('inset-inline-start');
  });
});

describe('row-chrome — token discipline', () => {
  // Every colour must come from tokens.css. Raw hex/rgb()/hsl() here would
  // land in three components at once and break theming in both modes.
  it.each(ALL)('%s hardcodes no colour literals', (_name, css) => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(rgba?|hsla?)\(/);
  });
});

describe('row-chrome — tagPillStyles', () => {
  const goal = tagPillStyles('--goal-item-tags-display');
  const list = tagPillStyles('--list-item-tags-display');

  it('reads the page-level show/hide property it was given', () => {
    expect(goal).toContain('var(--goal-item-tags-display, flex)');
    expect(list).toContain('var(--list-item-tags-display, flex)');
  });

  it('produces identical rules for both rows apart from that property', () => {
    expect(goal.replace('--goal-item-tags-display', 'X'))
      .toBe(list.replace('--list-item-tags-display', 'X'));
  });

  // Author CSS beats the UA [hidden] rule regardless of specificity, so the
  // display declaration above would keep the container rendering (as an empty
  // gap) without this. Caught once in review; pinned so it stays.
  it('overrides [hidden] explicitly, since it sets display unconditionally', () => {
    expect(goal).toMatch(/\.tag-pills\[hidden\]\s*{\s*display:\s*none/);
  });

  it('takes its dimensions from tokens, not literals', () => {
    expect(goal).toContain('inline-size: var(--tag-pill-width)');
    expect(goal).toContain('block-size: var(--tag-pill-height)');
    expect(goal).toContain('gap: var(--tag-pill-gap)');
    // No bare dimension in the base declarations. Comments are stripped
    // first (they cite measurements in px), and the Failed-row rule is
    // excluded: its 1px is a ring weight, not a design dimension, and has no
    // token to read.
    const declarations = goal.replace(/\/\*[\s\S]*?\*\//g, '');
    const base = declarations.slice(0, declarations.indexOf(':host(['));
    expect(base).not.toMatch(/\b\d+px\b/);
  });

  it('never wraps — a cramped row clips its overflow tags instead of growing', () => {
    expect(goal).toContain('flex-wrap: nowrap');
    expect(goal).toContain('overflow: hidden');
  });

  it('lets pointer events through to the row beneath', () => {
    expect(goal).toContain('pointer-events: none');
  });

  // Measured 1.0-2.9:1 for every palette hue against a Failed row in both
  // themes. The fix outlines the pill rather than re-colouring it, so tags
  // stay distinguishable from each other — re-theming them all to
  // --color-text-inverse (what every other element on the row does) would
  // flatten the only thing a pill encodes.
  it('outlines pills on a Failed row instead of re-colouring them', () => {
    expect(goal).toMatch(/:host\(\[data-failed\]\)\s*\.tag-pill\s*{[^}]*box-shadow:\s*inset[^}]*var\(--color-text-inverse\)/);
  });

  it('does not outline pills on a normal row', () => {
    const declarations = goal.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(declarations.slice(0, declarations.indexOf(':host(['))).not.toContain('box-shadow');
  });
});
