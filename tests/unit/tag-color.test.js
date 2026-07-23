import { describe, it, expect } from 'vitest';
import { tagColor, tagStrip } from '../../app/utils/tag-color.js';

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

describe('tagStrip', () => {
  it('returns empty string for empty tags array', () => {
    expect(tagStrip([])).toBe('');
  });

  it('returns a single color (no gradient) for a single tag', () => {
    const result = tagStrip(['fitness']);
    expect(result).toBe(tagColor('fitness'));
    expect(result).not.toContain('linear-gradient');
  });

  it('returns a linear-gradient for two tags', () => {
    expect(tagStrip(['work', 'health'])).toMatch(/^linear-gradient/);
  });

  it('returns a linear-gradient for multiple tags', () => {
    expect(tagStrip(['a', 'b', 'c'])).toMatch(/^linear-gradient\(to right,/);
  });

  it('caps segments at 6 when more than 6 tags are provided', () => {
    const sevenTags = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const sixTags   = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(tagStrip(sevenTags)).toBe(tagStrip(sixTags));
  });

  it('is deterministic — same tags always return the same strip', () => {
    const tags = ['work', 'health', 'fitness'];
    expect(tagStrip(tags)).toBe(tagStrip(tags));
  });
});
