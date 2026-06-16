import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __BASE_PATH__: '"/"', __APP_VERSION__: '"0.0.0-test"' },
  server: {
    fs: { allow: ['..'] },
  },
  test: {
    include: ['tests/unit/**/*.test.js', '_lib/**/*.test.js'],
    environment: 'node',
    setupFiles: ['./_lib/core/test-setup.js'],
  },
});
