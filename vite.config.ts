import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    // Required for root `vp test` runs: packages/web/vitest.config.ts setupFiles
    // are not applied there, and without the fetch mock web tests spam
    // ECONNREFUSED noise from happy-dom resolving relative fetches.
    setupFiles: ['./packages/web/src/test/setup.ts'],
  },
  staged: {
    '*.{ts,tsx}': [
      'vp lint --fix',
      'vp fmt . --write',
      'ast-grep scan',
      'sh -c "fallow audit --changed-since HEAD --format compact"',
    ],
    '*.{json,md,yaml,yml,css}': 'prettier --write',
  },
});
