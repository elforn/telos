// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Reorder } from './reorder.js';

HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

// Each item is 20px tall, stacked from y=0. midpoint of item i is at 20*i + 10.
const ITEM_H = 20;
function rectFor(index) {
  const top = index * ITEM_H;
  return { top, bottom: top + ITEM_H, height: ITEM_H, left: 0, right: 100, width: 100 };
}

function makeList(container, count) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const el = document.createElement('test-item');
    el.dataset.i = String(i);
    let idx = i;
    el.getBoundingClientRect = () => rectFor([...container.querySelectorAll('test-item')].indexOf(el));
    container.appendChild(el);
  }
  return [...container.querySelectorAll('test-item')];
}

function startDrag(container, dragEl, eventName = 'drag-start') {
  const rect = dragEl.getBoundingClientRect();
  dragEl.dispatchEvent(new CustomEvent(eventName, {
    bubbles: true,
    detail: { element: dragEl, startX: rect.left, startY: rect.top, label: 'x' },
  }));
}

// happy-dom Event has no clientX/clientY; build a pointer-ish event.
function pointerMove(dragEl, clientY, clientX = 50) {
  const e = new Event('pointermove');
  e.clientX = clientX;
  e.clientY = clientY;
  dragEl.dispatchEvent(e);
}

function pointerUp(dragEl) {
  dragEl.dispatchEvent(new Event('pointerup'));
}

