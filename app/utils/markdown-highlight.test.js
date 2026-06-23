// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { attachMarkdownHighlight } from './markdown-highlight.js';

function makeElements() {
  const textarea  = document.createElement('textarea');
  const highlight = document.createElement('div');
  return { textarea, highlight };
}

// ── Return value ───────────────────────────────────────────────────────────────

describe('attachMarkdownHighlight — return value', () => {
  it('returns an object with sync and detach functions', () => {
    const { textarea, highlight } = makeElements();
    const ctrl = attachMarkdownHighlight(textarea, highlight);
    expect(typeof ctrl.sync).toBe('function');
    expect(typeof ctrl.detach).toBe('function');
  });
});

// ── Initial sync ───────────────────────────────────────────────────────────────

describe('attachMarkdownHighlight — initial sync on attach', () => {
  it('sets innerHTML to a trailing space when textarea is empty', () => {
    const { textarea, highlight } = makeElements();
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe(' ');
  });

  it('renders plain text without any wrapper elements', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = 'hello world';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('hello world ');
  });
});

// ── Headers ────────────────────────────────────────────────────────────────────

describe('attachMarkdownHighlight — headers', () => {
  it('wraps a h1 line in an md-h span', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '# My heading';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('<span class="md-h"># My heading</span> ');
  });

  it('wraps a h3 line in an md-h span', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '### Deep heading';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('<span class="md-h">### Deep heading</span> ');
  });

  it('wraps h6 in an md-h span', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '###### Six';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('<span class="md-h">###### Six</span> ');
  });

  it('does not treat # without a trailing space as a heading', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '#nospace';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).not.toContain('md-h');
  });
});

// ── Bold ───────────────────────────────────────────────────────────────────────

describe('attachMarkdownHighlight — bold', () => {
  it('wraps **bold** in an md-b span (including the markers)', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '**bold**';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('<span class="md-b">**bold**</span> ');
  });

  it('does not format ** when content has a leading space', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '** bold**';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).not.toContain('md-b');
  });

  it('does not format ** when content has a trailing space', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '**bold **';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).not.toContain('md-b');
  });

  it('does not format unclosed ** markers', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '**unclosed';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).not.toContain('md-b');
  });
});

// ── Italic ─────────────────────────────────────────────────────────────────────

describe('attachMarkdownHighlight — italic', () => {
  it('wraps *italic* in an md-i span (including the markers)', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '*italic*';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('<span class="md-i">*italic*</span> ');
  });

  it('does not format * when content has a leading space', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '* italic*';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).not.toContain('md-i');
  });

  it('does not format * when content has a trailing space', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '*italic *';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).not.toContain('md-i');
  });

  it('does not format an unclosed * marker', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '*unclosed';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).not.toContain('md-i');
  });
});

// ── Mixed inline ───────────────────────────────────────────────────────────────

describe('attachMarkdownHighlight — mixed inline markup', () => {
  it('highlights both bold and italic spans in the same line', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = 'Hello **world** and *there*';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toContain('<span class="md-b">**world**</span>');
    expect(highlight.innerHTML).toContain('<span class="md-i">*there*</span>');
  });

  it('renders plain text before and after a bold span', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = 'before **bold** after';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('before <span class="md-b">**bold**</span> after ');
  });
});

// ── HTML escaping ──────────────────────────────────────────────────────────────

describe('attachMarkdownHighlight — HTML escaping', () => {
  it('escapes < and > in plain text', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = 'a < b > c';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('a &lt; b &gt; c ');
  });

  it('escapes & in plain text', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = 'foo & bar';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('foo &amp; bar ');
  });

  it('escapes < inside the content of a bold span', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '**a<b**';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('<span class="md-b">**a&lt;b**</span> ');
  });
});

// ── Multi-line ─────────────────────────────────────────────────────────────────

describe('attachMarkdownHighlight — multi-line text', () => {
  it('preserves a newline between two plain lines', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = 'line1\nline2';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('line1\nline2 ');
  });

  it('renders a header line followed by a plain line', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '# Title\nsome text';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('<span class="md-h"># Title</span>\nsome text ');
  });

  it('renders each line independently — bold on one line does not carry over', () => {
    const { textarea, highlight } = makeElements();
    textarea.value = '**bold**\nplain';
    attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe('<span class="md-b">**bold**</span>\nplain ');
  });
});

// ── sync() on demand ──────────────────────────────────────────────────────────

describe('attachMarkdownHighlight — sync() on demand', () => {
  it('updates innerHTML when called after a programmatic value assignment', () => {
    const { textarea, highlight } = makeElements();
    const { sync } = attachMarkdownHighlight(textarea, highlight);
    expect(highlight.innerHTML).toBe(' ');
    textarea.value = '# New heading';
    sync();
    expect(highlight.innerHTML).toBe('<span class="md-h"># New heading</span> ');
  });
});

// ── Reactive input event ──────────────────────────────────────────────────────

describe('attachMarkdownHighlight — reactive input event', () => {
  it('updates innerHTML when an input event fires on the textarea', () => {
    const { textarea, highlight } = makeElements();
    attachMarkdownHighlight(textarea, highlight);
    textarea.value = '*reactive*';
    textarea.dispatchEvent(new Event('input'));
    expect(highlight.innerHTML).toBe('<span class="md-i">*reactive*</span> ');
  });
});

// ── detach() ─────────────────────────────────────────────────────────────────

describe('attachMarkdownHighlight — detach()', () => {
  it('stops updates when an input event fires after detach', () => {
    const { textarea, highlight } = makeElements();
    const { detach } = attachMarkdownHighlight(textarea, highlight);
    detach();
    textarea.value = '# Should not appear';
    textarea.dispatchEvent(new Event('input'));
    expect(highlight.innerHTML).toBe(' ');
  });
});
