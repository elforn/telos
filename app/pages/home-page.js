import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, subscribe, unsubscribe } from '../../_lib/core/store/store.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import '../components/year-header/year-header.js';
import '../components/goal-item/goal-item.js';
import '../components/goal-dialog/goal-dialog.js';
import '../components/add-row/add-row.js';

class HomePage extends AppElement {
  template() {
    return `
      <style>
        :host {
          display: block;
          --page-padding: var(--space-5);
        }

        main {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          padding: 0 var(--page-padding);
          padding-block-start: calc(var(--update-banner-height, 0px) + var(--year-header-height, 81px) + var(--space-2));
          padding-block-end: calc(var(--bottom-nav-height) + var(--space-2));
        }

        .section-heading {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-accent);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-block-end: var(--space-1);
        }

        .edit-btn {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          background: none;
          border: none;
          cursor: pointer;
          padding-block: var(--space-1);
          padding-inline: var(--space-2);
          border-radius: var(--radius-sm);
        }

        .edit-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .list-section {
          display: flex;
          flex-direction: column;
        }

        .item-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        #capstone-section {
          padding-block-start: var(--space-1);
        }

        #capstone-list goal-item {
          --goal-item-height: 60px;
        }

        add-row {
          display: none;
          font-style: italic;
        }

        .list-section.edit add-row { display: block; }

        .list-section.edit .section-heading { color: var(--color-text-secondary); }

        .list-section.edit .edit-btn { color: var(--color-accent); }
      </style>

      <year-header id="header"></year-header>

      <main>
        <section id="capstone-section" class="list-section empty" aria-label="${t('home-page.capstone-section')}">
          <div class="section-header">
            <h2 class="section-heading">${t('home-page.capstone-section')}</h2>
            <button class="edit-btn" id="capstone-edit-btn">${t('home-page.edit')}</button>
          </div>
          <div id="capstone-list" class="item-list" role="list"></div>
          <add-row id="add-capstone">+ ${t('goal-item.add-capstone')}</add-row>
        </section>

        <section id="milestone-section" class="list-section empty" aria-label="${t('home-page.milestone-section')}">
          <div class="section-header">
            <h2 class="section-heading">${t('home-page.milestone-section')}</h2>
            <button class="edit-btn" id="milestone-edit-btn">${t('home-page.edit')}</button>
          </div>
          <div id="milestone-list" class="item-list" role="list"></div>
          <add-row id="add-milestone">+ ${t('goal-item.add-milestone')}</add-row>
        </section>

        <section id="wow-section" class="list-section empty" aria-label="${t('home-page.wow-section')}">
          <div class="section-header">
            <h2 class="section-heading">${t('home-page.wow-section')}</h2>
            <button class="edit-btn" id="wow-edit-btn">${t('home-page.edit')}</button>
          </div>
          <div id="wow-list" class="item-list" role="list"></div>
          <add-row id="add-wow">+ ${t('goal-item.add-wow')}</add-row>
        </section>

        <section id="focus-section" class="list-section empty" aria-label="${t('home-page.focus-section')}">
          <div class="section-header">
            <h2 class="section-heading">${t('home-page.focus-section')}</h2>
            <button class="edit-btn" id="focus-edit-btn">${t('home-page.edit')}</button>
          </div>
          <div id="focus-list" class="item-list" role="list"></div>
          <add-row id="add-focus">+ ${t('goal-item.add-focus')}</add-row>
        </section>
      </main>

      <goal-dialog id="dialog"></goal-dialog>
    `;
  }

