import { VitestReporter } from 'tdd-guard-vitest';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    reporters: ['default', new VitestReporter(import.meta.dirname)],
  },
  staged: {
    '*.{ts,tsx}': ['vp lint --fix', 'vp fmt --write'],
    '*.{json,md,yaml,css}': 'vp fmt --write',
  },
});
