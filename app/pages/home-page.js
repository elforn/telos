import { toast } from '../../_lib/modules/toast/toast.js';
import { Gestures } from '../../_lib/modules/gestures/gestures.js';
import { compressImage } from '../../_lib/modules/images/images.js';
import { AppElement } from '../../_lib/core/app-element.js';

class HomePage extends AppElement {
  template() {
    return `
      <style>
        :host { display: block; }
        main {
          padding: var(--space-4);
          padding-block-end: calc(var(--space-4) + var(--safe-area-bottom, 0px));
          max-inline-size: 600px;
          margin-inline: auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .card {
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          padding-block-start: var(--space-1);
          padding-block-end: var(--space-4);
          padding-inline: var(--space-4);
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-card);
        }
        h2 {
          font-size: var(--font-size-subheading);
          font-weight: var(--font-weight-bold);
          padding-block-end: var(--space-2);
          border-block-end: 0.5px solid var(--color-border);
          margin-block-start: 0.5em;
          margin-block-end: 0.5em;
        }
        p { font-size: var(--font-size-body); color: var(--color-text-secondary); margin-block: 0; }
        .card label,
        .card fieldset,
        .card div,
        .card p { margin-block-end: 0.6em; }
        .card fieldset { margin-block-start: 0.5em; }
        .card fieldset label { margin-block-end: 0; }
        label {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          font-size: var(--font-size-body);
        }
        input[type="text"], textarea {
          padding: var(--space-2) var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          background: var(--color-bg);
          color: var(--color-text-primary);
          inline-size: 100%;
        }
        textarea { block-size: 80px; resize: vertical; }
        input[type="text"]:hover, textarea:hover {
          border-color: var(--color-accent);
          transition: border-color 0.15s;
        }
        input[type="text"]:focus, textarea:focus {
          border-color: var(--color-accent);
          background: var(--color-accent-subtle);
          outline: none;
        }
        fieldset {
          border: none;
          border-radius: var(--radius-full);
          padding: var(--space-1);
          background: var(--color-accent-subtle);
          display: flex;
          flex-direction: row;
          gap: var(--space-1);
        }
        legend {
          position: absolute;
          inline-size: 1px;
          block-size: 1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
        }
        .radio-label {
          flex: 1;
          block-size: var(--touch-target);
          min-block-size: unset;
          border-radius: var(--radius-full);
          background: transparent;
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s, box-shadow 0.15s;
        }
        .radio-label input[type="radio"] {
          position: absolute;
          opacity: 0;
          inline-size: 1px;
          block-size: 1px;
          pointer-events: none;
        }
        .radio-label:has(input:checked) {
          background: var(--color-surface);
          color: var(--color-text-primary);
          font-weight: var(--font-weight-bold);
          box-shadow: var(--shadow-card);
        }
        .toggle-label {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: var(--space-3);
          min-block-size: var(--touch-target);
          cursor: pointer;
        }
        .toggle-label input[type="checkbox"] {
          position: absolute;
          opacity: 0;
          width: 1px;
          height: 1px;
          pointer-events: none;
        }
        .toggle-label input:focus-visible ~ .toggle-track {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
        .toggle-track {
          inline-size: 44px;
          block-size: 26px;
          background: var(--color-border);
          border-radius: 13px;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .toggle-thumb {
          position: absolute;
          inset-block-start: 3px;
          inset-inline-start: 3px;
          inline-size: 20px;
          block-size: 20px;
          border-radius: 50%;
          background: var(--color-text-inverse);
          transition: inset-inline-start 0.2s;
        }
        .toggle-label input:checked ~ .toggle-track { background: var(--color-accent); }
        .toggle-label input:checked ~ .toggle-track .toggle-thumb { inset-inline-start: 21px; }
        .tabs {
          display: flex;
          border-block-end: 2px solid var(--color-border);
          gap: var(--space-1);
        }
        .tabs button {
          background: none;
          border: none;
          padding: var(--space-2) var(--space-3);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: var(--color-text-secondary);
          cursor: pointer;
          border-block-end: 2px solid transparent;
          margin-block-end: -2px;
          min-block-size: var(--touch-target);
        }
        .tabs button[aria-selected="true"] {
          color: var(--color-text-primary);
          border-block-end-color: var(--color-accent);
          font-weight: var(--font-weight-bold);
        }
        [role="tabpanel"] {
          padding-block: var(--space-2);
          font-size: var(--font-size-body);
          color: var(--color-text-secondary);
        }
        .actions {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }
        button.primary {
          background: var(--color-accent);
          color: var(--color-text-inverse);
          border: none;
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-4);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: var(--font-weight-bold);
          min-block-size: var(--touch-target);
          cursor: pointer;
          transition: background 0.15s;
        }
        button.primary:hover { background: var(--color-accent-dark); }
        button.secondary {
          background: var(--color-surface);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-4);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          min-block-size: var(--touch-target);
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        button.secondary:hover {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
        }
        .bar-wrapper {
          block-size: 52px;
          background: var(--color-border);
          border-radius: var(--radius-md);
          position: relative;
          overflow: hidden;
          cursor: grab;
          user-select: none;
          touch-action: none;
        }
        .bar-wrapper.hold-active { cursor: grabbing; }
        .fill {
          block-size: 100%;
          inline-size: var(--pct, 0%);
          background: var(--color-accent);
          transition: inline-size 0.1s;
          border-radius: var(--radius-md);
        }
        .bar-wrapper.hold-active .fill { transition: none; }
        .pct-label {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          padding-inline: var(--space-3);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          pointer-events: none;
        }
        .img-preview {
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--color-surface-raised);
          min-block-size: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-secondary);
          font-size: var(--font-size-caption);
        }
        .img-preview img { max-inline-size: 100%; display: block; }
        .img-meta { font-size: var(--font-size-caption); color: var(--color-text-secondary); }
      </style>
      <main>
        <section class="card">
          <h2>Telos</h2>

          <label>
            Entry
            <input type="text" id="entry-input" placeholder="Type something…" />
          </label>

          <label>
            Notes
            <textarea id="notes-input" placeholder="Additional notes…"></textarea>
          </label>

          <fieldset>
            <legend>Priority</legend>
            <label class="radio-label">
              <input type="radio" name="priority" value="low" checked />
              Low
            </label>
            <label class="radio-label">
              <input type="radio" name="priority" value="high" />
              High
            </label>
          </fieldset>

          <label class="toggle-label">
            <input type="checkbox" id="notify-toggle" />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            Notify me
          </label>

          <div>
            <div class="tabs" role="tablist" aria-label="View">
              <button role="tab" aria-selected="true" aria-controls="tab-details" id="tab-btn-details">Details</button>
              <button role="tab" aria-selected="false" aria-controls="tab-history" id="tab-btn-history">History</button>
            </div>
            <div id="tab-details" role="tabpanel" aria-labelledby="tab-btn-details">
              Details will appear here.
            </div>
            <div id="tab-history" role="tabpanel" aria-labelledby="tab-btn-history" hidden>
              History will appear here.
            </div>
          </div>

          <div class="actions">
            <button class="primary" id="submit-btn">Save entry</button>
            <button class="secondary" id="modal-btn">Info modal</button>
          </div>
        </section>

        <section class="card">
          <h2>Gesture demo</h2>
          <p>Hold and drag the bar to adjust the value.</p>
          <div class="bar-wrapper" id="gesture-bar">
            <div class="fill" id="gesture-fill"></div>
            <span class="pct-label" id="gesture-pct">0%</span>
          </div>
        </section>

        <section class="card">
          <h2>Data sync</h2>
          <p>Export your data for backup or to transfer to another device.</p>
          <div class="actions">
            <button class="secondary" id="export-btn">Export backup</button>
            <button class="secondary" id="import-btn">Import</button>
          </div>
          <input type="file" accept=".tlos,.json" id="sync-file-input" hidden />
        </section>

        <section class="card">
          <h2>Images</h2>
          <p>Pick an image to compress and store it locally.</p>
          <div class="img-preview" id="img-preview">No image yet</div>
          <p class="img-meta" id="img-meta" hidden></p>
          <div class="actions">
            <button class="secondary" id="img-pick-btn">Pick image</button>
          </div>
          <input type="file" accept="image/*" id="img-file-input" hidden />
        </section>

        <modal-dialog id="demo-modal">
          <p>Replace this modal with your app's content.</p>
          <button slot="footer" class="primary" id="modal-close-btn">Close</button>
        </modal-dialog>
      </main>
    `;
  }

