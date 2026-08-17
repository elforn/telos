// Test fixture only — simulates a consuming app's app/strings.js, which registers strings
// via defineStrings() as a one-time module-load side effect. Used by strings.test.js to
// reproduce the reset()-under-`isolate: false` regression (see _snapshot/_restore in strings.js).
import { defineStrings } from './strings.js';

defineStrings({ 'fixture.greeting': 'Hello from fixture' });
