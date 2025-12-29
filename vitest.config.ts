import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      statements: 75,
      branches: 75,
      functions: 75,
      lines: 75,
      check: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80
        }
      },
      exclude: [
        'hb-test/**',
        'node_modules/**'
      ]
    }
  }
});
