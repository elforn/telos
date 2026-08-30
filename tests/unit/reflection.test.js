import { describe, it, expect } from 'vitest';
import { REFLECTION_ASPECTS, aggregateScore } from '../../app/utils/reflection.js';

describe('REFLECTION_ASPECTS', () => {
  it('has 5 entries', () => {
    expect(REFLECTION_ASPECTS).toHaveLength(5);
  });

  it('every entry has a key, labelKey, and hintKey', () => {
    REFLECTION_ASPECTS.forEach(a => {
      expect(typeof a.key).toBe('string');
      expect(typeof a.labelKey).toBe('string');
      expect(typeof a.hintKey).toBe('string');
    });
  });

  it('keys are unique', () => {
    const keys = REFLECTION_ASPECTS.map(a => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('aggregateScore', () => {
  it('is undefined when no reflection exists', () => {
    expect(aggregateScore(undefined)).toBeUndefined();
    expect(aggregateScore(null)).toBeUndefined();
  });

  it('is undefined when a reflection exists but nothing is scored', () => {
    expect(aggregateScore({ scores: {}, comment: 'just a note' })).toBeUndefined();
  });

  it('averages only the scores that are set (partial)', () => {
    expect(aggregateScore({ scores: { people: 4, health: 2 } })).toBe(3);
  });

  it('averages all 5 scores when fully rated', () => {
    expect(aggregateScore({ scores: { people: 5, health: 4, wealth: 3, contribution: 2, wonder: 1 } })).toBe(3);
  });

  it('rounds to 1 decimal place', () => {
    expect(aggregateScore({ scores: { people: 5, health: 5, wealth: 4 } })).toBe(4.7);
  });

  it('ignores non-numeric or zero scores', () => {
    expect(aggregateScore({ scores: { people: 5, health: 0, wealth: undefined } })).toBe(5);
  });
});
