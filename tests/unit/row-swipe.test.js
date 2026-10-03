// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  COLOR_WIDTH, DELETE_WIDTH, COMMIT_RATIO, COMMIT_VELOCITY, DEAD_ZONE,
  swipeOffset, swipeCommitted, trackSwipe, closeReveal,
} from '../../app/utils/row-swipe.js';

// These are the exact literals all three row components independently used
// before the extraction. Pinning them here means a change to any one is a
// deliberate, visible edit rather than a silent re-tune of every row at once.
describe('row-swipe — constants', () => {
  it('keeps the widths and thresholds the three rows converged on', () => {
    expect(COLOR_WIDTH).toBe(48);
    expect(DELETE_WIDTH).toBe(60);
    expect(COMMIT_RATIO).toBe(2.0);
    expect(COMMIT_VELOCITY).toBe(0.35);
    expect(DEAD_ZONE).toBe(15);
  });
});

describe('row-swipe — swipeCommitted', () => {
  it('commits once distance reaches ratio × width', () => {
    expect(swipeCommitted({ distance: 119, velocity: 0 }, DELETE_WIDTH)).toBe(false);
    expect(swipeCommitted({ distance: 120, velocity: 0 }, DELETE_WIDTH)).toBe(true);
  });

  it('commits on a fast flick regardless of distance', () => {
    expect(swipeCommitted({ distance: 0, velocity: 0.34 }, DELETE_WIDTH)).toBe(false);
    expect(swipeCommitted({ distance: 0, velocity: 0.35 }, DELETE_WIDTH)).toBe(true);
  });

  it('scales its distance threshold with the panel being revealed', () => {
    expect(swipeCommitted({ distance: 96, velocity: 0 }, COLOR_WIDTH)).toBe(true);
    expect(swipeCommitted({ distance: 96, velocity: 0 }, DELETE_WIDTH)).toBe(false);
  });
});

describe('row-swipe — swipeOffset while opening', () => {
  const opts = { deleteWidth: DELETE_WIDTH, colorWidth: COLOR_WIDTH };

  it('swallows the first DEAD_ZONE px in both directions', () => {
    expect(swipeOffset({ dx: 15 }, opts)).toBe(0);
    expect(swipeOffset({ dx: -15 }, opts)).toBe(0);
    expect(swipeOffset({ dx: 16 }, opts)).toBe(1);
    expect(swipeOffset({ dx: -16 }, opts)).toBe(-1);
  });

  it('clamps to the colour panel on the right and the delete panel on the left', () => {
    expect(swipeOffset({ dx: 500 }, opts)).toBe(COLOR_WIDTH);
    expect(swipeOffset({ dx: -500 }, opts)).toBe(-DELETE_WIDTH);
  });
});

describe('row-swipe — swipeOffset with no delete panel (lists-page-item)', () => {
  it('refuses to move at all on a left swipe', () => {
    for (const dx of [-1, -15, -16, -100, -500]) {
      expect(swipeOffset({ dx }, { colorWidth: COLOR_WIDTH })).toBe(0);
    }
  });

  it('still opens the colour panel on a right swipe', () => {
    expect(swipeOffset({ dx: 30 }, { colorWidth: COLOR_WIDTH })).toBe(15);
    expect(swipeOffset({ dx: 500 }, { colorWidth: COLOR_WIDTH })).toBe(COLOR_WIDTH);
  });
});

describe('row-swipe — swipeOffset while the delete panel is already revealed', () => {
  const opts = { revealed: 'left', deleteWidth: DELETE_WIDTH, colorWidth: COLOR_WIDTH };

  it('tracks from the open position with no dead zone', () => {
    expect(swipeOffset({ dx: 0 }, opts)).toBe(-DELETE_WIDTH);
    expect(swipeOffset({ dx: 10 }, opts)).toBe(-50);
  });

  it('never drags further open than the panel is wide', () => {
    expect(swipeOffset({ dx: -200 }, opts)).toBe(-260);
    expect(swipeOffset({ dx: 200 }, opts)).toBe(0);
  });
});

describe('row-swipe — DOM helpers', () => {
  let row;
  beforeEach(() => { row = document.createElement('div'); });

  it('trackSwipe pins the row to the finger with no transition', () => {
    row.style.transition = 'transform 1s linear';
    trackSwipe(row, -42);
    expect(row.style.transition).toBe('none');
    expect(row.style.transform).toBe('translateX(-42px)');
  });

  it('closeReveal springs back to rest', () => {
    window.matchMedia = () => ({ matches: false });
    row.style.transform = 'translateX(-60px)';
    closeReveal(row);
    expect(row.style.transform).toBe('');
    expect(row.style.transition).toBe('transform 0.28s var(--ease-spring)');
  });

  // The curve comes from tokens.css rather than a repeated literal. happy-dom
  // won't resolve it, so this only pins the reference — an e2e/browser check
  // is what proves it actually computes (it does: verified as
  // cubic-bezier(0.34, 1.56, 0.64, 1) on all three rows, both themes).
  it('closeReveal reads the easing from a token, not a hardcoded curve', () => {
    window.matchMedia = () => ({ matches: false });
    closeReveal(row);
    expect(row.style.transition).toContain('var(--ease-spring)');
    expect(row.style.transition).not.toContain('cubic-bezier');
  });

  it('closeReveal skips the spring under prefers-reduced-motion', () => {
    const real = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    closeReveal(row);
    expect(row.style.transition).toBe('none');
    window.matchMedia = real;
  });
});