describe('Reorder — single list', () => {
  let container, onMove, detach;

  beforeEach(() => {
    document.body.innerHTML = '<div id="list"></div>';
    container = document.getElementById('list');
    onMove = vi.fn();
    detach = Reorder.attach(container, {
      itemSelector: 'test-item',
      dragStartEvent: 'drag-start',
      reorderKeyEvent: 'reorder-key',
      cloneLabel: d => d.label,
      onMove,
    });
  });

  afterEach(() => detach());

  it('drops an item at the end when dragged past the last midpoint', () => {
    const items = makeList(container, 3);
    startDrag(container, items[0]);
    pointerMove(items[0], 55); // below item 2 midpoint (50)
    pointerUp(items[0]);
    expect(onMove).toHaveBeenCalledWith(0, 3);
  });

  it('computes the insertion index by the item midpoint rule', () => {
    const items = makeList(container, 3);
    startDrag(container, items[2]); // drag last item
    pointerMove(items[2], 5);       // above item 0 midpoint (10)
    pointerUp(items[2]);
    expect(onMove).toHaveBeenCalledWith(2, 0);
  });

  it('is a no-op when dropped in place (to === from)', () => {
    const items = makeList(container, 3);
    startDrag(container, items[1]);
    pointerMove(items[1], 25); // item 1 own upper half → index 1
    pointerUp(items[1]);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('is a no-op when dropped one slot below (to === from + 1)', () => {
    const items = makeList(container, 3);
    startDrag(container, items[0]);
    pointerMove(items[0], 25); // item 1 upper half → index 1, from 0 → from+1
    pointerUp(items[0]);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('sets the dragged element semi-transparent during drag and restores on end', () => {
    const items = makeList(container, 3);
    startDrag(container, items[0]);
    expect(items[0].style.opacity).toBe('0.4');
    pointerUp(items[0]);
    expect(items[0].style.opacity).toBe('');
  });

  it('appends a clone to the body during drag and removes it on end', () => {
    const items = makeList(container, 2);
    startDrag(container, items[0]);
    expect(document.body.querySelector('[aria-hidden="true"]')).not.toBeNull();
    pointerUp(items[0]);
    expect(document.body.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('inserts a visible insert line into the list during a move', () => {
    const items = makeList(container, 3);
    startDrag(container, items[0]);
    pointerMove(items[0], 55);
    const line = container.querySelector('div');
    expect(line).not.toBeNull();
    pointerUp(items[0]);
    expect(container.querySelector('div')).toBeNull();
  });
});

describe('Reorder — keyboard', () => {
  let container, onMove, detach;

  beforeEach(() => {
    document.body.innerHTML = '<div id="list"></div>';
    container = document.getElementById('list');
    onMove = vi.fn();
    detach = Reorder.attach(container, {
      itemSelector: 'test-item',
      dragStartEvent: 'drag-start',
      reorderKeyEvent: 'reorder-key',
      cloneLabel: d => d.label,
      onMove,
    });
  });

  afterEach(() => detach());

  const key = (el, direction) =>
    el.dispatchEvent(new CustomEvent('reorder-key', { bubbles: true, detail: { direction } }));

  it('moves down: toIndex is fromIndex + 2', () => {
    const items = makeList(container, 3);
    key(items[0], 1);
    expect(onMove).toHaveBeenCalledWith(0, 2);
  });

  it('moves up: toIndex is fromIndex - 1', () => {
    const items = makeList(container, 3);
    key(items[2], -1);
    expect(onMove).toHaveBeenCalledWith(2, 1);
  });

  it('up at the top boundary is a no-op', () => {
    const items = makeList(container, 3);
    key(items[0], -1); // toIndex clamps to 0, equals fromIndex → no-op
    expect(onMove).not.toHaveBeenCalled();
  });

  it('down at the bottom still calls onMove (consumer splice is identity)', () => {
    const items = makeList(container, 3);
    key(items[2], 1);
    expect(onMove).toHaveBeenCalledWith(2, 4);
  });
});

describe('Reorder — cross-section', () => {
  let root, secA, secB, listA, listB, onMoveSection, detach;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="root">
        <section id="secA"><div id="listA"></div></section>
        <section id="secB"><div id="listB"></div></section>
      </div>`;
    root  = document.getElementById('root');
    secA  = document.getElementById('secA');
    secB  = document.getElementById('secB');
    listA = document.getElementById('listA');
    listB = document.getElementById('listB');
    // Section A occupies y 0–100, section B y 100–200.
    secA.getBoundingClientRect = () => ({ top: 0,   bottom: 100, height: 100, left: 0, right: 100, width: 100 });
    secB.getBoundingClientRect = () => ({ top: 100, bottom: 200, height: 100, left: 0, right: 100, width: 100 });
    onMoveSection = vi.fn();
    detach = Reorder.attach(root, {
      itemSelector: 'test-item',
      dragStartEvent: 'drag-start',
      reorderKeyEvent: 'reorder-key',
      cloneLabel: d => d.label,
      sections: [
        { name: 'a', sectionEl: secA, listEl: listA },
        { name: 'b', sectionEl: secB, listEl: listB },
      ],
      onMoveSection,
    });
  });

  afterEach(() => detach());

  it('moves an item from section a into section b', () => {
    const aItems = makeList(listA, 2);
    makeList(listB, 2);
    // rects in listB are relative to listB's own indices (0,20); position pointer in section B
    listB.querySelectorAll('test-item').forEach((el, i) => {
      el.getBoundingClientRect = () => {
        const top = 100 + i * ITEM_H;
        return { top, bottom: top + ITEM_H, height: ITEM_H, left: 0, right: 100, width: 100 };
      };
    });
    startDrag(root, aItems[0]);
    pointerMove(aItems[0], 155); // section B, past both items
    pointerUp(aItems[0]);
    expect(onMoveSection).toHaveBeenCalledWith('a', 0, 'b', 2);
  });

  it('keeps a same-section drop within the source section', () => {
    const aItems = makeList(listA, 3);
    listA.querySelectorAll('test-item').forEach((el, i) => {
      el.getBoundingClientRect = () => rectFor(i);
    });
    startDrag(root, aItems[2]);
    pointerMove(aItems[2], 5); // above item 0 in section A
    pointerUp(aItems[2]);
    expect(onMoveSection).toHaveBeenCalledWith('a', 2, 'a', 0);
  });

  it('same-section in-place drop is a no-op', () => {
    const aItems = makeList(listA, 3);
    listA.querySelectorAll('test-item').forEach((el, i) => {
      el.getBoundingClientRect = () => rectFor(i);
    });
    startDrag(root, aItems[1]);
    pointerMove(aItems[1], 25);
    pointerUp(aItems[1]);
    expect(onMoveSection).not.toHaveBeenCalled();
  });

  it('keyboard reorder stays within the item’s section', () => {
    const bItems = makeList(listB, 2);
    bItems.forEach((el, i) => { el.getBoundingClientRect = () => rectFor(i); });
    bItems[0].dispatchEvent(new CustomEvent('reorder-key', { bubbles: true, detail: { direction: 1 } }));
    expect(onMoveSection).toHaveBeenCalledWith('b', 0, 'b', 2);
  });
});

describe('Reorder — edge auto-scroll', () => {
  let container, detach, scrollSpy;

  beforeEach(() => {
    document.body.innerHTML = '<div id="list"></div>';
    container = document.getElementById('list');
    scrollSpy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    detach = Reorder.attach(container, {
      itemSelector: 'test-item',
      dragStartEvent: 'drag-start',
      cloneLabel: d => d.label,
      onMove: vi.fn(),
    });
  });

  afterEach(() => { detach(); scrollSpy.mockRestore(); });

  it('scrolls up when the pointer is inside the top edge zone', async () => {
    const items = makeList(container, 3);
    startDrag(container, items[0]);
    pointerMove(items[0], 10); // within SCROLL_ZONE (100) of the top
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    expect(scrollSpy).toHaveBeenCalled();
    expect(scrollSpy.mock.calls.some(([, dy]) => dy < 0)).toBe(true);
    pointerUp(items[0]);
  });

  it('stops scrolling after the drag ends', async () => {
    const items = makeList(container, 3);
    startDrag(container, items[0]);
    pointerMove(items[0], 10);
    pointerUp(items[0]);
    scrollSpy.mockClear();
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    expect(scrollSpy).not.toHaveBeenCalled();
  });
});

describe('Reorder — detach cleanup', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="list"></div>';
    container = document.getElementById('list');
  });

  it('stops handling drag-start after detach', () => {
    const onMove = vi.fn();
    const detach = Reorder.attach(container, {
      itemSelector: 'test-item',
      dragStartEvent: 'drag-start',
      cloneLabel: d => d.label,
      onMove,
    });
    detach();
    const items = makeList(container, 2);
    startDrag(container, items[0]);
    expect(items[0].style.opacity).toBe('');
    expect(document.body.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('tears down an in-flight drag when detached mid-drag', () => {
    const detach = Reorder.attach(container, {
      itemSelector: 'test-item',
      dragStartEvent: 'drag-start',
      cloneLabel: d => d.label,
      onMove: vi.fn(),
    });
    const items = makeList(container, 3);
    startDrag(container, items[0]);
    pointerMove(items[0], 55);
    expect(document.body.querySelector('[aria-hidden="true"]')).not.toBeNull();
    detach();
    expect(items[0].style.opacity).toBe('');
    expect(document.body.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(container.querySelector('div')).toBeNull();
  });
});
