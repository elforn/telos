import { navigate } from '../../_lib/core/router/router.js';

class YearRedirect extends HTMLElement {
  connectedCallback() {
    navigate(`/${new Date().getFullYear()}`);
  }
}

customElements.define('year-redirect', YearRedirect);
