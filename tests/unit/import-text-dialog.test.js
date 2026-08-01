// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/import-text-dialog/import-text-dialog.js';

HTMLElement.prototype.setPointerCapture    = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

const SNAPSHOT_KEY = 'telos:snapshot.import-text';
function snapshotKey(id) { return `${SNAPSHOT_KEY}:${id}`; }

function mount(draftKey = 'l1') {
  const el = document.createElement('import-text-dialog');
  document.body.appendChild(el);
  el.draftKey = draftKey;
  const modal = el.shadowRoot.querySelector('#modal');
  modal.show  = vi.fn();
  modal.close = vi.fn(() => {
    modal.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  });
  return el;
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

describe('import-text-dialog — structure', () => {
  it('has a textarea and a disabled cta button before typing', () => {
    const el = mount();
    el.open();
    expect(el.shadowRoot.querySelector('#textarea')).toBeTruthy();
    expect(el.shadowRoot.querySelector('#cta-btn').disabled).toBe(true);
  });

  it('enables the cta button once text is typed', () => {
    const el = mount();
    el.open();
    const textarea = el.shadowRoot.querySelector('#textarea');
    textarea.value = 'Buy milk';
    textarea.dispatchEvent(new Event('input'));
    expect(el.shadowRoot.querySelector('#cta-btn').disabled).toBe(false);
    expect(el.shadowRoot.querySelector('#count').textContent).toBe('1 items');
  });
});

describe('import-text-dialog — confirm', () => {
  it('dispatches import-text-confirm with the parsed items and clears the textarea', () => {
    const el = mount();
    el.open();
    const textarea = el.shadowRoot.querySelector('#textarea');
    textarea.value = 'Buy milk\nCall dentist';
    textarea.dispatchEvent(new Event('input'));

    const handler = vi.fn();
    el.addEventListener('import-text-confirm', handler);
    el.shadowRoot.querySelector('#cta-btn').click();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].detail.items.map(i => i.title)).toEqual(['Buy milk', 'Call dentist']);
    expect(textarea.value).toBe('');
  });

  it('does nothing when the textarea is empty', () => {
    const el = mount();
    el.open();
    const handler = vi.fn();
    el.addEventListener('import-text-confirm', handler);
    el.shadowRoot.querySelector('#cta-btn').click();
    expect(handler).not.toHaveBeenCalled();
  });

  it('clears the draft after a successful confirm instead of re-capturing the imported text', () => {
    const el = mount('l1');
    el.open();
    const textarea = el.shadowRoot.querySelector('#textarea');
    textarea.value = 'Buy flowers';
    textarea.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#cta-btn').click();

    expect(localStorage.getItem(snapshotKey('l1'))).toBeNull();
  });
});

describe('import-text-dialog — prefill (share landing)', () => {
  it('pre-fills the textarea with the given text', () => {
    const el = mount('share-target');
    el.open('Shared headline\n  https://example.com');
    expect(el.shadowRoot.querySelector('#textarea').value).toBe('Shared headline\n  https://example.com');
    expect(el.shadowRoot.querySelector('#cta-btn').disabled).toBe(false);
  });

  it('does not auto-restore a leftover draft over the prefill text', () => {
    localStorage.setItem(snapshotKey('share-target'), JSON.stringify({ text: 'stale draft' }));
    const el = mount('share-target');
    el.open('Fresh share text');
    expect(el.shadowRoot.querySelector('#textarea').value).toBe('Fresh share text');
  });

  it('hides the draft toggle when prefilled (no draft offered)', () => {
    localStorage.setItem(snapshotKey('share-target'), JSON.stringify({ text: 'stale draft' }));
    const el = mount('share-target');
    el.open('Fresh share text');
    expect(el.shadowRoot.querySelector('#draft-toggle-btn').hidden).toBe(true);
  });
});

