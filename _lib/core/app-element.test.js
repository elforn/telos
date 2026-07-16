// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppElement } from './app-element.js';
import { baseSheet } from './styles/base.js';
import { setState, reset } from './store/store.js';

customElements.define('test-element', class extends AppElement {
  template() {
    return '<span>hello</span>';
  }
});

customElements.define('test-lifecycle', class extends AppElement {
  constructor() {
    super();
    this.subscribeCalls = 0;
    this.unsubscribeCalls = 0;
  }
  subscribe()   { this.subscribeCalls++; }
  unsubscribe() { this.unsubscribeCalls++; }
});

customElements.define('test-base', AppElement);

describe('AppElement', () => {
  let el;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('attaches a shadow root on connect', () => {
    el = document.createElement('test-base');
    expect(el.shadowRoot).toBeNull();
    document.body.appendChild(el);
    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot.mode).toBe('open');
  });

  it('does not recreate shadow root on reconnect', () => {
    el = document.createElement('test-base');
    document.body.appendChild(el);
    const root = el.shadowRoot;
    document.body.removeChild(el);
    document.body.appendChild(el);
    expect(el.shadowRoot).toBe(root);
  });

  it('adopts baseSheet on the shadow root', () => {
    el = document.createElement('test-base');
    document.body.appendChild(el);
    expect(el.shadowRoot.adoptedStyleSheets).toContain(baseSheet);
  });

  it('renders template() output into shadow DOM on first connect', () => {
    el = document.createElement('test-element');
    document.body.appendChild(el);
    expect(el.shadowRoot.querySelector('span').textContent).toBe('hello');
  });

  it('does not re-render on reconnect', () => {
    el = document.createElement('test-element');
    document.body.appendChild(el);
    const span = el.shadowRoot.querySelector('span');
    span.textContent = 'mutated';
    document.body.removeChild(el);
    document.body.appendChild(el);
    expect(el.shadowRoot.querySelector('span').textContent).toBe('mutated');
  });

  it('calls subscribe() on every connect', () => {
    el = document.createElement('test-lifecycle');
    document.body.appendChild(el);
    expect(el.subscribeCalls).toBe(1);
    document.body.removeChild(el);
    document.body.appendChild(el);
    expect(el.subscribeCalls).toBe(2);
  });

  it('calls unsubscribe() on disconnect', () => {
    el = document.createElement('test-lifecycle');
    document.body.appendChild(el);
    expect(el.unsubscribeCalls).toBe(0);
    document.body.removeChild(el);
    expect(el.unsubscribeCalls).toBe(1);
  });
});

describe('AppElement.listen', () => {
  let el;

  beforeEach(() => {
    document.body.innerHTML = '';
    el = document.createElement('test-base');
    document.body.appendChild(el);
  });

  it('registers a listener that fires on the target', () => {
    const handler = vi.fn();
    const button = document.createElement('button');
    document.body.appendChild(button);
    el.listen(button, 'click', handler);
    button.dispatchEvent(new Event('click'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removes all recorded listeners on disconnect', () => {
    const handler = vi.fn();
    const button = document.createElement('button');
    document.body.appendChild(button);
    el.listen(button, 'click', handler);
    document.body.removeChild(el);
    button.dispatchEvent(new Event('click'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('removes a capture-phase listener correctly', () => {
    const handler = vi.fn();
    const parent = document.createElement('div');
    const child = document.createElement('button');
    parent.appendChild(child);
    document.body.appendChild(parent);
    el.listen(parent, 'click', handler, { capture: true });
    child.dispatchEvent(new Event('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    document.body.removeChild(el);
    child.dispatchEvent(new Event('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('unlisten function removes the listener mid-life', () => {
    const handler = vi.fn();
    const button = document.createElement('button');
    document.body.appendChild(button);
    const unlisten = el.listen(button, 'click', handler);
    unlisten();
    button.dispatchEvent(new Event('click'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('unlisten is idempotent and safe after disconnect', () => {
    const handler = vi.fn();
    const button = document.createElement('button');
    document.body.appendChild(button);
    const unlisten = el.listen(button, 'click', handler);
    document.body.removeChild(el);
    expect(() => { unlisten(); unlisten(); }).not.toThrow();
  });

  it('reconnect starts clean — no stale listeners re-registered', () => {
    const handler = vi.fn();
    const button = document.createElement('button');
    document.body.appendChild(button);
    el.listen(button, 'click', handler);
    document.body.removeChild(el);
    document.body.appendChild(el);
    button.dispatchEvent(new Event('click'));
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(el);
    expect(() => document.body.appendChild(el)).not.toThrow();
  });

  it('listeners registered after reconnect work and are cleaned again', () => {
    const handler = vi.fn();
    const button = document.createElement('button');
    document.body.appendChild(button);
    document.body.removeChild(el);
    document.body.appendChild(el);
    el.listen(button, 'click', handler);
    button.dispatchEvent(new Event('click'));
    expect(handler).toHaveBeenCalledTimes(1);
    document.body.removeChild(el);
    button.dispatchEvent(new Event('click'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports window as a target', () => {
    const handler = vi.fn();
    el.listen(window, 'resize', handler);
    window.dispatchEvent(new Event('resize'));
    expect(handler).toHaveBeenCalledTimes(1);
    document.body.removeChild(el);
    window.dispatchEvent(new Event('resize'));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('AppElement.watch', () => {
  let el;

  beforeEach(() => {
    document.body.innerHTML = '';
    reset();
    el = document.createElement('test-base');
    document.body.appendChild(el);
  });

  afterEach(() => reset());

  it('subscribes and fires immediately with the current value', () => {
    setState('count', 5);
    const cb = vi.fn();
    el.watch('count', cb);
    expect(cb).toHaveBeenCalledWith(5);
  });

  it('fires on state changes while connected', () => {
    const cb = vi.fn();
    el.watch('count', cb);
    setState('count', 1);
    expect(cb).toHaveBeenLastCalledWith(1);
  });

  it('unsubscribes on disconnect', () => {
    const cb = vi.fn();
    el.watch('count', cb);
    cb.mockClear();
    document.body.removeChild(el);
    setState('count', 2);
    expect(cb).not.toHaveBeenCalled();
  });

  it('unwatch function unsubscribes mid-life', () => {
    const cb = vi.fn();
    const unwatch = el.watch('count', cb);
    cb.mockClear();
    unwatch();
    setState('count', 3);
    expect(cb).not.toHaveBeenCalled();
  });

  it('reconnect starts clean — no stale watches', () => {
    const cb = vi.fn();
    el.watch('count', cb);
    document.body.removeChild(el);
    document.body.appendChild(el);
    cb.mockClear();
    setState('count', 4);
    expect(cb).not.toHaveBeenCalled();
  });
});
