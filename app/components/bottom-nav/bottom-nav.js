import { AppElement } from '../../../_lib/core/app-element.js';
import { navigate } from '../../../_lib/core/router/router.js';
import { BASE_PATH } from '../../base-path.js';
import { t, setLocale, getLocale } from '../../../_lib/core/strings.js';
import { getTheme, setTheme, onThemeChange } from '../../../_lib/core/theme/theme.js';
import { exportData, downloadExport, readImportFile, previewImport, applyMerge, applyReplace } from '../../../_lib/modules/sync/sync.js';
import { getState } from '../../../_lib/core/store/store.js';
import { mergeStrategy } from '../../utils/merge-strategy.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

function _countGoals(goalsObj) {
  if (!goalsObj) return 0;
  return Object.values(goalsObj)
    .flatMap(yr => ['capstone', 'milestones', 'wow', 'focus'].flatMap(s => yr[s] ?? []))
    .length;
}

function _countItems(lists) {
  if (!lists) return 0;
  return lists.reduce((n, l) => n + (l.items?.length ?? 0), 0);
}

function _buildPreviewMsg(parsed) {
  if (parsed.type !== 'simple') {
    return t('sync.import-preview-log', { count: parsed.events.length });
  }
  const { payload } = parsed;
  const goalsObj   = payload.goals ?? {};
  const years      = Object.keys(goalsObj).sort();
  const totalGoals = _countGoals(goalsObj);
  const lists      = payload.lists ?? [];
  const totalItems = _countItems(lists);

  const parts = [];
  if (totalGoals > 0) {
    parts.push(`${totalGoals} goal${totalGoals !== 1 ? 's' : ''} (${years.join(', ')})`);
  }
  if (lists.length > 0) {
    parts.push(`${lists.length} list${lists.length !== 1 ? 's' : ''} with ${totalItems} item${totalItems !== 1 ? 's' : ''}`);
  }
  if (parts.length === 0) return t('sync.import-preview-empty');
  return t('sync.import-preview', { description: parts.join(' and ') });
}

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
          touch-action: manipulation;
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
          touch-action: manipulation;
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
          touch-action: manipulation;
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
          margin-block-start: 0;
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
          touch-action: manipulation;
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
          touch-action: manipulation;
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
          color: var(--color-text-on-accent);
        }

        .modal-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>

      <div class="nav-row" role="navigation">
        <div class="pills">
          <button class="pill" id="pill-years">${t('bottom-nav.years')}</button>
          <button class="pill" id="pill-lists">${t('bottom-nav.lists')}</button>
        </div>
        <button class="gear-btn" id="gear-btn" aria-label="${t('bottom-nav.settings')}">⚙</button>
      </div>

      <modal-dialog id="settings-modal" aria-label="${t('bottom-nav.settings')}">
        <h2 class="modal-title">${t('bottom-nav.settings')}</h2>

        <div class="section">
          <h3 class="section-label">${t('year-header.theme')}</h3>
          <div class="pill-group" id="theme-group" role="group" aria-label="${t('year-header.theme')}">
            ${['light', 'system', 'dark'].map(v =>
              `<button class="option-pill" data-theme="${v}">${_themeName(v)}</button>`
            ).join('')}
          </div>
        </div>

        <div class="section">
          <h3 class="section-label">${t('year-header.language')}</h3>
          <div class="pill-group" id="lang-group" role="group" aria-label="${t('year-header.language')}">
            ${['en', 'fr', 'ca'].map(l =>
              `<button class="option-pill" data-locale="${l}">${_localeName(l)}</button>`
            ).join('')}
          </div>
        </div>

        <div class="section">
          <h3 class="section-label">${t('year-header.app-section')}</h3>
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
        <p id="import-message" class="import-message" aria-live="polite"></p>
        <button slot="footer" class="modal-btn" id="import-cancel"  hidden>${t('sync.import-cancel')}</button>
        <button slot="footer" class="modal-btn" id="import-replace" hidden>${t('sync.import-replace')}</button>
        <button slot="footer" class="modal-btn accent" id="import-merge"   hidden>${t('sync.import-merge')}</button>
        <button slot="footer" class="modal-btn" id="import-close"   hidden>${t('sync.import-close')}</button>
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

    this._replaceConfirm  = false;
    this._scrollPositions = {};
    this._updateActive();
    this._subscribeNav();
    this._subscribeSettings();
    this._subscribeSync();
    this._subscribeHeight();
  }

  _subscribeNav() {
    this._onPillYears = () => {
      const onLists = window.location.pathname.startsWith(`${BASE_PATH}lists`);
      if (onLists) {
        // Lists → Year: save lists scroll, navigate to year, restore year scroll
        this._saveScroll(window.location.pathname);
        const target = `${BASE_PATH}${this._currentYear}`;
        navigate(target);
        this._restoreScroll(target);
      } else {
        // Year → Year: navigate to today's year if needed, then scroll to top
        const todayYear = new Date().getFullYear();
        if (window.location.pathname !== `${BASE_PATH}${todayYear}`) navigate(`${BASE_PATH}${todayYear}`);
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      }
    };
    this._onPillYearsKey = e => { if (e.detail === 0) this._onPillYears(); };
    this._pillYears.addEventListener('pointerup', this._onPillYears);
    this._pillYears.addEventListener('click', this._onPillYearsKey);

    this._onPillLists = () => {
      const onLists = window.location.pathname.startsWith(`${BASE_PATH}lists`);
      if (onLists) {
        // Lists → Lists: go to /lists root and scroll to top (no restore)
        if (window.location.pathname !== `${BASE_PATH}lists`) navigate(`${BASE_PATH}lists`);
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      } else {
        // Year → Lists: save year scroll, navigate to last lists path, restore lists scroll
        this._saveScroll(window.location.pathname);
        navigate(this._lastListsPath);
        this._restoreScroll(this._lastListsPath);
      }
    };
    this._onPillListsKey = e => { if (e.detail === 0) this._onPillLists(); };
    this._pillLists.addEventListener('pointerup', this._onPillLists);
    this._pillLists.addEventListener('click', this._onPillListsKey);

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
    this._onGearKey = e => { if (e.detail === 0) this._onGear(); };
    this.shadowRoot.querySelector('#gear-btn').addEventListener('pointerup', this._onGear);
    this.shadowRoot.querySelector('#gear-btn').addEventListener('click', this._onGearKey);

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

    const msgEl      = this.shadowRoot.querySelector('#import-message');
    const cancelBtn  = this.shadowRoot.querySelector('#import-cancel');
    const mergeBtn   = this.shadowRoot.querySelector('#import-merge');
    const replaceBtn = this.shadowRoot.querySelector('#import-replace');
    const closeBtn   = this.shadowRoot.querySelector('#import-close');

    const _resetReplace = () => {
      this._replaceConfirm = false;
      replaceBtn.textContent = t('sync.import-replace');
      replaceBtn.removeAttribute('aria-label');
    };
    const _showPreview = () => {
      cancelBtn.hidden  = false;
      mergeBtn.hidden   = false;
      replaceBtn.hidden = false;
      closeBtn.hidden   = true;
    };
    const _showDone = msg => {
      msgEl.textContent = msg;
      cancelBtn.hidden  = true;
      mergeBtn.hidden   = true;
      replaceBtn.hidden = true;
      closeBtn.hidden   = false;
    };

    this._onImportInput = async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      _resetReplace();
      let parsed;
      try {
        const raw = await readImportFile(file);
        parsed = await previewImport(raw);
      } catch (err) {
        console.error('Import failed:', err);
        _showDone(t('sync.import-error'));
        this._importModal.show();
        return;
      }
      this._parsed = parsed;
      msgEl.textContent = _buildPreviewMsg(parsed);
      _showPreview();
      this._importModal.show();
    };
    this._importInput.addEventListener('change', this._onImportInput);

    this._onImportCancel = () => {
      _resetReplace();
      this._importModal.close();
    };

    this._onImportMerge = async () => {
      if (!this._parsed) return;
      _resetReplace();
      try {
        const goalsBefore = _countGoals(getState().goals);
        const itemsBefore = _countItems(getState().lists);
        await applyMerge(this._parsed, mergeStrategy);
        const goalsAdded = _countGoals(getState().goals) - goalsBefore;
        const itemsAdded = _countItems(getState().lists) - itemsBefore;
        _showDone(t('sync.import-confirm', { goals: goalsAdded, items: itemsAdded }));
      } catch (err) {
        console.error('Import failed:', err);
        _showDone(t('sync.import-error'));
      }
    };

    this._onImportReplace = async () => {
      if (!this._parsed) return;
      if (!this._replaceConfirm) {
        this._replaceConfirm = true;
        replaceBtn.textContent = t('sync.import-sure');
        replaceBtn.setAttribute('aria-label', t('sync.import-sure-aria'));
        return;
      }
      _resetReplace();
      try {
        await applyReplace(this._parsed);
        _showDone(t('sync.import-replace-confirm'));
      } catch (err) {
        console.error('Import failed:', err);
        _showDone(t('sync.import-error'));
      }
    };

    this._onImportClose = () => this._importModal.close();

    this.shadowRoot.querySelector('#import-cancel').addEventListener('click', this._onImportCancel);
    this.shadowRoot.querySelector('#import-merge').addEventListener('click', this._onImportMerge);
    this.shadowRoot.querySelector('#import-replace').addEventListener('click', this._onImportReplace);
    this.shadowRoot.querySelector('#import-close').addEventListener('click', this._onImportClose);
    this._onImportModalClose = () => _resetReplace();
    this._importModal.addEventListener('modal-close', this._onImportModalClose);
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
    this._pillYears?.removeEventListener('pointerup', this._onPillYears);
    this._pillYears?.removeEventListener('click', this._onPillYearsKey);
    this._pillLists?.removeEventListener('pointerup', this._onPillLists);
    this._pillLists?.removeEventListener('click', this._onPillListsKey);
    window.removeEventListener('navigate', this._onNavEvent);
    window.removeEventListener('popstate', this._onNavEvent);
    this.shadowRoot?.querySelector('#gear-btn')?.removeEventListener('pointerup', this._onGear);
    this.shadowRoot?.querySelector('#gear-btn')?.removeEventListener('click', this._onGearKey);
    this.shadowRoot?.querySelector('#theme-group')?.removeEventListener('click', this._onThemeGroup);
    this._unsubTheme?.();
    this.shadowRoot?.querySelector('#lang-group')?.removeEventListener('click', this._onLangGroup);
    this.shadowRoot?.querySelector('#export-all-btn')?.removeEventListener('click', this._onExportAll);
    this.shadowRoot?.querySelector('#import-btn')?.removeEventListener('click', this._onImportBtn);
    this._importInput?.removeEventListener('change', this._onImportInput);
    this.shadowRoot?.querySelector('#import-cancel')?.removeEventListener('click', this._onImportCancel);
    this.shadowRoot?.querySelector('#import-merge')?.removeEventListener('click', this._onImportMerge);
    this.shadowRoot?.querySelector('#import-replace')?.removeEventListener('click', this._onImportReplace);
    this.shadowRoot?.querySelector('#import-close')?.removeEventListener('click', this._onImportClose);
    this._importModal?.removeEventListener('modal-close', this._onImportModalClose);
    this._ro?.disconnect();
    document.documentElement.style.removeProperty('--bottom-nav-height');
  }

  _saveScroll(path) {
    this._scrollPositions[path] = window.scrollY;
  }

  _restoreScroll(path) {
    requestAnimationFrame(() => window.scrollTo(0, this._scrollPositions[path] ?? 0));
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
