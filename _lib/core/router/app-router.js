import { AppElement } from '../app-element.js';
import { matchRoute } from './router.js';

const transitionSheet = new CSSStyleSheet();
transitionSheet.replaceSync(`
  @keyframes _routerFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .enter {
    animation: _routerFadeIn var(--duration-normal, 220ms) var(--ease-out, cubic-bezier(0.0, 0.0, 0.2, 1)) both;
  }
`);

class AppRouter extends AppElement {
  set routes(value) {
    this._routes = value;
    // shadowRoot is null if routes is set before connectedCallback; subscribe() calls _route() instead
    if (this.shadowRoot) this._route();
  }

  subscribe() {
    this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, transitionSheet];
    this._onNavigate = () => this._route();
    this._onPopstate = () => this._route();
    window.addEventListener('navigate', this._onNavigate);
    window.addEventListener('popstate', this._onPopstate);
    this._route();
  }

  unsubscribe() {
    window.removeEventListener('navigate', this._onNavigate);
    window.removeEventListener('popstate', this._onPopstate);
  }

  _route() {
    if (!this._routes) return;
    const path = location.pathname;
    if (path === this._currentPath) return;
    this._currentPath = path;
    const matched = matchRoute(this._routes, path);
    if (!matched) return;
    const { route, params } = matched;
    const el = document.createElement(route.component);
    el.params = params;
    el.classList.add('enter');
    this.shadowRoot.replaceChildren(el);
  }

  template() {
    return '';
  }
}

customElements.define('app-router', AppRouter);
