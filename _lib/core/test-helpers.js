import { beforeAll, afterAll } from 'vitest';

// Wraps a module singleton's test-only `_snapshot()`/`_restore()` pair in a
// beforeAll/afterAll boundary, so a test file that calls the module's `reset()`
// per-test can never leak that reset past its own suite when it shares a vitest
// worker with other test files (`isolate: false`). Call once per guarded module,
// outside any describe block. See core/strings.js's _snapshot/_restore and the
// regression this fixed in core/strings.test.js and update-banner.test.js.
export function guardSingleton(snapshot, restore) {
  let saved;
  beforeAll(() => { saved = snapshot(); });
  afterAll(() => { restore(saved); });
}
