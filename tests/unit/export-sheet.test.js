// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import '../../app/strings.js';
import '../../app/components/export-sheet/export-sheet.js';

function mount() {
  const el = document.createElement('export-sheet');
  document.body.appendChild(el);
  const dialog = el.shadowRoot.querySelector('#sheet');
  dialog.show  = vi.fn();
  dialog.close = vi.fn();
  return el;
}

afterEach(() => { document.body.innerHTML = ''; });

// ── Structure ─────────────────────────────────────────────────────────────────

describe('export-sheet — structure', () => {
  it('renders metadata and notes toggle checkboxes', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#metadata-check')).not.toBeNull();
    expect(el.shadowRoot.querySelector('#notes-check')).not.toBeNull();
  });

  it('renders the extract button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#copy-btn')).not.toBeNull();
  });
});

// ── show() ────────────────────────────────────────────────────────────────────

describe('export-sheet — show()', () => {
  it('opens the dialog', () => {
    const el = mount();
    el.show();
    expect(el.shadowRoot.querySelector('#sheet').show).toHaveBeenCalledOnce();
  });

  it('resets metadata checkbox to unchecked', () => {
    const el = mount();
    el.shadowRoot.querySelector('#metadata-check').checked = true;
    el.show();
    expect(el.shadowRoot.querySelector('#metadata-check').checked).toBe(false);
  });

  it('resets notes checkbox to unchecked', () => {
    const el = mount();
    el.shadowRoot.querySelector('#notes-check').checked = true;
    el.show();
    expect(el.shadowRoot.querySelector('#notes-check').checked).toBe(false);
  });

  it('hides the reflection row by default (list/item exports have no reflection)', () => {
    const el = mount();
    el.show();
    expect(el.shadowRoot.querySelector('#reflection-row').hidden).toBe(true);
  });

  it('shows the reflection row when showReflection is passed (year export)', () => {
    const el = mount();
    el.show({ showReflection: true });
    expect(el.shadowRoot.querySelector('#reflection-row').hidden).toBe(false);
  });

  it('resets reflection checkbox to unchecked', () => {
    const el = mount();
    el.shadowRoot.querySelector('#reflection-check').checked = true;
    el.show({ showReflection: true });
    expect(el.shadowRoot.querySelector('#reflection-check').checked).toBe(false);
  });
});

// ── extract-confirm event ──────────────────────────────────────────────────────

describe('export-sheet — extract-confirm event', () => {
  it('dispatches extract-confirm with metadata=false, notes=false, reflection=false when no options are checked', () => {
    const el = mount();
    let detail;
    el.addEventListener('extract-confirm', e => { detail = e.detail; });
    el.show();
    el.shadowRoot.querySelector('#copy-btn').click();
    expect(detail).toEqual({ metadata: false, notes: false, reflection: false });
  });

  it('dispatches extract-confirm with metadata=true when metadata is checked', () => {
    const el = mount();
    let detail;
    el.addEventListener('extract-confirm', e => { detail = e.detail; });
    el.show();
    el.shadowRoot.querySelector('#metadata-check').checked = true;
    el.shadowRoot.querySelector('#copy-btn').click();
    expect(detail).toEqual({ metadata: true, notes: false, reflection: false });
  });

  it('dispatches extract-confirm with notes=true when notes is checked', () => {
    const el = mount();
    let detail;
    el.addEventListener('extract-confirm', e => { detail = e.detail; });
    el.show();
    el.shadowRoot.querySelector('#notes-check').checked = true;
    el.shadowRoot.querySelector('#copy-btn').click();
    expect(detail).toEqual({ metadata: false, notes: true, reflection: false });
  });

  it('dispatches extract-confirm with reflection=true when the reflection option is shown and checked', () => {
    const el = mount();
    let detail;
    el.addEventListener('extract-confirm', e => { detail = e.detail; });
    el.show({ showReflection: true });
    el.shadowRoot.querySelector('#reflection-check').checked = true;
    el.shadowRoot.querySelector('#copy-btn').click();
    expect(detail).toEqual({ metadata: false, notes: false, reflection: true });
  });

  it('closes the dialog after dispatching', () => {
    const el = mount();
    el.show();
    el.shadowRoot.querySelector('#copy-btn').click();
    expect(el.shadowRoot.querySelector('#sheet').close).toHaveBeenCalledOnce();
  });

  it('event is composed and bubbles out of shadow DOM', () => {
    const el = mount();
    let event;
    document.body.addEventListener('extract-confirm', e => { event = e; });
    el.show();
    el.shadowRoot.querySelector('#copy-btn').click();
    expect(event).toBeDefined();
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });
});
