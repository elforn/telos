import './strings.js';
import { initTheme } from '../_lib/core/theme/theme.js';
import { BASE_PATH } from './base-path.js';
import './locales/fr.js';
import './locales/ca.js';
import { setLocale, getLocale } from '../_lib/core/strings.js';
import { boot } from '../_lib/core/store/store.js';
import '../_lib/core/router/app-router.js';
import '../_lib/core/sw-manager/sw-manager.js';
import '../_lib/core/components/update-banner/update-banner.js';
import './pages/year-redirect.js';
import './pages/home-page.js';
import './pages/not-found-page.js';

initTheme();
setLocale(getLocale());

await boot({ dbName: 'telos', initialState: { goals: {}, images: {}, accentColors: {} } });

console.log('Telos', __APP_VERSION__);

const swm = document.createElement('sw-manager');
swm.setAttribute('base-path', BASE_PATH);
swm.setAttribute('app-version', __APP_VERSION__);
document.body.prepend(swm);

const router = document.querySelector('app-router');
router.routes = [
  { path: `${BASE_PATH}`,             component: 'year-redirect' },
  { path: `${BASE_PATH}not-found`,    component: 'not-found-page' },
  { path: `${BASE_PATH}:year`,        component: 'home-page' },
  { path: '*',                        component: 'not-found-page' },
];
