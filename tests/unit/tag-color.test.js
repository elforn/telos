import { describe, it, expect } from 'vitest';
import { tagColor } from '../../app/utils/tag-color.js';

describe('tagColor', () => {
  it('returns an hsla string', () => {
    expect(tagColor('work')).toMatch(/^hsla\(/);
  });

  it('is deterministic — same tag always returns the same color', () => {
    expect(tagColor('health')).toBe(tagColor('health'));
  });

  it('produces different colors for different tags', () => {
    expect(tagColor('work')).not.toBe(tagColor('health'));
  });

  it('uses 50% saturation and 58% lightness', () => {
    expect(tagColor('anything')).toMatch(/hsla\(\d+, 50%, 58%, 0\.8\)/);
  });
});
