import './strings.js';
import { initTheme } from '../_lib/core/theme/theme.js';
import { BASE_PATH } from './base-path.js';
import './locales/fr.js';
import './locales/ca.js';
import './init-locale.js';
import { boot } from '../_lib/core/store/store.js';
import '../_lib/core/router/app-router.js';
import '../_lib/core/sw-manager/sw-manager.js';
import '../_lib/core/components/update-banner/update-banner.js';
import './pages/year-redirect.js';
import './pages/home-page.js';
import './pages/not-found-page.js';
import './pages/lists-page.js';
import './pages/list-detail-page.js';
import './components/bottom-nav/bottom-nav.js';

initTheme();

// Record when a SW controller change triggers a reload so bottom-nav can detect loops.
// Must be registered before sw-manager connects its own controllerchange listener.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    try { sessionStorage.setItem('telos:swReloadAt', String(Date.now())); } catch {}
  });
}

await boot({ dbName: 'telos', initialState: { goals: {}, images: {}, accentColors: {}, lists: [], goalsTagsVisible: {}, listsTagsVisible: {} } });

console.log('Telos', __APP_VERSION__);

if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async launchParams => {
    if (!launchParams.files.length) return;
    try {
      const file = await launchParams.files[0].getFile();
      window.dispatchEvent(new CustomEvent('telos-import-file', { detail: { file } }));
    } catch (err) {
      console.error('Failed to read launched file:', err);
    }
  });
}

const swm = document.createElement('sw-manager');
swm.setAttribute('base-path', BASE_PATH);
swm.setAttribute('app-version', __APP_VERSION__);
document.body.prepend(swm);

const router = document.querySelector('app-router');
router.routes = [
  { path: `${BASE_PATH}`,                  component: 'year-redirect' },
  { path: `${BASE_PATH}not-found`,         component: 'not-found-page' },
  { path: `${BASE_PATH}lists`,             component: 'lists-page' },
  { path: `${BASE_PATH}lists/:listId`,     component: 'list-detail-page' },
  { path: `${BASE_PATH}:year`,             component: 'home-page' },
  { path: '*',                             component: 'not-found-page' },
];