  subscribe() {
    this._year = Number(this.params?.year);
    if (!Number.isInteger(this._year) || this._year < 2000 || this._year > 2500) {
      navigate(`${BASE_PATH}not-found`);
      return;
    }
    this._header = this.shadowRoot.querySelector('#header');
    this._dialog = this.shadowRoot.querySelector('#dialog');
    this._editingSection = 'capstone';
    this._editingGoal    = null;

    const capstoneSection  = this.shadowRoot.querySelector('#capstone-section');
    const milestoneSection = this.shadowRoot.querySelector('#milestone-section');
    const wowSection       = this.shadowRoot.querySelector('#wow-section');
    const focusSection     = this.shadowRoot.querySelector('#focus-section');
    this._capstoneList  = this.shadowRoot.querySelector('#capstone-list');
    this._milestoneList = this.shadowRoot.querySelector('#milestone-list');
    this._wowList       = this.shadowRoot.querySelector('#wow-list');
    this._focusList     = this.shadowRoot.querySelector('#focus-list');

    // ── Header ───────────────────────────────────────────────────────────────

    this._header.year = this._year;

    this._onYearNavigate = e => navigate(`${BASE_PATH}${e.detail.year}`);
    this._header.addEventListener('year-navigate', this._onYearNavigate);

    // ── Per-section edit ─────────────────────────────────────────────────────

    const capstoneEditBtn  = this.shadowRoot.querySelector('#capstone-edit-btn');
    const milestoneEditBtn = this.shadowRoot.querySelector('#milestone-edit-btn');
    const wowEditBtn       = this.shadowRoot.querySelector('#wow-edit-btn');
    const focusEditBtn     = this.shadowRoot.querySelector('#focus-edit-btn');
    this._capstoneEdit  = false;
    this._milestoneEdit = false;
    this._wowEdit       = false;
    this._focusEdit     = false;

    this._onCapstoneEdit = () => {
      this._capstoneEdit = !this._capstoneEdit;
      capstoneSection.classList.toggle('edit', this._capstoneEdit);
      capstoneEditBtn.textContent = this._capstoneEdit ? t('home-page.done') : t('home-page.edit');
      const items = [...this._capstoneList.querySelectorAll('goal-item')];
      items.forEach(el => { el.editMode = this._capstoneEdit; });
      if (this._capstoneEdit)  items.forEach((el, i) => el.peekHint(i * 80));
      else                     items.forEach((el, i) => el.popConfirm(i * 50));
    };
    capstoneEditBtn.addEventListener('click', this._onCapstoneEdit);

    this._onMilestoneEdit = () => {
      this._milestoneEdit = !this._milestoneEdit;
      milestoneSection.classList.toggle('edit', this._milestoneEdit);
      milestoneEditBtn.textContent = this._milestoneEdit ? t('home-page.done') : t('home-page.edit');
      const items = [...this._milestoneList.querySelectorAll('goal-item')];
      items.forEach(el => { el.editMode = this._milestoneEdit; });
      if (this._milestoneEdit) items.forEach((el, i) => el.peekHint(i * 80));
      else                     items.forEach((el, i) => el.popConfirm(i * 50));
    };
    milestoneEditBtn.addEventListener('click', this._onMilestoneEdit);

    this._onWowEdit = () => {
      this._wowEdit = !this._wowEdit;
      wowSection.classList.toggle('edit', this._wowEdit);
      wowEditBtn.textContent = this._wowEdit ? t('home-page.done') : t('home-page.edit');
      const items = [...this._wowList.querySelectorAll('goal-item')];
      items.forEach(el => { el.editMode = this._wowEdit; });
      if (this._wowEdit) items.forEach((el, i) => el.peekHint(i * 80));
      else               items.forEach((el, i) => el.popConfirm(i * 50));
    };
    wowEditBtn.addEventListener('click', this._onWowEdit);

    this._onFocusEdit = () => {
      this._focusEdit = !this._focusEdit;
      focusSection.classList.toggle('edit', this._focusEdit);
      focusEditBtn.textContent = this._focusEdit ? t('home-page.done') : t('home-page.edit');
      const items = [...this._focusList.querySelectorAll('goal-item')];
      items.forEach(el => { el.editMode = this._focusEdit; });
      if (this._focusEdit) items.forEach((el, i) => el.peekHint(i * 80));
      else                 items.forEach((el, i) => el.popConfirm(i * 50));
    };
    focusEditBtn.addEventListener('click', this._onFocusEdit);

    // ── Store subscription ────────────────────────────────────────────────────

    this._onAccentColors = colors => this._applyAccent(colors?.[String(this._year)]);
    subscribe('accentColors', this._onAccentColors);

    this._onGoals = goals => {
      const year = String(this._year);
      const yg   = goals?.[year] ?? { capstone: [], milestones: [], wow: [], focus: [] };

      this._renderList(this._capstoneList,  yg.capstone  ?? [], this._capstoneEdit);
      capstoneSection.classList.toggle('empty',  (yg.capstone  ?? []).length === 0);

      this._renderList(this._milestoneList, yg.milestones ?? [], this._milestoneEdit);
      milestoneSection.classList.toggle('empty', (yg.milestones ?? []).length === 0);

      this._renderList(this._wowList,       yg.wow       ?? [], this._wowEdit);
      wowSection.classList.toggle('empty',       (yg.wow       ?? []).length === 0);

      this._renderList(this._focusList,     yg.focus     ?? [], this._focusEdit);
      focusSection.classList.toggle('empty',     (yg.focus     ?? []).length === 0);
    };
    subscribe('goals', this._onGoals);

    // ── Capstone events ───────────────────────────────────────────────────────

    this._onCapstoneGoalTap = e => {
      this._editingSection = 'capstone';
      this._editingGoal    = e.detail.goal;
      this._dialog.open(e.detail.goal);
    };
    this._capstoneList.addEventListener('goal-tap', this._onCapstoneGoalTap);

    this._onCapstoneProgress = e => {
      this._setProgress('capstone', e.detail.goal.id, e.detail.percentage);
    };
    this._capstoneList.addEventListener('goal-progress', this._onCapstoneProgress);

    this._onCapstoneDelete = e => {
      this._deleteGoal('capstone', e.detail.goal.id);
    };
    this._capstoneList.addEventListener('goal-delete', this._onCapstoneDelete);

    this._onAddCapstone = () => {
      this._editingSection = 'capstone';
      this._editingGoal    = null;
      this._dialog.open(null);
    };
    this.shadowRoot.querySelector('#add-capstone').addEventListener('click', this._onAddCapstone);

    // ── Milestone events ──────────────────────────────────────────────────────

    this._onMilestoneGoalTap = e => {
      this._editingSection = 'milestones';
      this._editingGoal    = e.detail.goal;
      this._dialog.open(e.detail.goal);
    };
    this._milestoneList.addEventListener('goal-tap', this._onMilestoneGoalTap);

    this._onMilestoneProgress = e => {
      this._setProgress('milestones', e.detail.goal.id, e.detail.percentage);
    };
    this._milestoneList.addEventListener('goal-progress', this._onMilestoneProgress);

    this._onMilestoneDelete = e => {
      this._deleteGoal('milestones', e.detail.goal.id);
    };
    this._milestoneList.addEventListener('goal-delete', this._onMilestoneDelete);

    this._onAddMilestone = () => {
      this._editingSection = 'milestones';
      this._editingGoal    = null;
      this._dialog.open(null);
    };
    this.shadowRoot.querySelector('#add-milestone').addEventListener('click', this._onAddMilestone);

    // ── Wow events ────────────────────────────────────────────────────────────

    this._onWowGoalTap = e => {
      this._editingSection = 'wow';
      this._editingGoal    = e.detail.goal;
      this._dialog.open(e.detail.goal);
    };
    this._wowList.addEventListener('goal-tap', this._onWowGoalTap);

    this._onWowProgress = e => {
      this._setProgress('wow', e.detail.goal.id, e.detail.percentage);
    };
    this._wowList.addEventListener('goal-progress', this._onWowProgress);

    this._onWowDelete = e => {
      this._deleteGoal('wow', e.detail.goal.id);
    };
    this._wowList.addEventListener('goal-delete', this._onWowDelete);

    this._onAddWow = () => {
      this._editingSection = 'wow';
      this._editingGoal    = null;
      this._dialog.open(null);
    };
    this.shadowRoot.querySelector('#add-wow').addEventListener('click', this._onAddWow);

    // ── Forward Focus events ──────────────────────────────────────────────────

    this._onFocusGoalTap = e => {
      this._editingSection = 'focus';
      this._editingGoal    = e.detail.goal;
      this._dialog.open(e.detail.goal);
    };
    this._focusList.addEventListener('goal-tap', this._onFocusGoalTap);

    this._onFocusProgress = e => {
      this._setProgress('focus', e.detail.goal.id, e.detail.percentage);
    };
    this._focusList.addEventListener('goal-progress', this._onFocusProgress);

    this._onFocusDelete = e => {
      this._deleteGoal('focus', e.detail.goal.id);
    };
    this._focusList.addEventListener('goal-delete', this._onFocusDelete);

    this._onAddFocus = () => {
      this._editingSection = 'focus';
      this._editingGoal    = null;
      this._dialog.open(null);
    };
    this.shadowRoot.querySelector('#add-focus').addEventListener('click', this._onAddFocus);

    // ── Dialog save ───────────────────────────────────────────────────────────

    this._onGoalSaved = e => {
      const title = e.detail.title;
      if (this._editingGoal) {
        this._editGoal(this._editingSection, this._editingGoal.id, title);
      } else {
        this._addGoal(this._editingSection, title);
      }
      toast(t('home.toast-goal-saved'), 'success');
    };
    this.shadowRoot.addEventListener('goal-saved', this._onGoalSaved);

    this._onDialogDelete = () => {
      if (this._editingGoal) {
        this._deleteGoal(this._editingSection, this._editingGoal.id);
        toast(t('home.toast-goal-deleted'), 'info');
      }
    };
    this._dialog.addEventListener('goal-delete', this._onDialogDelete);
  }

