import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../.env.local'));
} catch {
  // .env.local may not exist yet — fall back to defaults
}

// oxlint-disable-next-line no-process-env
const playgroundPort = process.env['PLAYGROUND_PORT'] ?? '5174';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(playgroundPort),
    strictPort: true,
  },
});
