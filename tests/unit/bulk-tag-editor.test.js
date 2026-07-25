// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/bulk-tag-editor/bulk-tag-editor.js';

function mount(selectedTags = [], existingTags = []) {
  const el = document.createElement('bulk-tag-editor');
  document.body.appendChild(el);
  el.selectedTags = selectedTags;
  el.existingTags = existingTags;
  return el;
}

function chips(el) {
  return [...el.shadowRoot.querySelectorAll('.tag-chip')];
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('bulk-tag-editor — chip states', () => {
  it('renders a tag on ALL items as a solid chip', () => {
    const el = mount([['work', 'q3'], ['work']]);
    const work = chips(el).find(c => c.dataset.tag === 'work');
    expect(work).toBeTruthy();
    expect(work.classList.contains('partial')).toBe(false);
  });

  it('renders a tag on SOME items as a dim (partial) chip', () => {
    const el = mount([['work', 'q3'], ['work']]);
    const q3 = chips(el).find(c => c.dataset.tag === 'q3');
    expect(q3).toBeTruthy();
    expect(q3.classList.contains('partial')).toBe(true);
  });

  it('treats a single selected item as all tags common (no partials)', () => {
    const el = mount([['work', 'q3']]);
    expect(chips(el).every(c => !c.classList.contains('partial'))).toBe(true);
  });
});

describe('bulk-tag-editor — events', () => {
  it('fires bulk-tag-apply when a new tag is typed and Enter pressed', () => {
    const el = mount([['work'], ['work']], []);
    const spy = vi.fn();
    el.addEventListener('bulk-tag-apply', e => spy(e.detail.tag));
    const input = el.shadowRoot.querySelector('.tag-input');
    input.value = 'urgent';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(spy).toHaveBeenCalledWith('urgent');
  });

  it('normalises typed tags to lowercase and trims', () => {
    const el = mount([['work']], []);
    const spy = vi.fn();
    el.addEventListener('bulk-tag-apply', e => spy(e.detail.tag));
    const input = el.shadowRoot.querySelector('.tag-input');
    input.value = '  Urgent  ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(spy).toHaveBeenCalledWith('urgent');
  });

  it('fires bulk-tag-remove when a chip × is clicked', () => {
    const el = mount([['work'], ['work']]);
    const spy = vi.fn();
    el.addEventListener('bulk-tag-remove', e => spy(e.detail.tag));
    el.shadowRoot.querySelector('.tag-chip .tag-chip-x').click();
    expect(spy).toHaveBeenCalledWith('work');
  });

  it('fires bulk-tag-apply when a dim (partial) chip label is tapped', () => {
    const el = mount([['work', 'q3'], ['work']]);
    const spy = vi.fn();
    el.addEventListener('bulk-tag-apply', e => spy(e.detail.tag));
    const q3 = chips(el).find(c => c.dataset.tag === 'q3');
    q3.querySelector('.tag-label').click();
    expect(spy).toHaveBeenCalledWith('q3');
  });

  it('a solid chip has no apply-label button (only ×)', () => {
    const el = mount([['work'], ['work']]);
    const work = chips(el).find(c => c.dataset.tag === 'work');
    expect(work.querySelector('.tag-label')).toBeNull();
    expect(work.querySelector('.tag-chip-x')).not.toBeNull();
  });

  it('does not fire apply when a solid chip body is tapped', () => {
    const el = mount([['work'], ['work']]);
    const apply = vi.fn();
    el.addEventListener('bulk-tag-apply', apply);
    const work = chips(el).find(c => c.dataset.tag === 'work');
    work.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('bulk-tag-editor — suggestions', () => {
  it('suggests existing tags matching the partial input, excluding common ones', () => {
    const el = mount([['work'], ['work']], ['work', 'workout', 'worry']);
    const input = el.shadowRoot.querySelector('.tag-input');
    input.value = 'wor';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const suggestions = [...el.shadowRoot.querySelectorAll('.suggestion')].map(b => b.textContent);
    expect(suggestions).toContain('workout');
    expect(suggestions).toContain('worry');
    expect(suggestions).not.toContain('work'); // already common
  });
});