describe('import-text-dialog — draft recovery', () => {
  it('keeps unsaved text as a draft when cancelled', () => {
    const el = mount('l1');
    el.open();
    el.shadowRoot.querySelector('#textarea').value = 'Buy flowers';
    el.shadowRoot.querySelector('#cancel-btn').click();

    const snap = JSON.parse(localStorage.getItem(snapshotKey('l1')));
    expect(snap.text).toBe('Buy flowers');
  });

  it('keeps unsaved text as a draft on backdrop/swipe dismissal (any modal-close)', () => {
    const el = mount('l1');
    el.open();
    el.shadowRoot.querySelector('#textarea').value = 'Call the vet';
    el.shadowRoot.querySelector('#modal').close();

    const snap = JSON.parse(localStorage.getItem(snapshotKey('l1')));
    expect(snap.text).toBe('Call the vet');
  });

  it('does not save an empty draft, and clears any existing one', () => {
    localStorage.setItem(snapshotKey('l1'), JSON.stringify({ text: 'stale' }));
    const el = mount('l1');
    el.open();
    el.shadowRoot.querySelector('#textarea').value = '   ';
    el.shadowRoot.querySelector('#cancel-btn').click();

    expect(localStorage.getItem(snapshotKey('l1'))).toBeNull();
  });

  it('restores the draft and re-parses it when reopening with the same draftKey', () => {
    localStorage.setItem(snapshotKey('l1'), JSON.stringify({ text: 'Milk\nBread' }));
    const el = mount('l1');
    el.open();

    expect(el.shadowRoot.querySelector('#textarea').value).toBe('Milk\nBread');
    expect(el.shadowRoot.querySelector('#cta-btn').disabled).toBe(false);
  });

  it('does not restore a draft that belongs to a different draftKey', () => {
    localStorage.setItem(snapshotKey('l2'), JSON.stringify({ text: 'For the other list' }));
    const el = mount('l1');
    el.open();

    expect(el.shadowRoot.querySelector('#textarea').value).toBe('');
  });

  it('a draft for one key is not overwritten by a draft captured for a different key', () => {
    const el1 = mount('l1');
    el1.open();
    el1.shadowRoot.querySelector('#textarea').value = 'For list one';
    el1.shadowRoot.querySelector('#cancel-btn').click();

    const el2 = mount('l2');
    el2.open();
    el2.shadowRoot.querySelector('#textarea').value = 'For list two';
    el2.shadowRoot.querySelector('#cancel-btn').click();

    expect(JSON.parse(localStorage.getItem(snapshotKey('l1'))).text).toBe('For list one');
    expect(JSON.parse(localStorage.getItem(snapshotKey('l2'))).text).toBe('For list two');
  });

  it('does not store a _savedAt field any more (TTL removed)', () => {
    const el = mount('l1');
    el.open();
    el.shadowRoot.querySelector('#textarea').value = 'Buy flowers';
    el.shadowRoot.querySelector('#cancel-btn').click();
    const snap = JSON.parse(localStorage.getItem(snapshotKey('l1')));
    expect(snap._savedAt).toBeUndefined();
  });
});

describe('import-text-dialog — draft recovery toggle', () => {
  it('hides the toggle button when no draft was restored', () => {
    const el = mount('l1');
    el.open();
    expect(el.shadowRoot.querySelector('#draft-toggle-btn').hidden).toBe(true);
  });

  it('shows a Clear toggle when a draft is restored', () => {
    localStorage.setItem(snapshotKey('l1'), JSON.stringify({ text: 'Milk\nBread' }));
    const el = mount('l1');
    el.open();
    const btn = el.shadowRoot.querySelector('#draft-toggle-btn');
    expect(btn.hidden).toBe(false);
    expect(btn.textContent).toBe('Clear');
  });

  it('clicking Clear blanks the textarea and flips the button to Undo', () => {
    localStorage.setItem(snapshotKey('l1'), JSON.stringify({ text: 'Milk\nBread' }));
    const el = mount('l1');
    el.open();
    el.shadowRoot.querySelector('#draft-toggle-btn').click();
    expect(el.shadowRoot.querySelector('#textarea').value).toBe('');
    expect(el.shadowRoot.querySelector('#draft-toggle-btn').textContent).toBe('Undo');
  });

  it('clicking Undo after Clear restores the draft again', () => {
    localStorage.setItem(snapshotKey('l1'), JSON.stringify({ text: 'Milk\nBread' }));
    const el = mount('l1');
    el.open();
    const btn = el.shadowRoot.querySelector('#draft-toggle-btn');
    btn.click(); // Clear
    btn.click(); // Undo
    expect(el.shadowRoot.querySelector('#textarea').value).toBe('Milk\nBread');
    expect(btn.textContent).toBe('Clear');
  });
});
