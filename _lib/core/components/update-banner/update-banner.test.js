// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reset as resetStore, setState, boot } from '../../store/store.js';
import { defineStrings, reset as resetStrings } from '../../strings.js';

const reducer = s => s ?? {};

beforeEach(async () => {
  // Fire rAF synchronously so --update-banner-height is set in the same tick.
  vi.stubGlobal('requestAnimationFrame', fn => fn());
  resetStore();
  resetStrings();
  defineStrings({
    'update-banner.available': 'Update available',
    'update-banner.reload': 'Reload',
    'update-banner.dismiss': 'Dismiss',
  });
  await boot({ dbName: `ub-test-${Math.random()}`, reducer });
  await import('./update-banner.js');
});

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.style.removeProperty('--update-banner-height');
  vi.unstubAllGlobals();
});

function mount() {
  const el = document.createElement('update-banner');
  el.setAttribute('hidden', '');
  document.body.appendChild(el);
  return el;
}

describe('update-banner', () => {
  it('is hidden initially', () => {
    const el = mount();
    expect(el.hasAttribute('hidden')).toBe(true);
  });

  it('becomes visible when updateAvailable is set in the store', async () => {
    const el = mount();
    setState('updateAvailable', true);
    // subscribe callback is synchronous
    expect(el.hasAttribute('hidden')).toBe(false);
  });

  it('stays hidden when updateAvailable is falsy', async () => {
    const el = mount();
    setState('updateAvailable', false);
    expect(el.hasAttribute('hidden')).toBe(true);
  });

  it('renders strings from t()', () => {
    const el = mount();
    setState('updateAvailable', true);
    expect(el.shadowRoot.querySelector('span').textContent).toBe('Update available');
    expect(el.shadowRoot.querySelector('#reload').textContent).toBe('Reload');
    expect(el.shadowRoot.querySelector('#dismiss').getAttribute('aria-label')).toBe('Dismiss');
  });

  it('sets --update-banner-height on documentElement when shown', () => {
    const el = mount();
    setState('updateAvailable', true);
    expect(document.documentElement.style.getPropertyValue('--update-banner-height')).not.toBe('');
  });

  it('dismiss removes --update-banner-height from documentElement', () => {
    const el = mount();
    setState('updateAvailable', true);
    el.shadowRoot.querySelector('#dismiss').click();
    expect(document.documentElement.style.getPropertyValue('--update-banner-height')).toBe('');
  });

  it('dismiss button hides the banner without reloading', () => {
    const reloadSpy = vi.spyOn(location, 'reload').mockImplementation(() => {});
    const el = mount();
    setState('updateAvailable', true);

    el.shadowRoot.querySelector('#dismiss').click();

    expect(el.hasAttribute('hidden')).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('reload button posts SKIP_WAITING when a waiting SW exists', async () => {
    const postMessage = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue({ waiting: { postMessage } }) },
      configurable: true,
    });

    const el = mount();
    setState('updateAvailable', true);
    el.shadowRoot.querySelector('#reload').click();
    await Promise.resolve();

    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('reload button falls back to location.reload when no waiting SW', async () => {
    const reloadSpy = vi.spyOn(location, 'reload').mockImplementation(() => {});
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue({ waiting: null }) },
      configurable: true,
    });

    const el = mount();
    setState('updateAvailable', true);
    el.shadowRoot.querySelector('#reload').click();
    await Promise.resolve();

    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
