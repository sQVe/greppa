import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: 'src/index.ts',
    format: 'esm',
    dts: false,
    deps: { alwaysBundle: [/@greppa\//] },
    banner: { js: '#!/usr/bin/env node' },
  },
});
