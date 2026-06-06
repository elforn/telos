// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { AppElement } from './app-element.js';
import { baseSheet } from './styles/base.js';

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
