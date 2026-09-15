import './strings.js';
import { initTheme } from '../_lib/core/theme/theme.js';
import { BASE_PATH } from './base-path.js';
import './locales/fr.js';
import './locales/ca.js';
import './init-locale.js';
import { boot } from '../_lib/core/store/store.js';
import { readShareInbox } from '../_lib/core/share-inbox.js';
import '../_lib/core/router/app-router.js';
import '../_lib/core/sw-manager/sw-manager.js';
import '../_lib/core/components/update-banner/update-banner.js';
import { backupBeforeRepair } from './utils/backup-before-repair.js';
import { combineSharedText } from './utils/combine-shared-text.js';
import { migrateGoals } from './utils/migrate-goals.js';
import './pages/year-redirect.js';
import './pages/home-page.js';
import './pages/not-found-page.js';
import './pages/lists-page.js';
import './pages/list-detail-page.js';
import './components/bottom-nav/bottom-nav.js';
import '../_lib/modules/notifications/digest-notifier.js';
import { NotificationPrefs } from '../_lib/modules/notifications/notification-prefs.js';
import { NotificationDedup } from '../_lib/modules/notifications/notification-dedup.js';
import { isPeriodicSyncSupported } from '../_lib/modules/notifications/periodic-sync.js';
import { consumeColdLaunchParam, onColdLaunchMessage } from '../_lib/modules/notifications/cold-launch.js';
import { buildDigest } from './utils/build-telos-digest.js';

initTheme();

await boot({ dbName: 'telos', initialState: { goals: {}, images: {}, accentColors: {}, reflections: {}, lists: [], goalsTagsVisible: {}, goalsDeadlinesVisible: {}, listsTagsVisible: {}, listsRollupVisible: true, listsDeadlinesVisible: {} }, migrate: migrateGoals });

// bottom-nav mounts (and subscribes) before boot loads state, and boot doesn't
// re-notify existing subscribers — refresh its urgency roll-up and Upcoming
// bell once state is in.
document.querySelector('bottom-nav')?.refreshUrgency?.();
document.querySelector('bottom-nav')?.refreshUpcoming?.();

// Cold-launch handling for a tapped due-date notification (see
// app/sw-extensions.js's notificationclick handler): a brand-new window
// opens with this query param when no existing tab could just be focused
// instead. Stripped from the URL immediately so a later reload/share of
// this same URL doesn't re-open the dialog unprompted. Same param/message
// names as before, so nothing about the SW side needs to change.
if (consumeColdLaunchParam('upcoming')) document.querySelector('bottom-nav')?.openUpcoming?.();

// Same signal, for the case notificationclick found an already-open tab to
// focus instead of opening a new one — see app/sw-extensions.js.
onColdLaunchMessage('telos-open-upcoming', () => document.querySelector('bottom-nav')?.openUpcoming?.());

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

// A share-target POST (see manifest.json's share_target + Socle's share-inbox
// primitive) lands here as a pending inbox entry, consumed at most once. Treat
// a shared file exactly like an opened/launched one — same event, same existing
// routing in bottom-nav.js, which already reads both the plain-text envelope
// shareHandoff() writes and the ZIP format exportData() writes.
//
// A share with no files (text/URL shared from another app, not a .telos
// handoff) lands as raw title/text/url fields instead — combine them into one
// string and route it to bottom-nav's list-independent import-text-dialog,
// same event pattern as the file case.
readShareInbox().then(share => {
  if (!share) return;
  if (share.files?.length) {
    window.dispatchEvent(new CustomEvent('telos-import-file', { detail: { file: share.files[0].blob } }));
    return;
  }
  const text = combineSharedText(share);
  if (text) window.dispatchEvent(new CustomEvent('telos-share-text', { detail: { text } }));
}).catch(err => console.error('Failed to read share inbox:', err));

const swm = document.createElement('sw-manager');
swm.setAttribute('base-path', BASE_PATH);
swm.setAttribute('app-version', __APP_VERSION__);
swm.onBackup = backupBeforeRepair;
document.body.prepend(swm);

// Gated to browsers that support the Periodic Background Sync API — a
// deliberate product choice (bottom-nav.js hides the whole Settings section
// the same way), not a technical requirement of digest-notifier itself,
// which would work fine on Firefox too.
if (isPeriodicSyncSupported()) {
  const notifier = document.createElement('digest-notifier');
  notifier.prefs = NotificationPrefs('telos:notificationsEnabled');
  notifier.dedup = NotificationDedup('telos-notifications');
  notifier.buildDigest = buildDigest;
  notifier.tag = 'telos-digest';
  document.body.prepend(notifier);
}

const router = document.querySelector('app-router');
router.routes = [
  { path: `${BASE_PATH}`,                  component: 'year-redirect' },
  { path: `${BASE_PATH}not-found`,         component: 'not-found-page' },
  { path: `${BASE_PATH}lists`,             component: 'lists-page' },
  { path: `${BASE_PATH}lists/:listId`,     component: 'list-detail-page' },
  { path: `${BASE_PATH}:year`,             component: 'home-page' },
  { path: '*',                             component: 'not-found-page' },
];
