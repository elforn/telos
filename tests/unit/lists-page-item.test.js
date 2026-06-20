// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/lists-page-item/lists-page-item.js';
import { COLOR_PALETTE } from '../../app/components/lists-page-item/lists-page-item.js';

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

// ── COLOR_PALETTE export ──────────────────────────────────────────────────────

describe('COLOR_PALETTE', () => {
  it('starts with null (no colour)', () => {
    expect(COLOR_PALETTE[0]).toBeNull();
  });

  it('has 8 entries', () => {
    expect(COLOR_PALETTE).toHaveLength(8);
  });

  it('all non-null entries are hex colour strings', () => {
    COLOR_PALETTE.filter(Boolean).forEach(c => {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});

// ── Structure ─────────────────────────────────────────────────────────────────

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

  it('has a nav button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#nav-btn')).not.toBeNull();
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

// ── list-edit event (tap on row) ──────────────────────────────────────────────

describe('lists-page-item — list-edit event', () => {
  it('dispatches list-edit on tap', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-edit', e => events.push(e));
    tap(el);
    expect(events).toHaveLength(1);
  });

  it('list-edit detail contains the list', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-edit', e => events.push(e));
    tap(el);
    expect(events[0].detail.list.id).toBe('l1');
    expect(events[0].detail.list.name).toBe('Gift ideas');
  });

  it('list-edit bubbles and is composed', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-edit', e => events.push(e));
    tap(el);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('tap does not dispatch list-tap', () => {
    const el = mount();
    const tapEvents = [];
    el.addEventListener('list-tap', e => tapEvents.push(e));
    tap(el);
    expect(tapEvents).toHaveLength(0);
  });
});

// ── list-tap event (nav button) ───────────────────────────────────────────────

describe('lists-page-item — list-tap event', () => {
  it('dispatches list-tap when nav button is clicked', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-tap', e => events.push(e));
    el.shadowRoot.querySelector('#nav-btn').click();
    expect(events).toHaveLength(1);
  });

  it('list-tap detail contains the list', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-tap', e => events.push(e));
    el.shadowRoot.querySelector('#nav-btn').click();
    expect(events[0].detail.list.id).toBe('l1');
    expect(events[0].detail.list.name).toBe('Gift ideas');
  });

  it('list-tap bubbles and is composed', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-tap', e => events.push(e));
    el.shadowRoot.querySelector('#nav-btn').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('nav click does not dispatch list-edit', () => {
    const el = mount();
    const editEvents = [];
    el.addEventListener('list-edit', e => editEvents.push(e));
    el.shadowRoot.querySelector('#nav-btn').click();
    expect(editEvents).toHaveLength(0);
  });
});

// ── list-delete event ─────────────────────────────────────────────────────────

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
    btn.click();
    expect(btn.textContent).toBe('Sure?');
    btn.click();
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

// ── Accessibility ─────────────────────────────────────────────────────────────

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

  it('nav button aria-label includes the list name', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#nav-btn').getAttribute('aria-label')).toContain('Gift ideas');
  });

  it('nav button aria-label updates when name changes', () => {
    const el = mount();
    el.list = { ...LIST, name: 'Books' };
    expect(el.shadowRoot.querySelector('#nav-btn').getAttribute('aria-label')).toContain('Books');
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

// ── Swipe ─────────────────────────────────────────────────────────────────────

describe('lists-page-item — swipe', () => {
  it('row does not move for left dx within dead zone (dx=-5)', () => {
    const el = mount();
    el.onSwipeMove({ dx: -5 });
    expect(el.shadowRoot.querySelector('.row').style.transform).toBe('translateX(0px)');
  });

  it('row moves left past dead zone (dx=-20 → offset -5)', () => {
    const el = mount();
    el.onSwipeMove({ dx: -20 });
    expect(el.shadowRoot.querySelector('.row').style.transform).toBe('translateX(-5px)');
  });

  it('right swipe past dead zone moves row right (dx=20 → offset 5)', () => {
    const el = mount();
    el.onSwipeMove({ dx: 20 });
    expect(el.shadowRoot.querySelector('.row').style.transform).toBe('translateX(5px)');
  });

  it('right swipe within dead zone does not move row (dx=15)', () => {
    const el = mount();
    el.onSwipeMove({ dx: 15 });
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

  it('fast left flick commits despite short distance', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 10, velocity: 0.5 });
    expect(el._revealedDir).toBe('left');
  });

  it('right swipe at 2× color-panel width (112px) dispatches list-color-cycle', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'right', distance: 112, velocity: 0 });
    expect(events).toHaveLength(1);
    expect(events[0].detail.list.id).toBe('l1');
  });

  it('right swipe below commit threshold does not dispatch list-color-cycle', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'right', distance: 111, velocity: 0 });
    expect(events).toHaveLength(0);
  });

  it('fast right flick commits color cycle regardless of distance', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'right', distance: 10, velocity: 0.5 });
    expect(events).toHaveLength(1);
  });

  it('right swipe always snaps back (never stays open)', () => {
    const el = mount();
    el.onSwipe({ direction: 'right', distance: 112, velocity: 0 });
    expect(el._revealedDir).toBeNull();
  });

  it('_closeReveal applies spring snap-back transition', () => {
    const el = mount();
    el._closeReveal();
    expect(el.shadowRoot.querySelector('.row').style.transition)
      .toBe('transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)');
  });
});

// ── Drag handle ───────────────────────────────────────────────────────────────

describe('lists-page-item — drag', () => {
  it('dispatches list-drag-start on drag-btn pointerdown', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-drag-start', e => events.push(e));
    el.shadowRoot.querySelector('#drag-btn').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 10, clientY: 10 })
    );
    expect(events).toHaveLength(1);
    expect(events[0].detail.list.id).toBe('l1');
  });

  it('dispatches list-reorder-key with direction -1 on ArrowUp', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-reorder-key', e => events.push(e));
    el.shadowRoot.querySelector('#drag-btn').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
    );
    expect(events[0].detail.direction).toBe(-1);
    expect(events[0].detail.list.id).toBe('l1');
  });

  it('dispatches list-reorder-key with direction 1 on ArrowDown', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-reorder-key', e => events.push(e));
    el.shadowRoot.querySelector('#drag-btn').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    );
    expect(events[0].detail.direction).toBe(1);
  });

  it('other keys on drag-btn do not dispatch list-reorder-key', () => {
    const el = mount();
    const events = [];
    el.addEventListener('list-reorder-key', e => events.push(e));
    el.shadowRoot.querySelector('#drag-btn').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(events).toHaveLength(0);
  });
});

// ── Color ─────────────────────────────────────────────────────────────────────

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

  it('sets color-panel background when list has a color', () => {
    const el = mount({ ...LIST, color: '#3DAD6A' });
    const val = el.shadowRoot.querySelector('#color-panel').style.getPropertyValue('--color-panel-bg');
    expect(val).toBe('#3DAD6A');
  });

  it('removes color-panel background when list has no color', () => {
    const el = mount();
    const val = el.shadowRoot.querySelector('#color-panel').style.getPropertyValue('--color-panel-bg');
    expect(val).toBe('');
  });
});
