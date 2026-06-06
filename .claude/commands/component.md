# /component

Scaffold a new Web Component for this project.

## Usage
/component <name> <tier> [gestures]

- `name` — kebab-case element name, e.g. `score-card`
- `tier` — one of: `page`, `ui`, `service`
- `gestures` — optional, comma-separated list of gestures to register, e.g. `tap,swipeLeft`

## What to do

0. **Before writing any code, read in this order:**
   - `_lib/core/styles/tokens.css` — every available design value
   - The most similar existing component in `app/` — match its structure and token usage exactly
   Only then implement.

1. **Determine the file path** based on tier:
   - `page` → `app/pages/<name>.js`
   - `ui` → `app/components/<name>/<name>.js`
   - `service` → `app/components/<name>/<name>.js` (no shadow DOM, no template)

2. **Create the component file** following these rules exactly:
   - Extend `AppElement`: import from `../_lib/core/app-element.js` (page) or `../../_lib/core/app-element.js` (ui/service)
   - If `gestures` were specified, also mix in `Gestures` from `_lib/modules/gestures/gestures.js`
   - `template()` returns a template literal with a `<style>` block first, then markup
   - All style values use CSS custom properties from `_lib/core/styles/tokens.css` — no hardcoded values
   - `subscribe()` wires store subscriptions and event listeners
   - `ui` components: data comes from attributes/properties, not the store directly
   - `service` components: no `template()`, no shadow DOM, manage lifecycle only
   - Register the custom element at the bottom: `customElements.define('<name>', ClassName)`

3. **Create the test file** at the same path with `.test.js` suffix:
   - Import the component
   - Write at minimum: a test that the element mounts without error, and one test per public behaviour
   - Use Vitest + happy-dom (`// @vitest-environment happy-dom` at the top)
   - For `ui` components: pass data via attributes directly — no store needed

4. **Report** what was created and what tests still need real implementation detail from the developer.

## Component template (page tier example)

```js
import { AppElement } from '../_lib/core/app-element.js';
import { subscribe, unsubscribe } from '../_lib/core/store/store.js';

class ScoreCard extends AppElement {
  subscribe() {
    this._onScores = scores => {
      this.shadowRoot.querySelector('.score').textContent = scores?.current ?? '';
    };
    subscribe('scores', this._onScores);
  }

  unsubscribe() {
    unsubscribe('scores', this._onScores);
  }

  template() {
    return `
      <style>
        :host { display: block; padding: var(--space-md); }
      </style>
      <main>
        <div class="score"></div>
      </main>
    `;
  }
}

customElements.define('score-card', ScoreCard);
```
