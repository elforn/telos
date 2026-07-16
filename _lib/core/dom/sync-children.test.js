// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { syncChildren } from './sync-children.js';

customElements.define('sync-test-item', class extends HTMLElement {
  set item(value) {
    this._item = value;
    this._connectedAtAssign = this.isConnected;
  }
  get item() { return this._item; }
});

describe('syncChildren', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="c"></div>';
    container = document.getElementById('c');
  });

  const assign = (el, item) => { el.item = item; };
  const render = items => syncChildren(container, items, 'sync-test-item', assign);
  const ids = () => [...container.children].map(el => el.dataset.id);

  it('creates elements for all items on an empty container', () => {
    render([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(container.children[0].item).toEqual({ id: 'a' });
  });

  it('reuses existing elements matched by id', () => {
    render([{ id: 'a' }, { id: 'b' }]);
    const [elA, elB] = container.children;
    render([{ id: 'a', v: 2 }, { id: 'b', v: 3 }]);
    expect(container.children[0]).toBe(elA);
    expect(container.children[1]).toBe(elB);
    expect(elA.item).toEqual({ id: 'a', v: 2 });
    expect(elB.item).toEqual({ id: 'b', v: 3 });
  });

  it('removes elements whose items are gone', () => {
    render([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    render([{ id: 'b' }]);
    expect(ids()).toEqual(['b']);
  });

  it('reorders by moving elements, not recreating them', () => {
    render([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const [elA, elB, elC] = container.children;
    render([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
    expect(ids()).toEqual(['c', 'a', 'b']);
    expect(container.children[0]).toBe(elC);
    expect(container.children[1]).toBe(elA);
    expect(container.children[2]).toBe(elB);
  });

  it('handles create, reuse, remove, and reorder in a single pass', () => {
    render([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const elB = container.children[1];
    render([{ id: 'd' }, { id: 'b' }]);
    expect(ids()).toEqual(['d', 'b']);
    expect(container.children[1]).toBe(elB);
  });

  it('empties the container when items is empty', () => {
    render([{ id: 'a' }, { id: 'b' }]);
    render([]);
    expect(container.children.length).toBe(0);
  });

  it('calls assign for every kept and created element', () => {
    render([{ id: 'a' }, { id: 'b' }]);
    const calls = [];
    syncChildren(container, [{ id: 'b' }, { id: 'c' }], 'sync-test-item',
      (el, item) => calls.push(item.id));
    expect(calls).toEqual(['b', 'c']);
  });

  it('assigns properties before appending created elements', () => {
    render([{ id: 'a' }]);
    expect(container.children[0]._connectedAtAssign).toBe(false);
  });

  it('creates a fresh element for a duplicate id instead of reusing one element twice', () => {
    render([{ id: 'a' }]);
    const elA = container.children[0];
    render([{ id: 'a', v: 1 }, { id: 'a', v: 2 }]);
    expect(container.children.length).toBe(2);
    expect(container.children[0]).toBe(elA);
    expect(container.children[1]).not.toBe(elA);
    expect(container.children[0].item).toEqual({ id: 'a', v: 1 });
    expect(container.children[1].item).toEqual({ id: 'a', v: 2 });
  });

  it('matches by a custom element id via getElId', () => {
    const assignGoal = (el, goal) => { el.item = goal; };
    const opts = { getElId: el => el._item?.id };
    syncChildren(container, [{ id: 'x' }, { id: 'y' }], 'sync-test-item', assignGoal, opts);
    const [elX] = container.children;
    expect(elX.dataset.id).toBeUndefined();

    syncChildren(container, [{ id: 'y' }, { id: 'x' }], 'sync-test-item', assignGoal, opts);
    expect(container.children[1]).toBe(elX);
    expect(container.children.length).toBe(2);
  });

  it('supports a custom item id via getId', () => {
    const opts = { getId: i => i.uuid };
    syncChildren(container, [{ uuid: 'u1' }], 'sync-test-item', assign, opts);
    const el1 = container.children[0];
    expect(el1.dataset.id).toBe('u1');
    syncChildren(container, [{ uuid: 'u1', v: 2 }], 'sync-test-item', assign, opts);
    expect(container.children[0]).toBe(el1);
    expect(el1.item).toEqual({ uuid: 'u1', v: 2 });
  });

  it('ignores unmatched children of other tag names', () => {
    const stray = document.createElement('div');
    stray.dataset.id = 'a';
    container.appendChild(stray);
    render([{ id: 'a' }]);
    expect(container.querySelector('div')).toBe(stray);
    expect(container.querySelectorAll('sync-test-item').length).toBe(1);
  });

  it('skips existing elements without an id when matching', () => {
    const anon = document.createElement('sync-test-item');
    container.appendChild(anon);
    render([{ id: 'a' }]);
    expect(anon.isConnected).toBe(true);
    expect(container.querySelectorAll('sync-test-item').length).toBe(2);
  });
});
