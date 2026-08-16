import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/global-setup.ts'],
    include: [
      'tests/agents/**/*.test.ts',
      'tests/workspace/**/*.test.ts',
      'tests/queue/**/*.test.ts',
      'tests/registry/**/*.test.ts',
      'tests/graph/**/*.test.ts',
      'tests/api/**/*.test.ts',
      'tests/middleware/**/*.test.ts',
      'tests/evals/**/*.test.ts',
    ],
  },
});