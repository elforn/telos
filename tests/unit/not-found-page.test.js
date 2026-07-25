// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

// Register English strings so t() resolves to real values regardless of which
// other test files share this worker — otherwise the heading assertion below is
// order-dependent (raw key when unregistered, resolved text when registered).
import '../../app/strings.js';

vi.mock('../../app/base-path.js', () => ({ BASE_PATH: '' }));

let navigated;
vi.mock('../../_lib/core/router/router.js', () => ({
  navigate: (path) => { navigated = path; },
}));

await import('../../app/pages/not-found-page.js');

describe('not-found-page', () => {
  let el;

  beforeEach(() => {
    navigated = undefined;
    el = document.createElement('not-found-page');
    document.body.appendChild(el);
  });

  it('renders a main landmark', () => {
    expect(el.shadowRoot.querySelector('main')).toBeTruthy();
  });

  it('renders a visible 404 heading', () => {
    expect(el.shadowRoot.querySelector('h1').textContent).toBe('Nothing here');
  });

  it('navigates to the current year on button click', () => {
    el.shadowRoot.querySelector('#home-btn').click();
    expect(navigated).toBe(`/${new Date().getFullYear()}`);
  });
});
