import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';
import * as Store from '../../../_lib/core/store/store.js';
import { compressImage } from '../../../_lib/modules/images/images.js';

const PALETTE = [
  { hex: '#5BADE0', label: 'Sky blue' },
  { hex: '#3B82F6', label: 'Blue' },
  { hex: '#6366F1', label: 'Indigo' },
  { hex: '#8B5CF6', label: 'Violet' },
  { hex: '#EC4899', label: 'Pink' },
  { hex: '#EF4444', label: 'Red' },
  { hex: '#F97316', label: 'Orange' },
  { hex: '#EAB308', label: 'Yellow' },
  { hex: '#22C55E', label: 'Green' },
  { hex: '#14B8A6', label: 'Teal' },
];

class YearHeader extends Gestures(AppElement) {
  set year(v) {
    this._year = Number(v);
    if (this.shadowRoot) this._updateYear();
  }

  template() {
    const year         = this._year ?? new Date().getFullYear();
    const pct          = yearProgress(year);
    return `
      <style>
        @media (prefers-reduced-motion: reduce) {
          .menu-sheet { animation: none; }
          .header-img { animation: none; }
          dialog[open], dialog::backdrop { animation: none; }
        }

        :host {
          display: block;
          position: fixed;
          inset-block-start: var(--update-banner-height, 0px);
          inset-inline: 0;
          z-index: 100;
          background: var(--color-surface);
          padding-block-start: calc(var(--space-2) + var(--safe-area-top));
          padding-block-end: 0;
          padding-inline: var(--page-padding);
          --image-overlay-edge: rgba(0,0,0,0.65);
          --image-strip-bg:     rgba(255,255,255,0.2);
          --image-strip-fill:   rgba(255,255,255,0.6);
        }

        :host(.compact) {
          padding-block-start: var(--safe-area-top);
        }

        /* ── Image mode ────────────────────────────────────────────────── */

        :host([data-has-image]:not(.compact)) {
          block-size: var(--image-header-height, 200px);
          padding-block-start: 0;
          padding-inline: 0;
        }

        .header-bg {
          display: none;
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        :host([data-has-image]:not(.compact)) .header-bg {
          display: block;
        }

        .header-image {
          inline-size: 100%;
          block-size: 100%;
          object-fit: cover;
          object-position: center;
        }

        .image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            var(--image-overlay-edge) 0%,
            transparent               45%,
            transparent               55%,
            var(--image-overlay-edge) 100%
          );
        }

        :host([data-has-image]:not(.compact)) .top-row {
          position: relative;
          z-index: 1;
          padding-block-start: calc(var(--space-2) + var(--safe-area-top));
          padding-inline: var(--page-padding);
        }

        :host([data-has-image]:not(.compact)) h1,
        :host([data-has-image]:not(.compact)) .nav-btn,
        :host([data-has-image]:not(.compact)) .menu-btn {
          color: white;
        }

        :host([data-has-image]:not(.compact)) .nav-btn:focus-visible,
        :host([data-has-image]:not(.compact)) .menu-btn:focus-visible {
          outline-color: white;
        }

        :host([data-has-image]:not(.compact)) .strip-bar {
          position: absolute;
          inset-block-end: 0;
          inset-inline: 0;
          background: var(--image-strip-bg);
        }

        :host([data-has-image]:not(.compact)) .strip-fill {
          background: var(--image-strip-fill);
        }

        /* ── Layout ────────────────────────────────────────────────────── */

        .top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-block-end: var(--space-1);
        }

        :host(.compact) .top-row {
          padding-block-end: 0;
        }

        .year-nav {
          display: flex;
          align-items: center;
          gap: 0;
        }

        .nav-btn {
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          font-size: var(--font-size-heading);
          color: var(--color-text-secondary);
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Pull the ‹ icon flush with the screen edge so it aligns
           with the left edge of goal items (page-padding inset). */
        #prev { margin-inline-start: calc(-1 * var(--page-padding)); }

        .nav-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        h1 {
          font-size: var(--font-size-title);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          line-height: 1;
          min-inline-size: 4ch;
          text-align: center;
        }

        .menu-btn {
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
          margin-inline-end: calc(-1 * var(--page-padding));
        }

        .menu-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .strip-bar {
          margin-inline: calc(-1 * var(--page-padding));
          block-size: var(--header-strip-height);
          background: var(--color-surface-raised);
          overflow: hidden;
        }

        .strip-fill {
          block-size: 100%;
          background: var(--color-accent);
        }

        /* ── Menu / sheets ─────────────────────────────────────────────── */

        dialog {
          position: fixed;
          inset-block-end: 0;
          inset-inline-start: 0;
          inset-block-start: auto;
          margin: 0;
          inline-size: 100%;
          max-inline-size: 100%;
          background: var(--color-surface);
          border: none;
          border-start-start-radius: var(--radius-lg);
          border-start-end-radius: var(--radius-lg);
          border-end-start-radius: 0;
          border-end-end-radius: 0;
          padding: 0;
          padding-block-end: calc(var(--space-3) + var(--safe-area-bottom, 0px));
          box-shadow: var(--shadow-sheet);
          color: var(--color-text-primary);
          font-family: var(--font-family);
        }

        dialog[open] {
          animation: menu-in 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }

        dialog::backdrop {
          background: var(--color-overlay);
          animation: fade-in 0.2s ease-out;
        }

        .menu-handle {
          inline-size: 36px;
          block-size: 4px;
          border-radius: var(--radius-full);
          background: var(--color-border);
          margin: var(--space-3) auto var(--space-1);
        }

        .menu-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          inline-size: 100%;
          min-block-size: var(--touch-target-lg);
          padding-inline: var(--space-5);
          background: none;
          border: none;
          border-block-start: 0.5px solid var(--color-border);
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          text-align: start;
        }

        .menu-item.destructive {
          color: var(--color-danger, #d32f2f);
        }

        .menu-section-label {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding-inline: var(--space-5);
          padding-block-start: var(--space-3);
          padding-block-end: var(--space-1);
        }

        .menu-item-value {
          font-size: var(--font-size-body);
          color: var(--color-text-muted);
        }

        .color-dot {
          display: inline-block;
          inline-size: 10px;
          block-size: 10px;
          border-radius: 50%;
          background: var(--color-accent);
          vertical-align: middle;
          margin-inline-end: var(--space-1);
        }

        .color-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: var(--space-3);
          padding: var(--space-4) var(--space-5);
          border-block-start: 0.5px solid var(--color-border);
        }

        .swatch {
          aspect-ratio: 1;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          min-inline-size: var(--touch-target);
          min-block-size: var(--touch-target);
          box-shadow: 0 0 0 0 transparent;
          transition: box-shadow 0.15s;
        }

        .swatch.active {
          box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-text-primary);
        }

        .swatch:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>

      <div class="header-bg" aria-hidden="true">
        <img class="header-image" id="header-img" alt="" aria-hidden="true">
        <div class="image-overlay"></div>
      </div>

      <div class="top-row">
        <nav class="year-nav" aria-label="${t('home-page.year-progress')}">
          <button id="prev" class="nav-btn" aria-label="${t('home-page.prev-year')}">‹</button>
          <h1 id="year">${year}</h1>
          <button id="next" class="nav-btn" aria-label="${t('home-page.next-year')}">›</button>
        </nav>
        <button id="menu-btn" class="menu-btn" aria-label="${t('year-header.menu')}" aria-expanded="false">☰</button>
      </div>

      <div class="strip-bar">
        <div class="strip-fill" id="strip-fill" style="width:${pct}%"></div>
      </div>

      <input type="file" id="photo-input" accept="image/*" hidden>

      <dialog id="menu">
        <div class="menu-handle"></div>
        <p class="menu-section-label">${t('year-header.year-section')}</p>
        <button class="menu-item" id="year-photo-btn">
          <span>${t('year-header.photo')}</span>
          <span class="menu-item-value">›</span>
        </button>
        <button class="menu-item" id="year-color-btn">
          <span>${t('year-header.color')}</span>
          <span class="menu-item-value"><span class="color-dot"></span> ›</span>
        </button>
      </dialog>

      <dialog id="color-sheet">
        <div class="menu-handle"></div>
        <p class="menu-section-label">${t('year-header.color')}</p>
        <div class="color-grid">
          ${PALETTE.map(({ hex, label }) => `<button class="swatch" data-color="${hex}" style="background:${hex}" aria-label="${label}"></button>`).join('')}
        </div>
        <button class="menu-item" id="color-reset-btn">
          <span>${t('year-header.color-reset')}</span>
        </button>
      </dialog>

      <dialog id="photo-sheet">
        <div class="menu-handle"></div>
        <p class="menu-section-label">${t('year-header.photo')}</p>
        <button class="menu-item" id="photo-add">
          <span>${t('year-header.photo-add')}</span>
        </button>
        <button class="menu-item" id="photo-change" hidden>
          <span>${t('year-header.photo-change')}</span>
        </button>
        <button class="menu-item destructive" id="photo-remove" hidden>
          <span>${t('year-header.photo-remove')}</span>
        </button>
      </dialog>
    `;
  }

