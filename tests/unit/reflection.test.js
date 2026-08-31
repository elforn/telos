import { describe, it, expect } from 'vitest';
import { REFLECTION_ASPECTS, aggregateScore, aspectAverages } from '../../app/utils/reflection.js';

describe('REFLECTION_ASPECTS', () => {
  it('has 5 entries', () => {
    expect(REFLECTION_ASPECTS).toHaveLength(5);
  });

  it('every entry has a key, labelKey, hintKey, and abbrKey', () => {
    REFLECTION_ASPECTS.forEach(a => {
      expect(typeof a.key).toBe('string');
      expect(typeof a.labelKey).toBe('string');
      expect(typeof a.hintKey).toBe('string');
      expect(typeof a.abbrKey).toBe('string');
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

describe('aspectAverages', () => {
  it('is empty when there are no reflections at all', () => {
    expect(aspectAverages({})).toEqual({});
    expect(aspectAverages(undefined)).toEqual({});
  });

  it('includes the only year in its own average — with one year, the average is that year\'s score', () => {
    const reflections = { '2026': { scores: { people: 4 } } };
    expect(aspectAverages(reflections)).toEqual({ people: 4 });
  });

  it('averages across every year, per aspect, ignoring years that didn\'t rate it', () => {
    const reflections = {
      '2023': { scores: { people: 2, wealth: 4 } },
      '2024': { scores: { people: 4 } },
      '2025': { scores: { wealth: 2 } },
      '2026': { scores: { people: 5, wealth: 5 } },
    };
    const averages = aspectAverages(reflections);
    expect(averages.people).toBe(11 / 3);  // (2 + 4 + 5) / 3 — 2025 didn't rate people
    expect(averages.wealth).toBe(11 / 3);  // (4 + 2 + 5) / 3 — 2024 didn't rate wealth
  });

  it('is the same regardless of which year is being "viewed" — no year argument at all', () => {
    // aspectAverages has no year parameter: the same reflections always
    // produce the same averages, whichever year's card is asking for them.
    const reflections = {
      '2025': { scores: { people: 2 } },
      '2026': { scores: { people: 4 } },
    };
    expect(aspectAverages(reflections)).toEqual({ people: 3 });
  });

  it('omits an aspect entirely when nobody has ever rated it, rather than reporting 0', () => {
    const reflections = {
      '2025': { scores: { people: 3 } },
      '2026': { scores: { people: 4, wonder: 5 } },
    };
    const averages = aspectAverages(reflections);
    expect(averages).toHaveProperty('people');
    expect(averages).toHaveProperty('wonder'); // 2026 did rate it — average is just its own score
    expect(averages).not.toHaveProperty('health'); // nobody, ever, rated health
  });

  it('ignores non-numeric or zero scores the same way aggregateScore does', () => {
    const reflections = {
      '2025': { scores: { people: 0, health: undefined } },
      '2026': { scores: { people: 5 } },
    };
    expect(aspectAverages(reflections)).toEqual({ people: 5 });
  });
});
