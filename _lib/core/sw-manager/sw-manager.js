import { AppElement } from '../app-element.js';
import { setState } from '../store/store.js';

class SwManager extends AppElement {
  template() {
    return '';
  }

  subscribe() {
    if (!('serviceWorker' in navigator)) return;

    const basePath = this.getAttribute('base-path') ?? '/';
    const appVersion = this.getAttribute('app-version');

    // Layer 1: register SW, detect waiting state
    navigator.serviceWorker.register(`${basePath}sw.js`)
      .then(registration => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          setState('updateAvailable', true);
          return;
        }
        registration.addEventListener('updatefound', () => {
          const sw = registration.installing;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              setState('updateAvailable', true);
            }
          });
        });
      })
      .catch(() => {}); // silent in dev (no sw.js at source path)

    // Reload when a new SW takes over after skipWaiting.
    // Guard against first install: clients.claim() also fires controllerchange
    // (controller changes from null → SW), but that's not an update.
    const prevController = navigator.serviceWorker.controller;
    this._onControllerChange = () => { if (prevController) location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', this._onControllerChange);

    // Layer 2: version.json — show banner immediately if newer version exists
    if (appVersion) {
      fetch(`${basePath}version.json`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.version && data.version !== appVersion) {
            setState('updateAvailable', true);
          }
        })
        .catch(() => {}); // silent in dev (no version.json at source path)
    }
  }

  unsubscribe() {
    if (this._onControllerChange) {
      navigator.serviceWorker.removeEventListener('controllerchange', this._onControllerChange);
    }
  }
}

customElements.define('sw-manager', SwManager);
