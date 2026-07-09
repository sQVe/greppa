import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
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
