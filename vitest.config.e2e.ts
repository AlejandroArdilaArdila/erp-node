import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['apps/**/test/**/*.e2e-spec.ts'],
    setupFiles: ['apps/api/test/setup-env.ts'],
  },
});
