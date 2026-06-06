import './strings.js';
import { setLocale, getLocale } from '../_lib/core/strings.js';
import { boot } from '../_lib/core/store/store.js';

import '../_lib/core/router/app-router.js';
import '../_lib/core/sw-manager/sw-manager.js';
import '../_lib/core/components/update-banner/update-banner.js';
import '../_lib/modules/app-header/app-header.js';
import '../_lib/modules/modal-dialog/modal-dialog.js';
import './pages/home-page.js';
import './pages/not-found-page.js';
import './pages/images-page.js';

setLocale(getLocale());

await boot({ dbName: 'Telos' });

console.log('Telos', __APP_VERSION__);

const router = document.querySelector('app-router');
router.routes = [
  { path: '/', component: 'home-page' },
    { path: '/images', component: 'images-page' },
  { path: '*', component: 'not-found-page' },
];
