# /test

Write or complete tests for a given file or module.

## Usage
/test <filepath>

Example: `/test app/store/reducer.js`

## What to do

1. **Read the target file in full.** Understand every exported function, class, and behaviour.

2. **Read the existing test file** if one exists (same path, `.test.js` suffix). Identify what is already covered and what is missing.

3. **Identify what must be tested:**
   - Every exported function with at least one happy-path test
   - Every known edge case (empty input, missing keys, concurrent writes)
   - Every error condition that should throw or fail loudly
   - For Web Components: mount, attribute reflection, event emission
   - For store/IDB modules: use `fake-indexeddb` (loaded globally via `_lib/core/test-setup.js`) — never mock IDB, run against the real API. Only add `// @vitest-environment happy-dom` if the test actually uses `document`, `customElements`, or Shadow DOM.
   - For SW behaviour: note what cannot be unit tested and flag it for Playwright E2E coverage instead

4. **Write the unit tests** using Vitest. Follow these rules:
   - Test file lives alongside the source file: `foo.js` → `foo.test.js`
   - Test descriptions are plain English statements of behaviour: `'emits an event when a new score is appended'` not `'test score append'`
   - No test should depend on another test's side effects — each test is fully isolated
   - Do not mock what you can run for real
   - If a behaviour cannot be tested without a full browser (gestures, SW, Pointer Events), write the test structure with a clear skip and a comment explaining what Playwright should cover instead

5. **Identify what needs E2E coverage.** After writing unit tests, check for behaviours that require a real browser and cannot be unit-tested with `happy-dom`:
   - State that persists to IDB and must survive a full page reload
   - Gestures via real pointer events (`happy-dom` does not fire these correctly)
   - File input / camera / device APIs
   - Shadow DOM state changes that depend on the full Store → IDB → reload → replay cycle

   **E2E test file location:** `tests/e2e/<feature-name>.spec.js`

   **Standard patterns for Playwright tests:**

   Shadow DOM traversal (components are nested behind shadow roots — `querySelector` stops at the first boundary):
   ```js
   // Use page.evaluate() for shadow DOM access
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

   For PWA-specific scenarios (offline, SW update flow, install), use `/test-pwa` instead.

6. **Report** a summary: how many unit tests written, what is covered, what E2E tests were written, what is explicitly deferred to E2E but not yet written, and any gaps that need the developer's input.
