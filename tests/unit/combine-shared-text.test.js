import { describe, it, expect } from 'vitest';
import { combineSharedText } from '../../app/utils/combine-shared-text.js';
import { parseImportText } from '../../app/utils/parse-import-text.js';

describe('combineSharedText', () => {
  it('uses text as-is when only text is present', () => {
    expect(combineSharedText({ text: 'Buy milk\nCall dentist' })).toBe('Buy milk\nCall dentist');
  });

  it('uses url as-is when only url is present', () => {
    expect(combineSharedText({ url: 'https://example.com' })).toBe('https://example.com');
  });

  it('indents url under title when only title and url are present', () => {
    const combined = combineSharedText({ title: 'Cool article', url: 'https://example.com' });
    expect(combined).toBe('Cool article\n  https://example.com');
  });

  it('indents single-line text and url under title', () => {
    const combined = combineSharedText({
      title: 'Cool article', text: 'Worth reading', url: 'https://example.com',
    });
    expect(combined).toBe('Cool article\n  Worth reading\n  https://example.com');
  });

  it('does not duplicate the url line when it is already embedded in text', () => {
    const combined = combineSharedText({
      title: 'Cool article', text: 'See https://example.com', url: 'https://example.com',
    });
    expect(combined).toBe('Cool article\n  See https://example.com');
  });

  it('indents every line of multi-line text under title', () => {
    const combined = combineSharedText({ title: 'Grocery list', text: 'Milk\nEggs\nBread' });
    expect(combined).toBe('Grocery list\n  Milk\n  Eggs\n  Bread');
  });

  it('drops title/url entirely when only text is present, preserving multi-item text', () => {
    const combined = combineSharedText({ text: 'Milk\nEggs\nBread' });
    expect(combined).toBe('Milk\nEggs\nBread');
  });

  it('returns empty string when nothing is present', () => {
    expect(combineSharedText({})).toBe('');
    expect(combineSharedText()).toBe('');
  });

  // Round-trip through the real parser confirms what actually lands in the
  // dialog, not just the intermediate string shape.
  describe('round-tripped through parseImportText', () => {
    it('title + url → one item, url attached', () => {
      const items = parseImportText(combineSharedText({ title: 'Cool article', url: 'https://example.com' }));
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Cool article');
      expect(items[0].url).toBe('https://example.com');
    });

    it('title + short text + url → one item with note and url', () => {
      const items = parseImportText(combineSharedText({
        title: 'Cool article', text: 'Worth reading', url: 'https://example.com',
      }));
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Cool article');
      expect(items[0].note).toBe('Worth reading\nhttps://example.com');
      expect(items[0].url).toBe('https://example.com');
    });

    it('text only, multi-line → splits into separate items as today\'s "Add from text" already does', () => {
      const items = parseImportText(combineSharedText({ text: 'Milk\nEggs\nBread' }));
      expect(items.map(i => i.title)).toEqual(['Milk', 'Eggs', 'Bread']);
    });
  });
});
