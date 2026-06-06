import { baseSheet } from './styles/base.js';

export class AppElement extends HTMLElement {
  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.adoptedStyleSheets = [baseSheet];
      this.render();
    }
    this.subscribe();
  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  render() {
    this.shadowRoot.innerHTML = this.template();
  }

  template() {
    return '';
  }

  subscribe() {}

  unsubscribe() {}
}