  onSwipe(e) {
    const delta = e.direction === 'left' ? 1 : e.direction === 'right' ? -1 : 0;
    if (!delta) return;
    this.dispatchEvent(new CustomEvent('year-navigate', {
      bubbles: true, composed: true, detail: { year: this._year + delta },
    }));
  }

  subscribe() {
    this._yearEl     = this.shadowRoot.querySelector('#year');
    this._stripFill  = this.shadowRoot.querySelector('#strip-fill');
    this._menuDialog = this.shadowRoot.querySelector('#menu');
    this._compact    = false;
    this._imageUrl   = null;

    this._onImages = images => {
      this._imagesState = images;
      this._updateImageFor(this._year);
    };
    Store.subscribe('images', this._onImages);

    this._updateYear();

    document.documentElement.style.setProperty('--year-header-height', `${this.offsetHeight}px`);
    this._ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--year-header-height', `${this.offsetHeight}px`);
    });
    this._ro.observe(this);

    this._setupScroll();
    this._setupNav();
    this._setupMenu();
    this._setupPhoto();
    this._setupColor();
  }

  unsubscribe() {
    Store.unsubscribe('images', this._onImages);
    if (this._imageUrl) URL.revokeObjectURL(this._imageUrl);

    this.shadowRoot.querySelector('#prev')?.removeEventListener('click', this._onPrev);
    this.shadowRoot.querySelector('#next')?.removeEventListener('click', this._onNext);
    this.shadowRoot.querySelector('#menu-btn')?.removeEventListener('click', this._onMenuBtn);
    this._menuDialog?.removeEventListener('close', this._onMenuClose);
    this._menuDialog?.removeEventListener('click', this._onBackdrop);
    this.shadowRoot.querySelector('#year-photo-btn')?.removeEventListener('click', this._onYearPhotoBtn);
    this.shadowRoot.querySelector('#year-color-btn')?.removeEventListener('click', this._onYearColorBtn);
    this._colorSheet?.removeEventListener('click', this._onColorSheetClick);
    this.shadowRoot.querySelector('#color-reset-btn')?.removeEventListener('click', this._onColorReset);
    this._photoSheet?.removeEventListener('click', this._onPhotoSheetBackdrop);
    this.shadowRoot.querySelector('#photo-add')?.removeEventListener('click', this._onPhotoAdd);
    this.shadowRoot.querySelector('#photo-change')?.removeEventListener('click', this._onPhotoChange);
    this.shadowRoot.querySelector('#photo-remove')?.removeEventListener('click', this._onPhotoRemove);
    this.shadowRoot.querySelector('#photo-input')?.removeEventListener('change', this._onPhotoInput);
    this._ro?.disconnect();
    document.documentElement.style.removeProperty('--year-header-height');
    window.removeEventListener('scroll', this._onScroll);
  }

  _setupScroll() {
    this._onScroll = () => {
      const y = window.scrollY;
      const hasImage = this.hasAttribute('data-has-image');
      const goThreshold   = hasImage ? 20 : 80;
      const backThreshold = hasImage ? 10 : 60;
      if (!this._compact && y > goThreshold)    { this._compact = true;  this.classList.add('compact'); }
      else if (this._compact && y < backThreshold) { this._compact = false; this.classList.remove('compact'); }
    };
    window.addEventListener('scroll', this._onScroll, { passive: true });
  }

  _setupNav() {
    this._onPrev = () => this.dispatchEvent(new CustomEvent('year-navigate', {
      bubbles: true, composed: true, detail: { year: this._year - 1 },
    }));
    this._onNext = () => this.dispatchEvent(new CustomEvent('year-navigate', {
      bubbles: true, composed: true, detail: { year: this._year + 1 },
    }));
    this.shadowRoot.querySelector('#prev').addEventListener('click', this._onPrev);
    this.shadowRoot.querySelector('#next').addEventListener('click', this._onNext);
  }

  _setupMenu() {
    const menuBtn = this.shadowRoot.querySelector('#menu-btn');
    this._onMenuBtn = () => {
      this._menuDialog.showModal();
      menuBtn.setAttribute('aria-expanded', 'true');
    };
    menuBtn.addEventListener('click', this._onMenuBtn);

    this._onMenuClose = () => menuBtn.setAttribute('aria-expanded', 'false');
    this._menuDialog.addEventListener('close', this._onMenuClose);

    this._onBackdrop = e => {
      if (e.target === this._menuDialog) this._menuDialog.close();
    };
    this._menuDialog.addEventListener('click', this._onBackdrop);
  }

  _setupPhoto() {
    this._photoSheet = this.shadowRoot.querySelector('#photo-sheet');
    const photoInput = this.shadowRoot.querySelector('#photo-input');

    this._onYearPhotoBtn = () => {
      this._menuDialog.close();
      this._updatePhotoMenu(!!this._imagesState?.[this._year]);
      this._photoSheet.showModal();
    };
    this.shadowRoot.querySelector('#year-photo-btn').addEventListener('click', this._onYearPhotoBtn);

    this._onPhotoSheetBackdrop = e => {
      if (e.target === this._photoSheet) this._photoSheet.close();
    };
    this._photoSheet.addEventListener('click', this._onPhotoSheetBackdrop);

    const openPhotoPicker = () => {
      this._photoSheet.close();
      photoInput.click();
    };
    this._onPhotoAdd    = openPhotoPicker;
    this._onPhotoChange = openPhotoPicker;
    this.shadowRoot.querySelector('#photo-add').addEventListener('click', this._onPhotoAdd);
    this.shadowRoot.querySelector('#photo-change').addEventListener('click', this._onPhotoChange);

    this._onPhotoRemove = async () => {
      this._photoSheet.close();
      const year    = String(this._year);
      const imageId = Store.getState().images?.[year];
      const images  = { ...Store.getState().images };
      delete images[year];
      Store.setState('images', images);
      try {
        if (imageId) await Store.deleteBlob(imageId);
      } catch (err) {
        console.error('Failed to delete photo blob:', err);
      }
    };
    this.shadowRoot.querySelector('#photo-remove').addEventListener('click', this._onPhotoRemove);

    this._onPhotoInput = async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const year       = String(this._year);
        const oldImageId = Store.getState().images?.[year];
        const imageId    = crypto.randomUUID();
        const blob       = await compressImage(file, { maxWidth: 1200, quality: 0.8 });
        await Store.attachBlob(imageId, blob);
        Store.setState('images', { ...Store.getState().images, [year]: imageId });
        if (oldImageId) await Store.deleteBlob(oldImageId);
      } catch (err) {
        console.error('Failed to upload photo:', err);
      } finally {
        e.target.value = '';
      }
    };
    photoInput.addEventListener('change', this._onPhotoInput);
  }

  _setupColor() {
    this._colorSheet = this.shadowRoot.querySelector('#color-sheet');

    this._onYearColorBtn = () => {
      this._menuDialog.close();
      this._updateSwatches(Store.getState().accentColors?.[String(this._year)] ?? null);
      this._colorSheet.showModal();
    };
    this.shadowRoot.querySelector('#year-color-btn').addEventListener('click', this._onYearColorBtn);

    this._onColorSheetClick = e => {
      if (e.target === this._colorSheet) { this._colorSheet.close(); return; }
      const swatch = e.target.closest('.swatch');
      if (!swatch) return;
      const hex = swatch.dataset.color;
      Store.setState('accentColors', { ...Store.getState().accentColors, [String(this._year)]: hex });
      this._updateSwatches(hex);
      this._colorSheet.close();
    };
    this._colorSheet.addEventListener('click', this._onColorSheetClick);

    this._onColorReset = () => {
      const colors = { ...Store.getState().accentColors };
      delete colors[String(this._year)];
      Store.setState('accentColors', colors);
      this._updateSwatches(null);
      this._colorSheet.close();
    };
    this.shadowRoot.querySelector('#color-reset-btn').addEventListener('click', this._onColorReset);
  }

  _updateSwatches(currentHex) {
    this._colorSheet?.querySelectorAll('.swatch').forEach(btn => {
      const active = btn.dataset.color === currentHex;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  _updateYear() {
    const year = this._year ?? new Date().getFullYear();
    if (this._yearEl) this._yearEl.textContent = String(year);
    const pct = yearProgress(year);
    if (this._stripFill) this._stripFill.style.width = `${pct}%`;
    this._updateImageFor(year);
  }

  async _updateImageFor(year) {
    const imageId = this._imagesState?.[year];
    if (!imageId) {
      this._clearImage();
      return;
    }
    this.setAttribute('data-has-image', '');
    const blob = await Store.getBlob(imageId);
    // Guard: year may have changed while the blob fetch was in-flight
    if (this._year !== year) return;
    if (!blob) {
      this._clearImage();
      return;
    }
    if (this._imageUrl) URL.revokeObjectURL(this._imageUrl);
    this._imageUrl = URL.createObjectURL(blob);
    this.shadowRoot.querySelector('#header-img').src = this._imageUrl;
    this._updatePhotoMenu(true);
  }

  _clearImage() {
    if (this._imageUrl) {
      URL.revokeObjectURL(this._imageUrl);
      this._imageUrl = null;
    }
    const img = this.shadowRoot?.querySelector('#header-img');
    if (img) img.src = '';
    this.removeAttribute('data-has-image');
    this._updatePhotoMenu(false);
  }

  _updatePhotoMenu(hasImage) {
    const addBtn    = this.shadowRoot?.querySelector('#photo-add');
    const changeBtn = this.shadowRoot?.querySelector('#photo-change');
    const removeBtn = this.shadowRoot?.querySelector('#photo-remove');
    if (addBtn)    addBtn.hidden    = hasImage;
    if (changeBtn) changeBtn.hidden = !hasImage;
    if (removeBtn) removeBtn.hidden = !hasImage;
  }
}

function yearProgress(year) {
  const now     = new Date();
  const current = now.getFullYear();
  if (year < current) return 100;
  if (year > current) return 0;
  const start = new Date(year, 0, 1).getTime();
  const end   = new Date(year + 1, 0, 1).getTime();
  return Math.round((now.getTime() - start) / (end - start) * 100);
}

customElements.define('year-header', YearHeader);
