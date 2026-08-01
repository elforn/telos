import { describe, it, expect } from 'vitest';
import { parseImportText } from '../../app/utils/parse-import-text.js';

describe('parseImportText', () => {
  it('parses non-empty lines as separate items', () => {
    const items = parseImportText('Alpha\nBeta\nGamma');
    expect(items.map(i => i.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('skips empty lines between items', () => {
    const items = parseImportText('Alpha\n\nBeta');
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Alpha');
    expect(items[1].title).toBe('Beta');
  });

  it('strips leading bullet (- )', () => {
    const items = parseImportText('- Buy milk\n* Read book\n• Exercise');
    expect(items[0].title).toBe('Buy milk');
    expect(items[1].title).toBe('Read book');
    expect(items[2].title).toBe('Exercise');
  });

  it('attaches indented lines as a note on the preceding item', () => {
    const items = parseImportText('Alpha\n  a continuation line\nBeta');
    expect(items[0].title).toBe('Alpha');
    expect(items[0].note).toBe('a continuation line');
    expect(items[1].note).toBeUndefined();
  });

  it('joins multiple indented lines with newline in note', () => {
    const items = parseImportText('Alpha\n  line one\n  line two');
    expect(items[0].note).toBe('line one\nline two');
  });

  it('truncates title at 120 chars at a word boundary', () => {
    const long = 'word '.repeat(30).trim(); // 149 chars
    const items = parseImportText(long);
    expect(items[0].title.length).toBeLessThanOrEqual(120);
    expect(items[0].title.endsWith(' ')).toBe(false);
  });

  it('overflowed title text goes into note', () => {
    const long = 'word '.repeat(30).trim();
    const items = parseImportText(long);
    expect(items[0].note).toBe(long);
  });

  it('extracts a URL from the title text', () => {
    const items = parseImportText('Read this https://example.com article');
    expect(items[0].url).toBe('https://example.com');
  });

  it('extracts a URL from an indented continuation line', () => {
    const items = parseImportText('Check docs\n  see https://docs.example.com for details');
    expect(items[0].url).toBe('https://docs.example.com');
  });

  it('uses the last URL when multiple URLs appear in text', () => {
    const items = parseImportText('See https://first.com and https://second.com');
    expect(items[0].url).toBe('https://second.com');
  });

  it('strips trailing punctuation from extracted URL', () => {
    const items = parseImportText('Read https://example.com.');
    expect(items[0].url).toBe('https://example.com');
  });

  it('returns undefined url when no URL is present', () => {
    const items = parseImportText('No link here');
    expect(items[0].url).toBeUndefined();
  });

  it('returns empty array for blank input', () => {
    expect(parseImportText('')).toHaveLength(0);
    expect(parseImportText('   \n\n  ')).toHaveLength(0);
  });
});