  unsubscribe() {
    unsubscribe('goals', this._onGoals);
    unsubscribe('accentColors', this._onAccentColors);

    this._header?.removeEventListener('year-navigate', this._onYearNavigate);

    this.shadowRoot.querySelector('#capstone-edit-btn')?.removeEventListener('click', this._onCapstoneEdit);
    this.shadowRoot.querySelector('#milestone-edit-btn')?.removeEventListener('click', this._onMilestoneEdit);
    this.shadowRoot.querySelector('#wow-edit-btn')?.removeEventListener('click', this._onWowEdit);

    this._capstoneList?.removeEventListener('goal-tap',      this._onCapstoneGoalTap);
    this._capstoneList?.removeEventListener('goal-progress', this._onCapstoneProgress);
    this._capstoneList?.removeEventListener('goal-delete',   this._onCapstoneDelete);
    this.shadowRoot.querySelector('#add-capstone')?.removeEventListener('click', this._onAddCapstone);

    this._milestoneList?.removeEventListener('goal-tap',      this._onMilestoneGoalTap);
    this._milestoneList?.removeEventListener('goal-progress', this._onMilestoneProgress);
    this._milestoneList?.removeEventListener('goal-delete',   this._onMilestoneDelete);
    this.shadowRoot.querySelector('#add-milestone')?.removeEventListener('click', this._onAddMilestone);

    this._wowList?.removeEventListener('goal-tap',      this._onWowGoalTap);
    this._wowList?.removeEventListener('goal-progress', this._onWowProgress);
    this._wowList?.removeEventListener('goal-delete',   this._onWowDelete);
    this.shadowRoot.querySelector('#add-wow')?.removeEventListener('click', this._onAddWow);

    this._focusList?.removeEventListener('goal-tap',      this._onFocusGoalTap);
    this._focusList?.removeEventListener('goal-progress', this._onFocusProgress);
    this._focusList?.removeEventListener('goal-delete',   this._onFocusDelete);
    this.shadowRoot.querySelector('#add-focus')?.removeEventListener('click', this._onAddFocus);
    this.shadowRoot.querySelector('#focus-edit-btn')?.removeEventListener('click', this._onFocusEdit);

    this.shadowRoot.removeEventListener('goal-saved', this._onGoalSaved);
    this._dialog?.removeEventListener('goal-delete', this._onDialogDelete);
  }

