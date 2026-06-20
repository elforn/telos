// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/list-item/list-item.js';

HTMLElement.prototype.setPointerCapture    = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

const ITEM = { id: 'i1', title: 'Buy flowers', status: 'open', tags: [], inGoals: [] };

function mount(item = ITEM) {
  const el = document.createElement('list-item');
  document.body.appendChild(el);
  el.item = item;
  return el;
}

function tap(el) {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50, pointerId: 1, button: 0 }));
  el.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, clientX: 50, clientY: 50, pointerId: 1, button: 0 }));
}

afterEach(() => { document.body.innerHTML = ''; });

describe('list-item — structure', () => {
  it('renders the item title', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.title').textContent).toBe('Buy flowers');
  });

  it('renders the status badge text', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.badge').textContent).toBe('Open');
  });

  it('sets data-status attribute on badge', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.badge').dataset.status).toBe('open');
  });

  it('renders paused status correctly', () => {
    const el = mount({ ...ITEM, status: 'paused' });
    expect(el.shadowRoot.querySelector('.badge').textContent).toBe('Paused');
    expect(el.shadowRoot.querySelector('.badge').dataset.status).toBe('paused');
  });

  it('renders done status correctly', () => {
    const el = mount({ ...ITEM, status: 'done' });
    expect(el.shadowRoot.querySelector('.badge').textContent).toBe('Done');
    expect(el.shadowRoot.querySelector('.badge').dataset.status).toBe('done');
  });

  it('has a delete button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#delete-btn')).not.toBeNull();
  });

  it('delete button text is Delete', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#delete-btn').textContent).toBe('Delete');
  });

  it('has role=listitem on host', () => {
    const el = mount();
    expect(el.getAttribute('role')).toBe('listitem');
  });

  it('updates title when item property changes', () => {
    const el = mount();
    el.item = { ...ITEM, title: 'Updated title' };
    expect(el.shadowRoot.querySelector('.title').textContent).toBe('Updated title');
  });

  it('updates badge when status changes', () => {
    const el = mount();
    el.item = { ...ITEM, status: 'done' };
    expect(el.shadowRoot.querySelector('.badge').dataset.status).toBe('done');
    expect(el.shadowRoot.querySelector('.badge').textContent).toBe('Done');
  });

  it('note icon is hidden when item has no note', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.row').dataset.hasNote).toBe('false');
  });

  it('note icon is visible when item has a note', () => {
    const el = mount({ ...ITEM, note: 'A reminder' });
    expect(el.shadowRoot.querySelector('.row').dataset.hasNote).toBe('true');
  });

  it('note icon updates when note is added', () => {
    const el = mount();
    el.item = { ...ITEM, note: 'New note' };
    expect(el.shadowRoot.querySelector('.row').dataset.hasNote).toBe('true');
  });

  it('url icon is hidden when item has no url', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.row').dataset.hasUrl).toBe('false');
  });

  it('url icon is visible when item has a url', () => {
    const el = mount({ ...ITEM, url: 'https://example.com' });
    expect(el.shadowRoot.querySelector('.row').dataset.hasUrl).toBe('true');
  });
});

describe('list-item — item-tap event', () => {
  it('dispatches item-tap on tap', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-tap', e => events.push(e));
    tap(el);
    expect(events).toHaveLength(1);
  });

  it('item-tap detail contains the item', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-tap', e => events.push(e));
    tap(el);
    expect(events[0].detail.item.id).toBe('i1');
    expect(events[0].detail.item.title).toBe('Buy flowers');
  });

  it('item-tap bubbles and is composed', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-tap', e => events.push(e));
    tap(el);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});

describe('list-item — item-delete event', () => {
  it('first click on delete enters confirm state — does not dispatch event', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events).toHaveLength(0);
  });

  it('dispatches item-delete on second click of delete button', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events).toHaveLength(1);
  });

  it('item-delete detail contains the item', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events[0].detail.item.id).toBe('i1');
  });

  it('item-delete bubbles and is composed', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('does not dispatch item-tap on either delete click', () => {
    const el = mount();
    const tapEvents = [];
    el.addEventListener('item-tap', e => tapEvents.push(e));
    el.shadowRoot.querySelector('#delete-btn').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 })
    );
    el.shadowRoot.querySelector('#delete-btn').click();
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(tapEvents).toHaveLength(0);
  });
});

describe('list-item — item-done-toggle event', () => {
  it('dispatches item-done-toggle when done button is clicked', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-done-toggle', e => events.push(e));
    el.shadowRoot.querySelector('#done-btn').click();
    expect(events).toHaveLength(1);
  });

  it('item-done-toggle detail contains the item', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-done-toggle', e => events.push(e));
    el.shadowRoot.querySelector('#done-btn').click();
    expect(events[0].detail.item.id).toBe('i1');
  });

  it('item-done-toggle bubbles and is composed', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-done-toggle', e => events.push(e));
    el.shadowRoot.querySelector('#done-btn').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});

