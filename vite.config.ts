import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*.{ts,tsx}': ['vp lint --fix', 'vp fmt . --write'],
    '*.{json,md,yaml,css}': 'prettier --write',
  },
});
