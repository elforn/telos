# /test

Write or complete tests for a given file or module. Unit tests and E2E tests are equally important — both must be written and passing before a feature is done.

## Usage
/test <filepath>

Example: `/test app/store/reducer.js`

## What to do

1. **Read the target file in full.** Understand every exported function, class, and behaviour.

2. **Read the existing test files** — both the unit test (same path, `.test.js` suffix) and any relevant E2E spec in `tests/e2e/`. Identify what is already covered and what is missing in each.

3. **Identify what must be tested and where:**

   Unit tests (Vitest) — logic that runs in isolation:
   - Every exported function with at least one happy-path test
   - Every known edge case (empty input, missing keys, concurrent writes)
   - Every error condition that should throw or fail loudly
   - Web Component: mount, attribute reflection, event emission
   - Store/IDB modules: use `fake-indexeddb` (loaded globally via `_lib/core/test-setup.js`) — never mock IDB, run against the real API

   E2E tests (Playwright) — anything that requires a real browser:
   - State that persists to IDB and must survive a full page reload
   - Gestures via real pointer events (`happy-dom` does not fire these correctly)
   - Navigation flows and URL routing
   - Shadow DOM state changes that depend on the full Store → IDB → reload → replay cycle
   - File input / camera / device APIs
   - SW behaviour — use `/test-pwa` instead for offline/install scenarios

4. **Write the unit tests** using Vitest:
   - Test file lives alongside the source file: `foo.js` → `foo.test.js`
   - Only add `// @vitest-environment happy-dom` if the test actually uses `document`, `customElements`, or Shadow DOM
   - Test descriptions are plain English statements of behaviour: `'emits an event when a new score is appended'` not `'test score append'`
   - No test should depend on another test's side effects — each test is fully isolated
   - Do not mock what you can run for real

5. **Write the E2E tests** using Playwright in `tests/e2e/<feature-name>.spec.js`:

   Shadow DOM traversal (components are nested behind shadow roots — `querySelector` stops at the first boundary):
   ```js
   await page.evaluate((sel) => {
     document.querySelector('app-router').shadowRoot
       .querySelector('home-page').shadowRoot
       .querySelector(sel).click();
   }, '#my-button');
   ```

   Wait for the app to be ready before acting:
   ```js
   await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
   await page.waitForFunction(() =>
     !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
   );
   ```

   For real pointer events needed by the Gestures mixin (tap, swipe, hold-drag), use `page.mouse` with bounding box coordinates:
   ```js
   const box = await page.evaluate(() =>
     document.querySelector('app-router').shadowRoot
       .querySelector('home-page').shadowRoot
       .querySelector('#target').getBoundingClientRect()
   );
   await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
   ```

6. **Run all tests** (`npm test`) and confirm both unit and E2E suites pass before reporting done.

7. **Report** a summary: unit tests written/updated, E2E tests written/updated, what is covered in each, and any gaps that need the developer's input.

---

## Rules

- **Never edit working production code to make a failing test pass.** If a test fails, fix the test — rewrite it to match the correct behaviour, or drop it if the scenario being tested is impossible in practice. The production code is ground truth; tests are a description of expected behaviour. Editing code to satisfy a test inverts this relationship.

- **Drop tests for impossible scenarios.** For example, a test that checks behaviour "when a modal dialog is open" is testing a state that's physically unreachable if the dialog captures all pointer events. These tests add noise and create pressure to write incorrect guards. Remove them and leave a comment explaining why the scenario can't occur.
