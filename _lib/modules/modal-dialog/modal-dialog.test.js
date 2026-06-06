// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../core/app-element.js';
import './modal-dialog.js';

function mount(attrs = {}) {
  const el = document.createElement('modal-dialog');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  const dialog = el.shadowRoot.querySelector('dialog');
  dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
  dialog.close    = vi.fn(() => dialog.removeAttribute('open'));
  return el;
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('modal-dialog — open / close', () => {
  it('show() opens the dialog', () => {
    const el = mount();
    el.show();
    expect(el.shadowRoot.querySelector('dialog').hasAttribute('open')).toBe(true);
  });

  it('close() removes the open attribute', () => {
    const el = mount();
    el.show();
    el.close();
    expect(el.shadowRoot.querySelector('dialog').hasAttribute('open')).toBe(false);
  });
});

describe('modal-dialog — modal-close event', () => {
  it('dispatches modal-close when the native close event fires', () => {
    const el = mount();
    const handler = vi.fn();
    el.addEventListener('modal-close', handler);
    el.shadowRoot.querySelector('dialog').dispatchEvent(new Event('close'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('modal-close event bubbles and is composed', () => {
    const el = mount();
    let captured = null;
    document.addEventListener('modal-close', e => { captured = e; }, { once: true });
    el.shadowRoot.querySelector('dialog').dispatchEvent(new Event('close'));
    expect(captured).not.toBeNull();
    expect(captured.bubbles).toBe(true);
    expect(captured.composed).toBe(true);
  });
});

describe('modal-dialog — backdrop dismiss', () => {
  it('clicking the dialog element (backdrop area) calls close()', () => {
    const el = mount();
    el.show();
    el._justOpened = false; // simulate rAF callback having fired
    const dialog = el.shadowRoot.querySelector('dialog');
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.close).toHaveBeenCalledOnce();
  });

  it('backdrop click is ignored immediately after show() (_justOpened guard)', () => {
    const el = mount();
    el.show(); // _justOpened is true until rAF fires
    const dialog = el.shadowRoot.querySelector('dialog');
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it('clicking dialog content (not backdrop) does not dismiss', () => {
    const el = mount();
    el.show();
    el._justOpened = false;
    const dialog = el.shadowRoot.querySelector('dialog');
    const handle = el.shadowRoot.querySelector('.handle');
    // click on child element — e.target is .handle, not the dialog
    handle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.close).not.toHaveBeenCalled();
  });
});

describe('modal-dialog — slots and structure', () => {
  it('has default and footer slots', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('slot:not([name])')).toBeTruthy();
    expect(el.shadowRoot.querySelector('slot[name="footer"]')).toBeTruthy();
  });

  it('has a handle element', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.handle')).toBeTruthy();
  });
});

describe('modal-dialog — accessibility attributes', () => {
  it('dialog has aria-modal="true"', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('dialog').getAttribute('aria-modal')).toBe('true');
  });

  it('handle has aria-hidden="true"', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.handle').getAttribute('aria-hidden')).toBe('true');
  });

  it('forwards aria-label to the inner dialog when the attribute is set', () => {
    const el = mount({ 'aria-label': 'Edit goal' });
    expect(el.shadowRoot.querySelector('dialog').getAttribute('aria-label')).toBe('Edit goal');
  });

  it('does not set aria-label on the inner dialog when the attribute is absent', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('dialog').hasAttribute('aria-label')).toBe(false);
  });
});