  subscribe() {
    const sr = this.shadowRoot;

    this._onSubmit = () => {
      toast('Entry saved', 'success');
    };
    sr.querySelector('#submit-btn').addEventListener('click', this._onSubmit);

    this._onModalOpen  = () => sr.querySelector('#demo-modal').show();
    this._onModalClose = () => sr.querySelector('#demo-modal').close();
    sr.querySelector('#modal-btn').addEventListener('click', this._onModalOpen);
    sr.querySelector('#modal-close-btn').addEventListener('click', this._onModalClose);

    const _bar  = sr.querySelector('#gesture-bar');
    const _fill = sr.querySelector('#gesture-fill');
    const _lbl  = sr.querySelector('#gesture-pct');
    this._gestureCleanup = Gestures.attach(_bar, {
      onHoldDragStart: () => _bar.classList.add('hold-active'),
      onHoldDrag: e => {
        const rect = _bar.getBoundingClientRect();
        const pct  = Math.round(Math.max(0, Math.min(100, (e.endX - rect.left) / rect.width * 100)));
        _fill.style.setProperty('--pct', pct + '%');
        _lbl.textContent = pct + '%';
      },
      onHoldDragEnd: () => _bar.classList.remove('hold-active'),
      onHoldDragKey: dir => {
        const cur = parseFloat(_fill.style.getPropertyValue('--pct') || '0');
        const pct = Math.round(Math.max(0, Math.min(100, cur + (dir === 'right' ? 5 : -5))));
        _fill.style.setProperty('--pct', pct + '%');
        _lbl.textContent = pct + '%';
      },
    });

    this._onExport = async () => {
      const { exportData, downloadExport } = await import('../../_lib/modules/sync/sync.js');
      const data = await exportData();
      downloadExport(data, 'Telos-backup.tlos');
      toast('Backup ready', 'success');
    };
    this._onImportClick = () => sr.querySelector('#sync-file-input').click();
    this._onFileChange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      const { readImportFile, importData } = await import('../../_lib/modules/sync/sync.js');
      const payload = await readImportFile(file);
      const result  = await importData(payload);
      toast('Imported ' + result.eventsAdded + ' event' + (result.eventsAdded === 1 ? '' : 's'), 'success');
      e.target.value = '';
    };
    sr.querySelector('#export-btn').addEventListener('click', this._onExport);
    sr.querySelector('#import-btn').addEventListener('click', this._onImportClick);
    sr.querySelector('#sync-file-input').addEventListener('change', this._onFileChange);

