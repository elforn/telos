// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/lists-page-item/lists-page-item.js';

HTMLElement.prototype.setPointerCapture    = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

const LIST = { id: 'l1', name: 'Gift ideas', items: [], color: undefined };

function mount(list = LIST) {
  const el = document.createElement('lists-page-item');
  document.body.appendChild(el);
  el.list = list;
  return el;
}

function tap(el) {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50, pointerId: 1, button: 0 }));
  el.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, clientX: 50, clientY: 50, pointerId: 1, button: 0 }));
}

afterEach(() => { document.body.innerHTML = ''; });

describe('lists-page-item — structure', () => {
  it('renders the list name', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.list-name').textContent).toBe('Gift ideas');
  });

  it('renders the item count', () => {
    const el = mount({ ...LIST, items: [
      { id: 'i1', title: 'a', status: 'open', tags: [], inGoals: [] },
      { id: 'i2', title: 'b', status: 'open', tags: [], inGoals: [] },
    ] });
    expect(el.shadowRoot.querySelector('.item-count').textContent).toBe('2');
  });

  it('renders 0 item count for empty list', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.item-count').textContent).toBe('0');
  });

  it('has a delete button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#delete-btn')).not.toBeNull();
  });

  it('has an edit button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#edit-btn')).not.toBeNull();
  });

  it('has role=listitem on host', () => {
    const el = mount();
    expect(el.getAttribute('role')).toBe('listitem');
  });

  it('updates name when list property changes', () => {
    const el = mount();
    el.list = { ...LIST, name: 'Books' };
    expect(el.shadowRoot.querySelector('.list-name').textContent).toBe('Books');
  });

  it('updates item count when list changes', () => {
    const el = mount();
    el.list = { ...LIST, items: [{ id: 'i1', title: 'a', status: 'open', tags: [], inGoals: [] }] };
    expect(el.shadowRoot.querySelector('.item-count').textContent).toBe('1');
  });
});

describe('lists-page-item — list-tap event', () => {
  it('dispatches list-tap on tap', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-tap', e => events.push(e));
    tap(el);
    expect(events).toHaveLength(1);
  });

  it('list-tap detail contains the list', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-tap', e => events.push(e));
    tap(el);
    expect(events[0].detail.list.id).toBe('l1');
    expect(events[0].detail.list.name).toBe('Gift ideas');
  });

  it('list-tap bubbles and is composed', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-tap', e => events.push(e));
    tap(el);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});

describe('lists-page-item — list-edit event', () => {
  it('dispatches list-edit when edit button is clicked', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-edit', e => events.push(e));
    el.shadowRoot.querySelector('#edit-btn').click();
    expect(events).toHaveLength(1);
  });

  it('list-edit detail contains the list', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-edit', e => events.push(e));
    el.shadowRoot.querySelector('#edit-btn').click();
    expect(events[0].detail.list.id).toBe('l1');
  });

  it('list-edit bubbles and is composed', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-edit', e => events.push(e));
    el.shadowRoot.querySelector('#edit-btn').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('edit click does not dispatch list-tap', () => {
    const el = mount();
    const tapEvents = [];
    el.addEventListener('list-tap', e => tapEvents.push(e));
    el.shadowRoot.querySelector('#edit-btn').click();
    expect(tapEvents).toHaveLength(0);
  });
});

