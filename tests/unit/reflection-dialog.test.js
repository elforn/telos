// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import '../../app/strings.js';
import '../../app/components/reflection-dialog/reflection-dialog.js';
import { REFLECTION_ASPECTS } from '../../app/utils/reflection.js';

function mount() {
  const el = document.createElement('reflection-dialog');
  document.body.appendChild(el);
  el._dialog.show  = vi.fn();
  el._dialog.close = vi.fn();
  return el;
}

function starGroup(el, aspect) {
  return el.shadowRoot.querySelector(`.star-group[data-aspect="${aspect}"]`);
}

function star(el, aspect, value) {
  return starGroup(el, aspect).querySelector(`.star-btn[data-value="${value}"]`);
}

afterEach(() => { document.body.innerHTML = ''; });

// ── Structure ─────────────────────────────────────────────────────────────────

describe('reflection-dialog — structure', () => {
  it('renders one radiogroup per aspect', () => {
    const el = mount();
    REFLECTION_ASPECTS.forEach(a => {
      expect(starGroup(el, a.key)).not.toBeNull();
      expect(starGroup(el, a.key).getAttribute('role')).toBe('radiogroup');
    });
  });

  it('renders 5 stars per aspect', () => {
    const el = mount();
    REFLECTION_ASPECTS.forEach(a => {
      expect(starGroup(el, a.key).querySelectorAll('.star-btn')).toHaveLength(5);
    });
  });

  it('renders a comment textarea', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#reflection-comment')).not.toBeNull();
  });

  it('renders a real heading for the dialog title', () => {
    const el = mount();
    const title = el.shadowRoot.querySelector('.reflection-title');
    expect(title.tagName).toBe('H2');
    expect(title.textContent).toBe('Year in review');
  });

  it('renders a Close button and a visibility toggle inside a single full-width footer slot child', () => {
    const el = mount();
    const wrapper = el.shadowRoot.querySelector('.dialog-footer');
    expect(wrapper.getAttribute('slot')).toBe('footer');
    expect(wrapper.querySelector('#reflection-close-btn')).not.toBeNull();
    expect(wrapper.querySelector('#reflection-visibility-btn')).not.toBeNull();
  });

  it('labels the close button "Close", not "Done"', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#reflection-close-btn').textContent).toBe('Close');
  });

  it('the visibility toggle is text, not an icon', () => {
    const el = mount();
    el.open(null);
    const btn = el.shadowRoot.querySelector('#reflection-visibility-btn');
    expect(btn.querySelector('svg')).toBeNull();
    expect(btn.textContent.trim().length).toBeGreaterThan(0);
  });
});

// ── live score ────────────────────────────────────────────────────────────────

describe('reflection-dialog — live score', () => {
  it('is hidden when nothing is rated yet', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#reflection-live-score').hidden).toBe(true);
  });

  it('shows the pre-filled aggregate on open', () => {
    const el = mount();
    el.open({ scores: { people: 4, health: 4 } });
    expect(el.shadowRoot.querySelector('#reflection-live-score').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#reflection-live-score').textContent).toBe('★ 4.0');
  });

  it('updates live as a star is tapped', () => {
    const el = mount();
    el.open({ scores: { people: 4, health: 4 } });
    star(el, 'wealth', 1).click();
    expect(el.shadowRoot.querySelector('#reflection-live-score').textContent).toBe('★ 3.0');
  });
});

// ── Close button ──────────────────────────────────────────────────────────────

describe('reflection-dialog — Close button', () => {
  it('closes the dialog', () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#reflection-close-btn').click();
    expect(el._dialog.close).toHaveBeenCalledOnce();
  });
});

// ── visibility toggle ─────────────────────────────────────────────────────────

