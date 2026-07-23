import { AppElement } from '../app-element.js';
import { setRuntimeState } from '../store/store.js';
import { recordControllerChange, isUpdateLoop, clearLoopMarker, repairInstallation } from './sw-repair.js';

class SwManager extends AppElement {
  template() {
    return '';
  }

  subscribe() {
    if (!('serviceWorker' in navigator)) return;

    const basePath = this.getAttribute('base-path') ?? '/';
    const appVersion = this.getAttribute('app-version');

    const notifyUpdate = () => {
      setRuntimeState('updateAvailable', true);
      // version.json reporting a new version within the loop window also triggers repair —
      // accepted false-positive when a rapid successive deploy coincides with a SW reload.
      if (isUpdateLoop()) {
        clearLoopMarker();
        repairInstallation({ basePath, checkServer: false, onBackup: this.onBackup });
      }
    };

    // Layer 1: register SW, detect waiting state
    navigator.serviceWorker.register(`${basePath}sw.js`)
      .then(registration => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyUpdate();
          return;
        }

        const trackInstalling = sw => {
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdate();
            }
          });
        };

        // updatefound may have fired during boot() — check installing directly
        // before also listening for future updatefound events
        trackInstalling(registration.installing);
        registration.addEventListener('updatefound', () => {
          trackInstalling(registration.installing);
        });
      })
      .catch(() => {}); // silent in dev (no sw.js at source path)

    // Reload when a new SW takes over after skipWaiting.
    // Guard against first install: clients.claim() also fires controllerchange
    // (controller changes from null → SW), but that's not an update.
    const prevController = navigator.serviceWorker.controller;
    this._onControllerChange = () => {
      if (prevController) {
        recordControllerChange(); // timestamp for loop detection on next session
        location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', this._onControllerChange);

    // Layer 2: version.json — show banner immediately if newer version exists.
    // cache: 'no-store' bypasses the browser cache; ?_= busts CDN caches (e.g. GitHub Pages/Fastly).
    if (appVersion) {
      fetch(`${basePath}version.json?_=${Date.now()}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.version && data.version !== appVersion) {
            notifyUpdate();
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