describe('lists-page-item — list-delete event', () => {
  it('first click on delete enters confirm state — does not dispatch event', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events).toHaveLength(0);
  });

  it('delete button shows confirm text after first click', () => {
    const el = mount();
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(el.shadowRoot.querySelector('#delete-btn').textContent).toBe('Sure?');
  });

  it('dispatches list-delete on second click of delete button', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events).toHaveLength(1);
  });

  it('list-delete detail contains the list', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events[0].detail.list.id).toBe('l1');
  });

  it('list-delete bubbles and is composed', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('delete button text resets after confirm fires', () => {
    const el = mount();
    const btn = el.shadowRoot.querySelector('#delete-btn');
    btn.click(); // enter confirm
    expect(btn.textContent).toBe('Sure?');
    btn.click(); // fire delete (synchronous path) — _closeReveal resets text
    expect(btn.textContent).toBe('Delete');
  });

  it('dispatches list-delete when delete button fires pointerup twice', async () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-delete', e => events.push(e));
    const btn = el.shadowRoot.querySelector('#delete-btn');
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 }));
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 }));
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it('does not dispatch list-tap on either delete click', () => {
    const el = mount();
    const tapEvents = [];
    el.addEventListener('list-tap', e => tapEvents.push(e));
    el.shadowRoot.querySelector('#delete-btn').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 })
    );
    el.shadowRoot.querySelector('#delete-btn').click();
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(tapEvents).toHaveLength(0);
  });
});

describe('lists-page-item — accessibility', () => {
  it('row has role=button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.row').getAttribute('role')).toBe('button');
  });

  it('row aria-label matches the list name', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.row').getAttribute('aria-label')).toBe('Gift ideas');
  });

  it('row aria-label updates when name changes', () => {
    const el = mount();
    el.list = { ...LIST, name: 'Books' };
    expect(el.shadowRoot.querySelector('.row').getAttribute('aria-label')).toBe('Books');
  });

  it('edit button aria-label includes the list name', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#edit-btn').getAttribute('aria-label')).toContain('Gift ideas');
  });

  it('edit button aria-label updates when name changes', () => {
    const el = mount();
    el.list = { ...LIST, name: 'Books' };
    expect(el.shadowRoot.querySelector('#edit-btn').getAttribute('aria-label')).toContain('Books');
  });

  it('host aria-label matches the list name', () => {
    const el = mount();
    expect(el.getAttribute('aria-label')).toBe('Gift ideas');
  });

  it('host aria-label updates when name changes', () => {
    const el = mount();
    el.list = { ...LIST, name: 'Books' };
    expect(el.getAttribute('aria-label')).toBe('Books');
  });
});

describe('lists-page-item — swipe', () => {
  it('row does not move for dx within dead zone (dx=-5)', () => {
    const el = mount();
    el.onSwipeMove({ dx: -5 });
    expect(el.shadowRoot.querySelector('.row').style.transform).toBe('translateX(0px)');
  });

  it('row moves left by dx plus dead zone when swiping left past dead zone (dx=-20)', () => {
    const el = mount();
    el.onSwipeMove({ dx: -20 });
    expect(el.shadowRoot.querySelector('.row').style.transform).toBe('translateX(-5px)');
  });

  it('right swipe does not move row (only left reveals delete)', () => {
    const el = mount();
    el.onSwipeMove({ dx: 20 });
    expect(el.shadowRoot.querySelector('.row').style.transform).toBe('translateX(0px)');
  });

  it('left swipe at exactly 2× reveal width (160px) commits', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 160, velocity: 0 });
    expect(el._revealedDir).toBe('left');
  });

  it('left swipe at 159px does not commit', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 159, velocity: 0 });
    expect(el._revealedDir).toBeNull();
  });

  it('fast flick commits despite short distance', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 10, velocity: 0.5 });
    expect(el._revealedDir).toBe('left');
  });

  it('_closeReveal applies spring snap-back transition', () => {
    const el = mount();
    el._closeReveal();
    expect(el.shadowRoot.querySelector('.row').style.transition)
      .toBe('transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)');
  });
});

describe('lists-page-item — color', () => {
  it('applies color to row via CSS custom property', () => {
    const el = mount({ ...LIST, color: '#ff0000' });
    const val = el.shadowRoot.querySelector('.row').style.getPropertyValue('--list-item-color');
    expect(val).toBe('#ff0000');
  });

  it('applies transparent when no color set', () => {
    const el = mount();
    const val = el.shadowRoot.querySelector('.row').style.getPropertyValue('--list-item-color');
    expect(val).toBe('transparent');
  });
});
