import { AppElement } from '../../_lib/core/app-element.js';

class NotFoundPage extends AppElement {
  template() {
    return '<main><h1>404 — Page not found</h1></main>';
  }
}

customElements.define('not-found-page', NotFoundPage);
