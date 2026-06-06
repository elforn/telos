import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defineStrings, setLocale, getLocale, t, reset } from './strings.js';

const _ls = (() => {
  let store = {};
  return {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  vi.stubGlobal('localStorage', _ls);
  _ls.clear();
  reset();
});

describe('defineStrings / t', () => {
  it('returns key when no string registered', () => {
    expect(t('missing.key')).toBe('missing.key');
  });

  it('resolves English strings by default', () => {
    defineStrings({ 'foo.bar': 'Hello' });
    expect(t('foo.bar')).toBe('Hello');
  });

  it('registers strings for a specific locale', () => {
    defineStrings({ 'foo.bar': 'Hello' });
    defineStrings({ 'foo.bar': 'Bonjour' }, 'fr');
    setLocale('fr');
    expect(t('foo.bar')).toBe('Bonjour');
  });

  it('falls back to English when key missing in active locale', () => {
    defineStrings({ 'foo.bar': 'Hello', 'foo.only-en': 'Only English' });
    defineStrings({ 'foo.bar': 'Bonjour' }, 'fr');
    setLocale('fr');
    expect(t('foo.only-en')).toBe('Only English');
  });

  it('falls back to key when missing in all locales', () => {
    setLocale('fr');
    expect(t('totally.missing')).toBe('totally.missing');
  });

  it('substitutes params into {placeholders}', () => {
    defineStrings({ 'foo.tpl': 'Hello {name}, you have {count} items' });
    expect(t('foo.tpl', { name: 'Alice', count: 3 })).toBe('Hello Alice, you have 3 items');
  });

  it('leaves unreplaced placeholder when param is missing', () => {
    defineStrings({ 'foo.tpl': 'Export {year}' });
    expect(t('foo.tpl', {})).toBe('Export {year}');
  });

  it('returns string unchanged when params is omitted', () => {
    defineStrings({ 'foo.plain': 'No placeholders' });
    expect(t('foo.plain')).toBe('No placeholders');
  });
});

describe('setLocale / getLocale', () => {
  it('defaults to en', () => {
    expect(getLocale()).toBe('en');
  });

  it('persists locale to localStorage', () => {
    defineStrings({}, 'fr');
    setLocale('fr');
    expect(localStorage.getItem('locale')).toBe('fr');
    expect(getLocale()).toBe('fr');
  });

  it('falls back to en for unknown locale', () => {
    setLocale('xx');
    expect(getLocale()).toBe('en');
  });
});

describe('reset', () => {
  it('clears all strings and resets locale to en', () => {
    defineStrings({ 'foo.bar': 'Hello' });
    defineStrings({ 'foo.bar': 'Bonjour' }, 'fr');
    setLocale('fr');
    reset();
    expect(t('foo.bar')).toBe('foo.bar');
    expect(getLocale()).toBe('en');
  });
});
