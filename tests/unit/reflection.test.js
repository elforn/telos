import { describe, it, expect } from 'vitest';
import { REFLECTION_ASPECTS, aggregateScore, historicalAspectAverages } from '../../app/utils/reflection.js';

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

describe('historicalAspectAverages', () => {
  it('is empty when there are no other years', () => {
    const reflections = { '2026': { scores: { people: 4 } } };
    expect(historicalAspectAverages(reflections, 2026)).toEqual({});
  });

  it('excludes the year being viewed from its own average', () => {
    const reflections = {
      '2025': { scores: { people: 2 } },
      '2026': { scores: { people: 5 } },
    };
    // Only 2025 counts — 2026 must not be averaged against itself.
    expect(historicalAspectAverages(reflections, 2026)).toEqual({ people: 2 });
  });

  it('averages across every other year, per aspect, ignoring years that didn\'t rate it', () => {
    const reflections = {
      '2023': { scores: { people: 2, wealth: 4 } },
      '2024': { scores: { people: 4 } },
      '2025': { scores: { wealth: 2 } },
      '2026': { scores: { people: 5, wealth: 5 } },
    };
    const averages = historicalAspectAverages(reflections, 2026);
    expect(averages.people).toBe(3);   // (2 + 4) / 2 — 2025 didn't rate people
    expect(averages.wealth).toBe(3);   // (4 + 2) / 2 — 2024 didn't rate wealth
  });

  it('omits an aspect entirely when no other year has rated it, rather than reporting 0', () => {
    const reflections = {
      '2025': { scores: { people: 3 } },
      '2026': { scores: { people: 4, wonder: 5 } },
    };
    const averages = historicalAspectAverages(reflections, 2026);
    expect(averages).toHaveProperty('people');
    expect(averages).not.toHaveProperty('wonder');
  });

  it('accepts a numeric year and matches string-keyed reflections', () => {
    const reflections = {
      '2025': { scores: { people: 1 } },
      '2026': { scores: { people: 5 } },
    };
    expect(historicalAspectAverages(reflections, 2026)).toEqual({ people: 1 });
  });

  it('ignores non-numeric or zero scores the same way aggregateScore does', () => {
    const reflections = {
      '2025': { scores: { people: 0, health: undefined } },
      '2026': { scores: { people: 5 } },
    };
    expect(historicalAspectAverages(reflections, 2026)).toEqual({});
  });
});
