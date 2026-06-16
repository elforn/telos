// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import '../../app/components/add-row/add-row.js';

function mount(label = '+ Add item') {
  const el = document.createElement('add-row');
  el.textContent = label;
  document.body.appendChild(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('add-row — structure', () => {
  it('renders a button inside the shadow root', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('button')).not.toBeNull();
  });

  it('button type is button (not submit)', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('button').type).toBe('button');
  });

  it('renders a slot inside the button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('slot')).not.toBeNull();
  });
});

describe('add-row — click propagation', () => {
  it('click on inner button fires click event on the host', () => {
    const el = mount();
    const events = [];
    el.addEventListener('click', e => events.push(e));
    el.shadowRoot.querySelector('button').click();
    expect(events).toHaveLength(1);
  });

  it('click on inner button bubbles past the host to parent', () => {
    const el = mount();
    const events = [];
    document.body.addEventListener('click', e => events.push(e));
    el.shadowRoot.querySelector('button').click();
    expect(events).toHaveLength(1);
  });
});
