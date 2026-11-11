import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: { NODE_ENV: 'test' },
    setupFiles: ['./tests/setup/env.js'],
    globalSetup: ['./tests/setup/global.js'],
    // All suites share one Postgres database, so run files sequentially.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js', 'src/db/cli.js', 'src/db/seeds/**'],
    },
  },
});
