import { AppElement } from '../../../_lib/core/app-element.js';
import { navigate } from '../../../_lib/core/router/router.js';
import { BASE_PATH } from '../../base-path.js';
import { t, setLocale, getLocale } from '../../../_lib/core/strings.js';
import { getTheme, setTheme, onThemeChange } from '../../../_lib/core/theme/theme.js';
import { exportData, importData, downloadExport, readImportFile } from '../../../_lib/modules/sync/sync.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

function _themeName(theme) {
  return { light: t('year-header.theme-light'), dark: t('year-header.theme-dark'), system: t('year-header.theme-system') }[theme] ?? theme;
}
const LOCALE_LABELS = { en: 'English', fr: 'Français', ca: 'Català' };
function _localeName(locale) { return LOCALE_LABELS[locale] ?? locale; }

class BottomNav extends AppElement {
  template() {
    return `
      <style>
        :host {
          display: block;
          position: fixed;
          inset-block-end: 0;
          inset-inline: 0;
          z-index: 200;
          background: var(--color-surface);
          border-block-start: 0.5px solid var(--color-border);
          padding-block-start: var(--space-2);
          padding-block-end: calc(var(--space-3) + var(--safe-area-bottom, 0px));
          padding-inline: var(--space-4);
        }

        .nav-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .pills {
          display: flex;
          flex: 1;
          gap: var(--space-1);
          background: var(--color-surface-raised);
          border-radius: var(--radius-full);
          padding: var(--pill-inset);
        }

        .pill {
          flex: 1;
          min-block-size: var(--touch-target);
          border: none;
          border-radius: var(--radius-full);
          background: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
        }

        .pill.active {
          background: var(--color-surface);
          color: var(--color-text-primary);
          box-shadow: var(--shadow-card);
          font-weight: var(--font-weight-semibold);
        }

        .pill:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .gear-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          font-size: var(--font-size-subheading);
          color: var(--color-text-secondary);
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gear-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── Settings modal content ─────────────────────────────────────── */

        .modal-title {
          font-size: var(--font-size-subheading);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-primary);
          margin-block-end: var(--space-4);
        }

        .section {
          margin-block-end: var(--space-4);
        }

        .section-label {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-block-end: var(--space-2);
        }

        .pill-group {
          display: flex;
          gap: var(--space-1);
          background: var(--color-surface-raised);
          border-radius: var(--radius-full);
          padding: var(--pill-inset);
        }

        .option-pill {
          flex: 1;
          min-block-size: var(--touch-target);
          border: none;
          border-radius: var(--radius-full);
          background: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          white-space: nowrap;
          text-align: center;
        }

        .option-pill.active {
          background: var(--color-surface);
          color: var(--color-text-primary);
          box-shadow: var(--shadow-card);
        }

        .option-pill:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .actions-group {
          display: flex;
          flex-direction: column;
        }

        .action-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          inline-size: 100%;
          min-block-size: var(--touch-target);
          background: none;
          border: none;
          border-block-start: 0.5px solid var(--color-border);
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          color: var(--color-text-primary);
          padding-inline: 0;
        }

        .action-row:first-child {
          border-block-start: none;
        }

        .action-icon {
          color: var(--color-text-muted);
        }

        .version-row {
          display: flex;
          align-items: center;
          justify-content: center;
          padding-block: var(--space-1);
        }

        .version-text {
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
        }

        /* ── Import modal content ───────────────────────────────────────── */

        .import-message {
          font-size: var(--font-size-body);
          line-height: 1.5;
          color: var(--color-text-primary);
          margin-block-start: var(--space-2);
          margin-block-end: var(--space-2);
        }

        .modal-btn {
          min-block-size: var(--touch-target);
          padding-inline: var(--space-4);
          background: var(--color-surface-raised);
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
        }

        .modal-btn.accent {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        .modal-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>

      <div class="nav-row">
        <div class="pills">
          <button class="pill" id="pill-years">${t('bottom-nav.years')}</button>
          <button class="pill" id="pill-lists">${t('bottom-nav.lists')}</button>
        </div>
        <button class="gear-btn" id="gear-btn" aria-label="${t('bottom-nav.settings')}">⚙</button>
      </div>

      <modal-dialog id="settings-modal" aria-label="${t('bottom-nav.settings')}">
        <h2 class="modal-title">${t('bottom-nav.settings')}</h2>

        <div class="section">
          <p class="section-label">${t('year-header.theme')}</p>
          <div class="pill-group" id="theme-group" role="group" aria-label="${t('year-header.theme')}">
            ${['light', 'system', 'dark'].map(v =>
              `<button class="option-pill" data-theme="${v}">${_themeName(v)}</button>`
            ).join('')}
          </div>
        </div>

        <div class="section">
          <p class="section-label">${t('year-header.language')}</p>
          <div class="pill-group" id="lang-group" role="group" aria-label="${t('year-header.language')}">
            ${['en', 'fr', 'ca'].map(l =>
              `<button class="option-pill" data-locale="${l}">${_localeName(l)}</button>`
            ).join('')}
          </div>
        </div>

        <div class="section">
          <p class="section-label">${t('year-header.app-section')}</p>
          <div class="actions-group">
            <button class="action-row" id="export-all-btn">
              <span>${t('sync.export-all')}</span>
              <span class="action-icon">↓</span>
            </button>
            <button class="action-row" id="import-btn">
              <span>${t('sync.import')}</span>
              <span class="action-icon">↑</span>
            </button>
          </div>
        </div>

        <div class="section">
          <div class="version-row">
            <span class="version-text" id="version-text">${t('year-header.version')} ${__APP_VERSION__}</span>
          </div>
        </div>

      </modal-dialog>

      <modal-dialog id="import-modal" aria-label="${t('sync.import')}">
        <h2 class="modal-title">${t('sync.import')}</h2>
        <p id="import-message" class="import-message"></p>
        <button slot="footer" class="modal-btn" id="import-cancel" hidden>${t('sync.import-cancel')}</button>
        <button slot="footer" class="modal-btn accent" id="import-reload" hidden>${t('sync.import-reload')}</button>
        <button slot="footer" class="modal-btn" id="import-close" hidden>${t('sync.import-close')}</button>
      </modal-dialog>

      <input type="file" id="import-input" accept=".telos,.json" hidden>
    `;
  }