describe('reflection-dialog — visibility toggle', () => {
  it('defaults to visible (aria-pressed=true, labelled "Hide") when the reflection has no showCard field', () => {
    const el = mount();
    el.open({ scores: { people: 4 } });
    const btn = el.shadowRoot.querySelector('#reflection-visibility-btn');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.textContent).toBe('Hide');
  });

  it('reflects showCard:false on open as not pressed, labelled "Show"', () => {
    const el = mount();
    el.open({ scores: { people: 4 }, showCard: false });
    const btn = el.shadowRoot.querySelector('#reflection-visibility-btn');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.textContent).toBe('Show');
  });

  it('dispatches reflection-visibility-changed with visible:false on toggle', () => {
    const el = mount();
    el.open(null);
    let detail;
    el.addEventListener('reflection-visibility-changed', e => { detail = e.detail; });
    el.shadowRoot.querySelector('#reflection-visibility-btn').click();
    expect(detail).toEqual({ visible: false });
    expect(el.shadowRoot.querySelector('#reflection-visibility-btn').getAttribute('aria-pressed')).toBe('false');
  });

  it('toggling twice returns to visible:true', () => {
    const el = mount();
    el.open(null);
    const btn = el.shadowRoot.querySelector('#reflection-visibility-btn');
    const detail = [];
    el.addEventListener('reflection-visibility-changed', e => detail.push(e.detail));
    btn.click();
    btn.click();
    expect(detail).toEqual([{ visible: false }, { visible: true }]);
  });
});

// ── star tap animation ────────────────────────────────────────────────────────

describe('reflection-dialog — star tap feedback', () => {
  it('adds a .pop class to the tapped star, then removes it', () => {
    vi.useFakeTimers();
    const el = mount();
    el.open(null);
    const btn = star(el, 'people', 3);
    btn.click();
    expect(btn.classList.contains('pop')).toBe(true);
    vi.advanceTimersByTime(400);
    expect(btn.classList.contains('pop')).toBe(false);
    vi.useRealTimers();
  });

  it('pops every filled star up to the tapped value, not just the tapped one', () => {
    const el = mount();
    el.open(null);
    star(el, 'people', 4).click();
    [1, 2, 3, 4].forEach(n => expect(star(el, 'people', n).classList.contains('pop')).toBe(true));
    expect(star(el, 'people', 5).classList.contains('pop')).toBe(false);
  });

  it('clears all popped stars after the animation duration', () => {
    vi.useFakeTimers();
    const el = mount();
    el.open(null);
    star(el, 'people', 4).click();
    vi.advanceTimersByTime(400);
    [1, 2, 3, 4].forEach(n => expect(star(el, 'people', n).classList.contains('pop')).toBe(false));
    vi.useRealTimers();
  });
});

// ── open() ────────────────────────────────────────────────────────────────────

describe('reflection-dialog — open()', () => {
  it('opens the dialog', () => {
    const el = mount();
    el.open(null);
    expect(el._dialog.show).toHaveBeenCalledOnce();
  });

  it('pre-fills stars from an existing reflection', () => {
    const el = mount();
    el.open({ scores: { people: 3 }, comment: 'hi' });
    expect(star(el, 'people', 3).classList.contains('filled')).toBe(true);
    expect(star(el, 'people', 3).getAttribute('aria-checked')).toBe('true');
    expect(star(el, 'people', 4).classList.contains('filled')).toBe(false);
  });

  it('pre-fills the comment textarea', () => {
    const el = mount();
    el.open({ scores: {}, comment: 'a note' });
    expect(el.shadowRoot.querySelector('#reflection-comment').value).toBe('a note');
  });

  it('roving tabindex: only the selected star is tabbable, the rest are -1', () => {
    const el = mount();
    el.open({ scores: { people: 3 } });
    [1, 2, 4, 5].forEach(n => expect(star(el, 'people', n).tabIndex).toBe(-1));
    expect(star(el, 'people', 3).tabIndex).toBe(0);
  });

  it('roving tabindex defaults to the first star when nothing is rated yet', () => {
    const el = mount();
    el.open(null);
    expect(star(el, 'people', 1).tabIndex).toBe(0);
    [2, 3, 4, 5].forEach(n => expect(star(el, 'people', n).tabIndex).toBe(-1));
  });

  it('blanks the form for null (no existing reflection)', () => {
    const el = mount();
    el.open({ scores: { people: 5 }, comment: 'old' });
    el.open(null);
    expect(star(el, 'people', 5).classList.contains('filled')).toBe(false);
    expect(el.shadowRoot.querySelector('#reflection-comment').value).toBe('');
  });
});

// ── star tap ──────────────────────────────────────────────────────────────────

