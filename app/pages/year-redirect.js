import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';

class YearRedirect extends HTMLElement {
  connectedCallback() {
    navigate(`${BASE_PATH}${new Date().getFullYear()}`);
  }
}

customElements.define('year-redirect', YearRedirect);
