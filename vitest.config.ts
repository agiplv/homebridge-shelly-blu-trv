import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
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
        'scripts/**',
        'node_modules/**'
      ]
    }
  }
});
