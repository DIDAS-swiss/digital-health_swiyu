import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    // The journey test starts real HTTP listeners for the mock trust
    // infrastructure, so files must not race for the same ports.
    fileParallelism: false,
    testTimeout: 20_000,
    // The demo app logs at info by default; a passing suite should be quiet.
    env: { LOG_LEVEL: 'silent' },
  },
});
