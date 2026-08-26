import { describe, it, expect } from 'vitest';
import '../../app/strings.js';
import { COLOR_PALETTE, swatches, nextColor } from '../../app/utils/color-palette.js';

describe('COLOR_PALETTE', () => {
  it('starts with null (no colour)', () => {
    expect(COLOR_PALETTE[0]).toBeNull();
  });

  it('has 8 entries', () => {
    expect(COLOR_PALETTE).toHaveLength(8);
  });

  it('all non-null entries are hex colour strings', () => {
    COLOR_PALETTE.filter(Boolean).forEach(c => {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});

describe('swatches', () => {
  it('returns one entry per palette colour, in order', () => {
    const result = swatches();
    expect(result).toHaveLength(COLOR_PALETTE.length);
    result.forEach((s, i) => expect(s.color).toBe(COLOR_PALETTE[i]));
  });

  it('labels the null entry "No colour"', () => {
    expect(swatches()[0].label).toBe('No colour');
  });

  it('resolves fresh on every call rather than caching', () => {
    expect(swatches()).not.toBe(swatches());
  });
});

describe('nextColor', () => {
  it('advances from null to the first real colour', () => {
    expect(nextColor(null)).toBe(COLOR_PALETTE[1]);
  });

  it('advances from undefined the same as null', () => {
    expect(nextColor(undefined)).toBe(COLOR_PALETTE[1]);
  });

  it('wraps from the last colour back to null', () => {
    const last = COLOR_PALETTE[COLOR_PALETTE.length - 1];
    expect(nextColor(last)).toBeNull();
  });

  it('advances through the middle of the palette', () => {
    expect(nextColor(COLOR_PALETTE[1])).toBe(COLOR_PALETTE[2]);
  });
});
