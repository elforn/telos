import { baseSheet } from './styles/base.js';
import { subscribe as storeSubscribe, unsubscribe as storeUnsubscribe } from './store/store.js';

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
    this._listens?.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
    this._listens = null;
    this._watches?.forEach(([key, cb]) => storeUnsubscribe(key, cb));
    this._watches = null;
  }

  /**
   * addEventListener with automatic removal on disconnect. Identical semantics
   * to a manual add/remove pair — the same options object (including
   * `{capture}`) is passed to removeEventListener. Returns an unlisten
   * function for mid-life removal.
   *
   * Not for per-gesture dynamic listeners (pointermove/up added on
   * pointerdown) — those have sub-connection lifecycles and must keep manual
   * management.
   */
  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    const record = [target, type, handler, options];
    (this._listens ??= []).push(record);
    return () => {
      target.removeEventListener(type, handler, options);
      const i = this._listens?.indexOf(record) ?? -1;
      if (i !== -1) this._listens.splice(i, 1);
    };
  }

  /**
   * Store subscription with automatic unsubscribe on disconnect. Delegates to
   * store subscribe(key, callback) — the callback fires immediately with the
   * current value. Returns an unwatch function for mid-life removal.
   */
  watch(key, callback) {
    storeSubscribe(key, callback);
    const record = [key, callback];
    (this._watches ??= []).push(record);
    return () => {
      storeUnsubscribe(key, callback);
      const i = this._watches?.indexOf(record) ?? -1;
      if (i !== -1) this._watches.splice(i, 1);
    };
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