  // ── Accent colour ─────────────────────────────────────────────────────────

  _applyAccent(hex) {
    const s = document.documentElement.style;
    if (!hex) {
      s.setProperty('--color-accent',        '#5BADE0');
      s.setProperty('--color-accent-light',  '#E2F3FB');
      s.setProperty('--color-accent-dark',   '#3A93CC');
      s.setProperty('--color-accent-subtle', 'rgba(91, 173, 224, 0.12)');
      return;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const w = (c, t) => Math.round(c * t + 255 * (1 - t));
    s.setProperty('--color-accent',        hex);
    s.setProperty('--color-accent-light',  `rgb(${w(r, .22)},${w(g, .22)},${w(b, .22)})`);
    s.setProperty('--color-accent-dark',   `rgb(${Math.round(r * .72)},${Math.round(g * .72)},${Math.round(b * .72)})`);
    s.setProperty('--color-accent-subtle', `rgba(${r},${g},${b},0.12)`);
  }

  // ── Store mutations ───────────────────────────────────────────────────────

  _yearGoals() {
    return getState().goals?.[String(this._year)] ?? { capstone: [], milestones: [], wow: [], focus: [] };
  }

  _mutateSection(section, fn) {
    const year = String(this._year);
    const yg   = this._yearGoals();
    setState('goals', { ...getState().goals, [year]: { ...yg, [section]: fn(yg[section] ?? []) } });
  }

  _addGoal(section, title) {
    const goal = { id: crypto.randomUUID(), title, percentage: 0 };
    this._mutateSection(section, list => [...list, goal]);
  }

  _editGoal(section, id, title) {
    this._mutateSection(section, list => list.map(g => g.id === id ? { ...g, title } : g));
  }

  _setProgress(section, id, percentage) {
    this._mutateSection(section, list => list.map(g => g.id === id ? { ...g, percentage } : g));
  }

  _deleteGoal(section, id) {
    this._mutateSection(section, list => list.filter(g => g.id !== id));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _renderList(container, items, editMode = false) {
    const byId = new Map();
    container.querySelectorAll('goal-item').forEach(el => {
      if (el._goal?.id) byId.set(el._goal.id, el);
    });

    const ordered = items.map(goal => {
      const el = byId.get(goal.id) ?? document.createElement('goal-item');
      byId.delete(goal.id);
      el.editMode = editMode;
      el.goal = goal;
      return el;
    });

    byId.forEach(el => el.remove());
    ordered.forEach(el => container.appendChild(el));
  }
}

customElements.define('home-page', HomePage);
