import { AppElement } from '../../_lib/core/app-element.js';
import * as Store from '../../_lib/core/store/store.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import { compressImage } from '../../_lib/modules/images/images.js';

class ImagesPage extends AppElement {
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
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        h2 { font-size: var(--font-size-heading); font-weight: var(--font-weight-bold); }
        p  { font-size: var(--font-size-body); color: var(--color-text-secondary); }
        button {
          background: var(--color-accent);
          color: var(--color-text-inverse);
          border: none;
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-4);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: var(--font-weight-bold);
          min-block-size: 44px;
          cursor: pointer;
          align-self: flex-start;
        }
        .preview {
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--color-border);
          min-block-size: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .preview img {
          max-inline-size: 100%;
          display: block;
        }
        .preview.empty::after {
          content: 'No image yet';
          color: var(--color-text-secondary);
          font-size: var(--font-size-body);
        }
        .meta { font-size: var(--font-size-caption); color: var(--color-text-secondary); }
      </style>
      <main>
        <section class="card">
          <h2>Images</h2>
          <p>Pick an image to compress and store it locally.</p>
          <button id="pick-btn">Pick image</button>
          <input type="file" accept="image/*" id="file-input" hidden />
          <div class="preview empty" id="preview"></div>
          <p class="meta" id="meta" hidden></p>
        </section>
      </main>
    `;
  }

  subscribe() {
    const sr = this.shadowRoot;

    this._onPick = () => sr.querySelector('#file-input').click();
    sr.querySelector('#pick-btn').addEventListener('click', this._onPick);

    this._onFile = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const blob = await compressImage(file, { maxWidth: 1200, quality: 0.8 });
        const id   = crypto.randomUUID();
        await Store.attachBlob(id, blob);

        const url     = URL.createObjectURL(blob);
        const preview = sr.querySelector('#preview');
        const meta    = sr.querySelector('#meta');
        preview.classList.remove('empty');
        preview.innerHTML = `<img src="${url}" alt="Compressed image" />`;
        meta.hidden = false;
        meta.textContent = `Stored ${Math.round(blob.size / 1024)} KB (id: ${id.slice(0, 8)}…)`;

        toast('Image saved', 'success');
      } catch {
        toast('Could not process image', 'error');
      }
      e.target.value = '';
    };
    sr.querySelector('#file-input').addEventListener('change', this._onFile);
  }

  unsubscribe() {
    const sr = this.shadowRoot;
    sr.querySelector('#pick-btn')?.removeEventListener('click', this._onPick);
    sr.querySelector('#file-input')?.removeEventListener('change', this._onFile);
  }
}

customElements.define('images-page', ImagesPage);