  subscribe() {
    this._settingsModal = this.shadowRoot.querySelector('#settings-modal');
    this._importModal   = this.shadowRoot.querySelector('#import-modal');
    this._importInput   = this.shadowRoot.querySelector('#import-input');
    this._pillYears     = this.shadowRoot.querySelector('#pill-years');
    this._pillLists     = this.shadowRoot.querySelector('#pill-lists');
    this._currentYear   = new Date().getFullYear();
    this._lastListsPath = window.location.pathname.startsWith(`${BASE_PATH}lists`)
      ? window.location.pathname
      : `${BASE_PATH}lists`;

    this._updateActive();
    this._subscribeNav();
    this._subscribeSettings();
    this._subscribeSync();
    this._subscribeHeight();
  }

  _subscribeNav() {
    this._onPillYears = () => {
      if (!window.location.pathname.startsWith(`${BASE_PATH}lists`)) return;
      navigate(`${BASE_PATH}${this._currentYear}`);
    };
    this._pillYears.addEventListener('click', this._onPillYears);

    this._onPillLists = () => {
      if (window.location.pathname === `${BASE_PATH}lists`) return;
      navigate(`${BASE_PATH}lists`);
    };
    this._pillLists.addEventListener('click', this._onPillLists);

    this._onNavEvent = e => {
      const path = e?.detail?.path ?? window.location.pathname;
      if (path.startsWith(`${BASE_PATH}lists`)) this._lastListsPath = path;
      const rest = path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) : path;
      const m = rest.match(/^(\d{4})$/);
      if (m) this._currentYear = parseInt(m[1], 10);
      this._updateActive();
    };
    window.addEventListener('navigate', this._onNavEvent);
    window.addEventListener('popstate', this._onNavEvent);
  }

  _subscribeSettings() {
    this._onGear = () => {
      this._updateSettingsPills();
      this._settingsModal.show();
    };
    this.shadowRoot.querySelector('#gear-btn').addEventListener('click', this._onGear);

    this._onThemeGroup = e => {
      const btn = e.target.closest('[data-theme]');
      if (!btn || btn.dataset.theme === getTheme()) return;
      setTheme(btn.dataset.theme);
      this._updateSettingsPills();
    };
    this.shadowRoot.querySelector('#theme-group').addEventListener('click', this._onThemeGroup);

    this._unsubTheme = onThemeChange(() => this._updateSettingsPills());

    this._onLangGroup = e => {
      const btn = e.target.closest('[data-locale]');
      if (btn && btn.dataset.locale !== getLocale()) {
        setLocale(btn.dataset.locale);
        location.reload();
      }
    };
    this.shadowRoot.querySelector('#lang-group').addEventListener('click', this._onLangGroup);
  }

  _subscribeSync() {
    this._onExportAll = async () => {
      this._settingsModal.close();
      const data = await exportData();
      const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
      downloadExport(data, `${ts}_telos-all.telos`);
    };
    this.shadowRoot.querySelector('#export-all-btn').addEventListener('click', this._onExportAll);

    this._onImportBtn = () => {
      this._settingsModal.close();
      this._importInput.click();
    };
    this.shadowRoot.querySelector('#import-btn').addEventListener('click', this._onImportBtn);

    this._onImportInput = async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      const msgEl     = this.shadowRoot.querySelector('#import-message');
      const cancelBtn = this.shadowRoot.querySelector('#import-cancel');
      const reloadBtn = this.shadowRoot.querySelector('#import-reload');
      const closeBtn  = this.shadowRoot.querySelector('#import-close');
      try {
        const raw    = await readImportFile(file);
        const result = await importData(raw);
        msgEl.textContent = t('sync.import-confirm', { events: result.eventsAdded, images: result.imagesAdded });
        cancelBtn.hidden = false;
        reloadBtn.hidden = false;
        closeBtn.hidden  = true;
      } catch (err) {
        console.error('Import failed:', err);
        msgEl.textContent = t('sync.import-error');
        cancelBtn.hidden = true;
        reloadBtn.hidden = true;
        closeBtn.hidden  = false;
      }
      this._importModal.show();
    };
    this._importInput.addEventListener('change', this._onImportInput);

    this._onImportCancel = () => this._importModal.close();
    this._onImportReload = () => location.reload();
    this._onImportClose  = () => this._importModal.close();
    this.shadowRoot.querySelector('#import-cancel').addEventListener('click', this._onImportCancel);
    this.shadowRoot.querySelector('#import-reload').addEventListener('click', this._onImportReload);
    this.shadowRoot.querySelector('#import-close').addEventListener('click', this._onImportClose);
  }

  _subscribeHeight() {
    fetch('version.json').then(r => r.json()).then(data => {
      const el = this.shadowRoot?.querySelector('#version-text');
      if (el && data?.buildHash) {
        el.textContent = `${t('year-header.version')} ${__APP_VERSION__} (${data.buildHash})`;
      }
    }).catch(() => {});

    this._ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--bottom-nav-height', `${this.offsetHeight}px`);
    });
    this._ro.observe(this);
    document.documentElement.style.setProperty('--bottom-nav-height', `${this.offsetHeight}px`);
  }

  unsubscribe() {
    this._pillYears?.removeEventListener('click', this._onPillYears);
    this._pillLists?.removeEventListener('click', this._onPillLists);
    window.removeEventListener('navigate', this._onNavEvent);
    window.removeEventListener('popstate', this._onNavEvent);
    this.shadowRoot?.querySelector('#gear-btn')?.removeEventListener('click', this._onGear);
    this.shadowRoot?.querySelector('#theme-group')?.removeEventListener('click', this._onThemeGroup);
    this._unsubTheme?.();
    this.shadowRoot?.querySelector('#lang-group')?.removeEventListener('click', this._onLangGroup);
    this.shadowRoot?.querySelector('#export-all-btn')?.removeEventListener('click', this._onExportAll);
    this.shadowRoot?.querySelector('#import-btn')?.removeEventListener('click', this._onImportBtn);
    this._importInput?.removeEventListener('change', this._onImportInput);
    this.shadowRoot?.querySelector('#import-cancel')?.removeEventListener('click', this._onImportCancel);
    this.shadowRoot?.querySelector('#import-reload')?.removeEventListener('click', this._onImportReload);
    this.shadowRoot?.querySelector('#import-close')?.removeEventListener('click', this._onImportClose);
    this._ro?.disconnect();
    document.documentElement.style.removeProperty('--bottom-nav-height');
  }

  _updateActive() {
    const onLists = window.location.pathname.startsWith(`${BASE_PATH}lists`);
    this._pillYears?.classList.toggle('active', !onLists);
    this._pillLists?.classList.toggle('active', onLists);
  }

  _updateSettingsPills() {
    const theme = getTheme();
    this.shadowRoot.querySelectorAll('[data-theme]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    const locale = getLocale();
    this.shadowRoot.querySelectorAll('[data-locale]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.locale === locale);
    });
  }
}

customElements.define('bottom-nav', BottomNav);
