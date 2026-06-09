// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/goal-dialog/goal-dialog.js';

HTMLElement.prototype.setPointerCapture    = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

function stubModal(el) {
  const modal = el.shadowRoot.querySelector('#modal');
  modal.show  = vi.fn();
  modal.close = vi.fn(() => {
    modal.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  });
  return modal;
}

function mount() {
  const el = document.createElement('goal-dialog');
  document.body.appendChild(el);
  stubModal(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('goal-dialog — open', () => {
  it('calls show() when open() is invoked', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open();
    expect(modal.show).toHaveBeenCalledOnce();
  });

  it('populates input with existing goal title', () => {
    const el = mount();
    el.open({ title: 'Grand Capstone' });
    expect(el.shadowRoot.querySelector('#input').value).toBe('Grand Capstone');
  });

  it('clears input when opened with no goal', () => {
    const el = mount();
    el.open({ title: 'Old title' });
    el.open(null);
    expect(el.shadowRoot.querySelector('#input').value).toBe('');
  });
});

describe('goal-dialog — save', () => {
  it('save button is disabled when input is empty', () => {
    const el = mount();
    el.open();
    expect(el.shadowRoot.querySelector('#save').disabled).toBe(true);
  });

  it('save button enables when input has text', () => {
    const el = mount();
    el.open();
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'My goal';
    input.dispatchEvent(new Event('input'));
    expect(el.shadowRoot.querySelector('#save').disabled).toBe(false);
  });

  it('dispatches goal-saved with the title on save click', () => {
    const el = mount();
    el.open();
    const events = [];
    el.addEventListener('goal-saved', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Grand Capstone';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.title).toBe('Grand Capstone');
  });

  it('does not dispatch goal-saved if input is only whitespace', () => {
    const el = mount();
    el.open();
    const events = [];
    el.addEventListener('goal-saved', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events).toHaveLength(0);
  });

  it('closes the dialog after saving', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open();
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Grand Capstone';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });

  it('dispatches goal-saved on Enter key in input', () => {
    const el = mount();
    el.open();
    const events = [];
    el.addEventListener('goal-saved', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Keyboard save';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(events[0].detail.title).toBe('Keyboard save');
  });

  it('trims whitespace from saved title', () => {
    const el = mount();
    el.open();
    const events = [];
    el.addEventListener('goal-saved', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = '  My goal  ';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.title).toBe('My goal');
  });
});

describe('goal-dialog — delete', () => {
  it('delete button is hidden when opened with no goal', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#delete').hidden).toBe(true);
  });

  it('delete button is visible when opened with an existing goal', () => {
    const el = mount();
    el.open({ id: '1', title: 'My goal' });
    expect(el.shadowRoot.querySelector('#delete').hidden).toBe(false);
  });

  it('dispatches goal-delete when delete is clicked', () => {
    const el = mount();
    el.open({ id: '1', title: 'My goal' });
    const events = [];
    el.addEventListener('goal-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete').click();
    expect(events).toHaveLength(1);
  });

  it('closes the dialog after delete', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open({ id: '1', title: 'My goal' });
    el.shadowRoot.querySelector('#delete').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });
});

describe('goal-dialog — cancel', () => {
  it('dispatches goal-cancelled when cancel is clicked', () => {
    const el = mount();
    el.open();
    const events = [];
    el.addEventListener('goal-cancelled', e => events.push(e));
    el.shadowRoot.querySelector('#cancel').click();
    expect(events).toHaveLength(1);
  });

  it('does not dispatch goal-cancelled after a successful save', () => {
    const el = mount();
    el.open();
    const cancelled = [];
    el.addEventListener('goal-cancelled', e => cancelled.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'My goal';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(cancelled).toHaveLength(0);
  });
});