describe('reflection-dialog — star tap', () => {
  it('dispatches reflection-score-changed with the tapped aspect/value', () => {
    const el = mount();
    el.open(null);
    let detail;
    el.addEventListener('reflection-score-changed', e => { detail = e.detail; });
    star(el, 'health', 4).click();
    expect(detail).toEqual({ key: 'health', value: 4 });
  });

  it('fills stars 1..value and leaves the rest empty', () => {
    const el = mount();
    el.open(null);
    star(el, 'health', 3).click();
    [1, 2, 3].forEach(n => expect(star(el, 'health', n).classList.contains('filled')).toBe(true));
    [4, 5].forEach(n => expect(star(el, 'health', n).classList.contains('filled')).toBe(false));
  });

  it('only the exact selected value is aria-checked', () => {
    const el = mount();
    el.open(null);
    star(el, 'health', 3).click();
    expect(star(el, 'health', 3).getAttribute('aria-checked')).toBe('true');
    expect(star(el, 'health', 2).getAttribute('aria-checked')).toBe('false');
    expect(star(el, 'health', 4).getAttribute('aria-checked')).toBe('false');
  });

  it('event is composed and bubbles out of shadow DOM', () => {
    const el = mount();
    el.open(null);
    let event;
    document.body.addEventListener('reflection-score-changed', e => { event = e; });
    star(el, 'health', 2).click();
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('re-tapping a different aspect does not affect the first', () => {
    const el = mount();
    el.open(null);
    star(el, 'people', 5).click();
    star(el, 'wonder', 2).click();
    expect(star(el, 'people', 5).classList.contains('filled')).toBe(true);
  });
});

// ── keyboard ──────────────────────────────────────────────────────────────────

describe('reflection-dialog — keyboard', () => {
  it('ArrowRight increments the value and commits', () => {
    const el = mount();
    el.open({ scores: { people: 2 } });
    let detail;
    el.addEventListener('reflection-score-changed', e => { detail = e.detail; });
    star(el, 'people', 2).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    expect(detail).toEqual({ key: 'people', value: 3 });
  });

  it('ArrowRight moves DOM focus onto the new star (roving tabindex follows selection)', () => {
    const el = mount();
    el.open({ scores: { people: 2 } });
    star(el, 'people', 2).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    expect(el.shadowRoot.activeElement).toBe(star(el, 'people', 3));
  });

  it('ArrowLeft decrements the value', () => {
    const el = mount();
    el.open({ scores: { people: 2 } });
    let detail;
    el.addEventListener('reflection-score-changed', e => { detail = e.detail; });
    star(el, 'people', 2).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
    expect(detail).toEqual({ key: 'people', value: 1 });
  });

  it('ArrowRight clamps at 5', () => {
    const el = mount();
    el.open({ scores: { people: 5 } });
    let detail;
    el.addEventListener('reflection-score-changed', e => { detail = e.detail; });
    star(el, 'people', 5).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    expect(detail).toEqual({ key: 'people', value: 5 });
  });

  it('ArrowLeft from unset (0) lands on 1, not 0 or negative', () => {
    const el = mount();
    el.open(null);
    let detail;
    el.addEventListener('reflection-score-changed', e => { detail = e.detail; });
    star(el, 'people', 1).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
    expect(detail).toEqual({ key: 'people', value: 1 });
  });

  it('Home jumps to 1, End jumps to 5', () => {
    const el = mount();
    el.open({ scores: { people: 3 } });
    const detail = [];
    el.addEventListener('reflection-score-changed', e => detail.push(e.detail));
    star(el, 'people', 3).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
    star(el, 'people', 5).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
    expect(detail).toEqual([{ key: 'people', value: 5 }, { key: 'people', value: 1 }]);
  });

  it('an unrelated key is ignored', () => {
    const el = mount();
    el.open({ scores: { people: 2 } });
    const onChange = vi.fn();
    el.addEventListener('reflection-score-changed', onChange);
    star(el, 'people', 2).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ── comment blur ──────────────────────────────────────────────────────────────

describe('reflection-dialog — comment blur', () => {
  it('dispatches reflection-comment-changed on blur when the value changed', () => {
    const el = mount();
    el.open({ scores: {}, comment: 'old' });
    let detail;
    el.addEventListener('reflection-comment-changed', e => { detail = e.detail; });
    const textarea = el.shadowRoot.querySelector('#reflection-comment');
    textarea.value = 'new';
    textarea.dispatchEvent(new FocusEvent('blur'));
    expect(detail).toEqual({ comment: 'new' });
  });

  it('does not dispatch when the value is unchanged', () => {
    const el = mount();
    el.open({ scores: {}, comment: 'same' });
    const onChange = vi.fn();
    el.addEventListener('reflection-comment-changed', onChange);
    el.shadowRoot.querySelector('#reflection-comment').dispatchEvent(new FocusEvent('blur'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
