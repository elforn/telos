import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    fs: { allow: ['..'] },
  },
  test: {
    include: ['tests/unit/**/*.test.js', '_lib/**/*.test.js'],
    environment: 'node',
    setupFiles: ['./_lib/core/test-setup.js'],
  },
});