describe('list-item — done button icon', () => {
  it('done button shows ✓ for open items', () => {
    const el = mount({ ...ITEM, status: 'open' });
    expect(el.shadowRoot.querySelector('#done-btn').textContent).toBe('✓');
  });

  it('done button shows ↺ for done items', () => {
    const el = mount({ ...ITEM, status: 'done' });
    expect(el.shadowRoot.querySelector('#done-btn').textContent).toBe('↺');
  });

  it('done button has is-restore class for done items', () => {
    const el = mount({ ...ITEM, status: 'done' });
    expect(el.shadowRoot.querySelector('#done-btn').classList.contains('is-restore')).toBe(true);
  });

  it('done button does not have is-restore class for open items', () => {
    const el = mount({ ...ITEM, status: 'open' });
    expect(el.shadowRoot.querySelector('#done-btn').classList.contains('is-restore')).toBe(false);
  });

  it('done button icon updates when item status changes to done', () => {
    const el = mount({ ...ITEM, status: 'open' });
    expect(el.shadowRoot.querySelector('#done-btn').textContent).toBe('✓');
    el.item = { ...ITEM, status: 'done' };
    expect(el.shadowRoot.querySelector('#done-btn').textContent).toBe('↺');
  });

  it('done button icon updates when item status changes back to open', () => {
    const el = mount({ ...ITEM, status: 'done' });
    el.item = { ...ITEM, status: 'open' };
    expect(el.shadowRoot.querySelector('#done-btn').textContent).toBe('✓');
    expect(el.shadowRoot.querySelector('#done-btn').classList.contains('is-restore')).toBe(false);
  });
});

describe('list-item — done row styling', () => {
  it('row has data-status="done" when item is done', () => {
    const el = mount({ ...ITEM, status: 'done' });
    expect(el.shadowRoot.querySelector('.row').dataset.status).toBe('done');
  });

  it('row has data-status="open" for open items', () => {
    const el = mount({ ...ITEM, status: 'open' });
    expect(el.shadowRoot.querySelector('.row').dataset.status).toBe('open');
  });
});

describe('list-item — aria labels', () => {
  it('done button has aria-label "Mark done" for open items', () => {
    const el = mount({ ...ITEM, status: 'open' });
    expect(el.shadowRoot.querySelector('#done-btn').getAttribute('aria-label')).toBe('Mark done');
  });

  it('done button has aria-label "Restore" for done items', () => {
    const el = mount({ ...ITEM, status: 'done' });
    expect(el.shadowRoot.querySelector('#done-btn').getAttribute('aria-label')).toBe('Restore');
  });

  it('done button aria-label updates when status changes to done', () => {
    const el = mount({ ...ITEM, status: 'open' });
    el.item = { ...ITEM, status: 'done' };
    expect(el.shadowRoot.querySelector('#done-btn').getAttribute('aria-label')).toBe('Restore');
  });

  it('done button aria-label updates when status changes back to open', () => {
    const el = mount({ ...ITEM, status: 'done' });
    el.item = { ...ITEM, status: 'open' };
    expect(el.shadowRoot.querySelector('#done-btn').getAttribute('aria-label')).toBe('Mark done');
  });

  it('row has aria-label matching item title', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.row').getAttribute('aria-label')).toBe('Buy flowers');
  });

  it('row aria-label updates when title changes', () => {
    const el = mount();
    el.item = { ...ITEM, title: 'New title' };
    expect(el.shadowRoot.querySelector('.row').getAttribute('aria-label')).toBe('New title');
  });
});

describe('list-item — swipe', () => {
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

  it('left swipe at exactly 2× delete width (160px) commits reveal', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 160, velocity: 0 });
    expect(el._revealedDir).toBe('left');
  });

  it('left swipe at 159px does not commit', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 159, velocity: 0 });
    expect(el._revealedDir).toBeNull();
  });

  it('right swipe at exactly 2× done width (96px) commits reveal', () => {
    const el = mount();
    el.onSwipe({ direction: 'right', distance: 96, velocity: 0 });
    expect(el._revealedDir).toBe('right');
  });

  it('right swipe at 95px does not commit', () => {
    const el = mount();
    el.onSwipe({ direction: 'right', distance: 95, velocity: 0 });
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

describe('list-item — pointerup fires actions', () => {
  it('dispatches item-delete when delete button fires pointerup twice', async () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    const btn = el.shadowRoot.querySelector('#delete-btn');
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 }));
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 }));
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0].detail.item.id).toBe('i1');
  });

  it('dispatches item-done-toggle when done button fires pointerup', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-done-toggle', e => events.push(e));
    el.shadowRoot.querySelector('#done-btn').dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 })
    );
    expect(events).toHaveLength(1);
    expect(events[0].detail.item.id).toBe('i1');
  });

  it('keyboard click (detail=0) on delete button requires two presses to dispatch item-delete', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    const btn = el.shadowRoot.querySelector('#delete-btn');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 0 }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 0 }));
    expect(events).toHaveLength(1);
  });

  it('pointer click (detail=1) after pointerup does not double-fire on confirm', async () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    const btn = el.shadowRoot.querySelector('#delete-btn');
    // First touch: enter confirm state
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
    // Second touch: fire delete (rAF-delayed)
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });
});
