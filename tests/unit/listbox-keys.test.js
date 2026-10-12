// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { attachListboxKeys } from '../../app/utils/listbox-keys.js';

function build(count, selectedIndex = -1) {
  const box = document.createElement('div');
  box.setAttribute('role', 'listbox');
  for (let i = 0; i < count; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', String(i === selectedIndex));
    b.textContent = `row ${i}`;
    box.appendChild(b);
  }
  document.body.appendChild(box);
  return box;
}
const opts = box => [...box.querySelectorAll('[role="option"]')];
const stops = box => opts(box).map(o => o.tabIndex);
const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

describe('attachListboxKeys', () => {
  beforeEach(() => { document.body.replaceChildren(); });

  it('leaves exactly one tab stop, on the first option', () => {
    const box = build(4);
    attachListboxKeys(box).syncTabStops();
    expect(stops(box)).toEqual([0, -1, -1, -1]);
  });

  it('puts the tab stop on the first already-selected option', () => {
    // Reopening a picker should land where the selection is, not at the top.
    const box = build(4, 2);
    attachListboxKeys(box).syncTabStops();
    expect(stops(box)).toEqual([-1, -1, 0, -1]);
  });

  it('moves focus and the tab stop together on ArrowDown', () => {
    const box = build(3);
    attachListboxKeys(box).syncTabStops();
    key(opts(box)[0], 'ArrowDown');
    expect(stops(box)).toEqual([-1, 0, -1]);
    expect(document.activeElement).toBe(opts(box)[1]);
  });

  it('moves back on ArrowUp', () => {
    const box = build(3);
    attachListboxKeys(box).syncTabStops();
    key(opts(box)[0], 'ArrowDown');
    key(opts(box)[1], 'ArrowUp');
    expect(stops(box)).toEqual([0, -1, -1]);
    expect(document.activeElement).toBe(opts(box)[0]);
  });

  it('clamps at both ends instead of wrapping', () => {
    const box = build(3);
    attachListboxKeys(box).syncTabStops();
    key(opts(box)[0], 'ArrowUp');
    expect(document.activeElement).toBe(opts(box)[0]);
    key(opts(box)[0], 'End');
    key(opts(box)[2], 'ArrowDown');
    expect(document.activeElement).toBe(opts(box)[2]);
  });

  it('jumps to the ends on Home and End', () => {
    const box = build(5);
    attachListboxKeys(box).syncTabStops();
    key(opts(box)[0], 'End');
    expect(document.activeElement).toBe(opts(box)[4]);
    key(opts(box)[4], 'Home');
    expect(document.activeElement).toBe(opts(box)[0]);
  });

  it('prevents the default so the arrow does not scroll the list instead', () => {
    const box = build(3);
    attachListboxKeys(box).syncTabStops();
    const e = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    opts(box)[0].dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('ignores keys it does not own, so Enter and Space stay native', () => {
    // Selection is each option's own click handler; this module never selects.
    const box = build(3);
    attachListboxKeys(box).syncTabStops();
    for (const k of ['Enter', ' ', 'Tab', 'a']) {
      const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
      opts(box)[0].dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
    }
    expect(stops(box)).toEqual([0, -1, -1]);
  });

  it('ignores a keypress that did not land on an option', () => {
    const box = build(2);
    const head = document.createElement('p'); // e.g. the goal picker's year heading
    box.insertBefore(head, box.firstChild);
    attachListboxKeys(box).syncTabStops();
    expect(() => key(head, 'ArrowDown')).not.toThrow();
    expect(stops(box)).toEqual([0, -1]);
  });

  it('re-syncs after a re-render, which would otherwise restore every tab stop', () => {
    const box = build(3);
    const keys = attachListboxKeys(box);
    keys.syncTabStops();
    box.replaceChildren();
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('button');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', 'false');
      box.appendChild(b);
    }
    expect(stops(box)).toEqual([0, 0, 0]); // fresh nodes default to 0
    keys.syncTabStops();
    expect(stops(box)).toEqual([0, -1, -1]);
  });

  it('survives an empty list', () => {
    const box = build(0);
    const keys = attachListboxKeys(box);
    expect(() => keys.syncTabStops()).not.toThrow();
    expect(() => key(box, 'ArrowDown')).not.toThrow();
  });

  it('stops responding once detached', () => {
    const box = build(3);
    const keys = attachListboxKeys(box);
    keys.syncTabStops();
    keys.detach();
    key(opts(box)[0], 'ArrowDown');
    expect(stops(box)).toEqual([0, -1, -1]);
  });
});
