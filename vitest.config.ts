import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['client/**', 'node_modules/**', 'dist/**'],
    testTimeout: 10000,
  },
});