    this._onImgPick = () => sr.querySelector('#img-file-input').click();
    this._onImgFile = async e => {
      const file = e.target.files[0];
      if (!file) return;
      const blob = await compressImage(file, { maxWidth: 1200, quality: 0.8 });
      const id   = crypto.randomUUID();
      await Store.attachBlob(id, blob);
      const url     = URL.createObjectURL(blob);
      const preview = sr.querySelector('#img-preview');
      const img = document.createElement('img');
      img.src = url; img.alt = 'Compressed image';
      preview.textContent = '';
      preview.appendChild(img);
      sr.querySelector('#img-meta').hidden = false;
      sr.querySelector('#img-meta').textContent = Math.round(blob.size / 1024) + ' KB';
      toast('Image saved', 'success');
      e.target.value = '';
    };
    sr.querySelector('#img-pick-btn').addEventListener('click', this._onImgPick);
    sr.querySelector('#img-file-input').addEventListener('change', this._onImgFile);

    this._tabs   = [...sr.querySelectorAll('[role="tab"]')];
    this._panels = [...sr.querySelectorAll('[role="tabpanel"]')];
    this._onTab  = e => {
      const idx = this._tabs.indexOf(e.currentTarget);
      this._tabs.forEach((t, i)   => t.setAttribute('aria-selected', String(i === idx)));
      this._panels.forEach((p, i) => { p.hidden = i !== idx; });
    };
    this._tabs.forEach(t => t.addEventListener('click', this._onTab));
  }

  unsubscribe() {
    const sr = this.shadowRoot;
    sr.querySelector('#submit-btn')?.removeEventListener('click', this._onSubmit);
    sr.querySelector('#modal-btn')?.removeEventListener('click', this._onModalOpen);
    sr.querySelector('#modal-close-btn')?.removeEventListener('click', this._onModalClose);
    this._gestureCleanup?.();
    sr.querySelector('#export-btn')?.removeEventListener('click', this._onExport);
    sr.querySelector('#import-btn')?.removeEventListener('click', this._onImportClick);
    sr.querySelector('#sync-file-input')?.removeEventListener('change', this._onFileChange);
    sr.querySelector('#img-pick-btn')?.removeEventListener('click', this._onImgPick);
    sr.querySelector('#img-file-input')?.removeEventListener('change', this._onImgFile);
    this._tabs?.forEach(t => t.removeEventListener('click', this._onTab));
  }
}

customElements.define('home-page', HomePage);
