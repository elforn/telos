// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/tag-input/tag-input.js';

function mount(tags = [], existingTags = []) {
  const el = document.createElement('tag-input');
  document.body.appendChild(el);
  el.tags = tags;
  el.existingTags = existingTags;
  return el;
}

function chips(el) {
  return [...el.shadowRoot.querySelectorAll('.tag-chip')];
}

function input(el) {
  return el.shadowRoot.querySelector('.tag-text-input');
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('tag-input — properties', () => {
  it('renders a chip per initial tag', () => {
    const el = mount(['health', 'work']);
    expect(chips(el).map(c => c.dataset.tag)).toEqual(['health', 'work']);
  });

  it('tags getter returns a copy, not a live reference', () => {
    const el = mount(['a']);
    const got = el.tags;
    got.push('b');
    expect(el.tags).toEqual(['a']);
  });

  it('re-renders chips when tags is set again, without dispatching tags-changed', () => {
    const el = mount(['a']);
    const spy = vi.fn();
    el.addEventListener('tags-changed', spy);
    el.tags = ['b', 'c'];
    expect(chips(el).map(c => c.dataset.tag)).toEqual(['b', 'c']);
    expect(spy).not.toHaveBeenCalled();
  });

  it('defaults to empty tags/existingTags when unset', () => {
    const el = document.createElement('tag-input');
    document.body.appendChild(el);
    expect(el.tags).toEqual([]);
    expect(chips(el)).toHaveLength(0);
  });
});

describe('tag-input — adding tags', () => {
  it('adds a tag on Enter and fires tags-changed', () => {
    const el = mount([]);
    const spy = vi.fn();
    el.addEventListener('tags-changed', e => spy(e.detail.tags));
    const inp = input(el);
    inp.value = 'health';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(spy).toHaveBeenCalledWith(['health']);
    expect(chips(el).map(c => c.dataset.tag)).toEqual(['health']);
    expect(inp.value).toBe('');
  });

  it('normalises typed tags to lowercase and trims', () => {
    const el = mount([]);
    const inp = input(el);
    inp.value = '  Health  ';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(el.tags).toEqual(['health']);
  });

  it('ignores a duplicate tag', () => {
    const el = mount(['health']);
    const spy = vi.fn();
    el.addEventListener('tags-changed', spy);
    const inp = input(el);
    inp.value = 'health';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(el.tags).toEqual(['health']);
    expect(spy).not.toHaveBeenCalled();
  });

  it('splits comma-separated input into multiple tags', () => {
    const el = mount([]);
    const inp = input(el);
    inp.value = 'health,work,';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.tags).toEqual(['health', 'work']);
    expect(inp.value).toBe('');
  });

  it('commits a trailing typed tag on blur', () => {
    const el = mount([]);
    const inp = input(el);
    inp.value = 'health';
    inp.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(el.tags).toEqual(['health']);
  });

  it('adds a tag when a suggestion is clicked', () => {
    const el = mount([], ['health', 'homework']);
    const inp = input(el);
    inp.value = 'ho';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot.querySelector('.tag-suggestion').click();
    expect(el.tags).toEqual(['homework']);
  });
});

describe('tag-input — removing tags', () => {
  it('removes a tag when its chip is clicked and fires tags-changed', () => {
    const el = mount(['health', 'work']);
    const spy = vi.fn();
    el.addEventListener('tags-changed', e => spy(e.detail.tags));
    el.shadowRoot.querySelector('.tag-chip[data-tag="health"]').click();
    expect(spy).toHaveBeenCalledWith(['work']);
    expect(chips(el).map(c => c.dataset.tag)).toEqual(['work']);
  });

  it('removes the last tag on Backspace when the input is empty', () => {
    const el = mount(['health', 'work']);
    const inp = input(el);
    inp.value = '';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(el.tags).toEqual(['health']);
  });

  it('does not remove a tag on Backspace when the input has text', () => {
    const el = mount(['health']);
    const inp = input(el);
    inp.value = 'partial';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(el.tags).toEqual(['health']);
  });
});

describe('tag-input — suggestions', () => {
  it('suggests existing tags matching the partial input, excluding already-added ones', () => {
    const el = mount(['work'], ['work', 'workout', 'worry']);
    const inp = input(el);
    inp.value = 'wor';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const suggestions = [...el.shadowRoot.querySelectorAll('.tag-suggestion')].map(b => b.textContent);
    expect(suggestions).toEqual(['workout', 'worry']);
  });

  it('hides suggestions when the input is empty', () => {
    const el = mount([], ['work']);
    const inp = input(el);
    inp.value = 'wor';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.shadowRoot.querySelector('#tag-suggestions').hidden).toBe(true);
  });
});

describe('tag-input — commitPending', () => {
  it('commits uncommitted typed text and returns the resulting tags, without dispatching tags-changed', () => {
    const el = mount(['a']);
    const spy = vi.fn();
    el.addEventListener('tags-changed', spy);
    const inp = input(el);
    inp.value = 'b';
    const result = el.commitPending();
    expect(result).toEqual(['a', 'b']);
    expect(el.tags).toEqual(['a', 'b']);
    expect(inp.value).toBe('');
    expect(spy).not.toHaveBeenCalled();
  });

  it('is a no-op when the input is empty', () => {
    const el = mount(['a']);
    expect(el.commitPending()).toEqual(['a']);
  });
});

describe('tag-input — accessibility', () => {
  it('tag chip has an aria-label containing the tag name', () => {
    const el = mount(['health']);
    const chip = chips(el)[0];
    expect(chip.getAttribute('aria-label')).toContain('health');
  });

  it('tag chip aria-label is not a raw hex value', () => {
    const el = mount(['work']);
    expect(chips(el)[0].getAttribute('aria-label')).not.toMatch(/#[0-9a-fA-F]/);
  });
});
