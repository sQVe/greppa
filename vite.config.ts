import { defineConfig } from 'vite-plus';

export default defineConfig({
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
