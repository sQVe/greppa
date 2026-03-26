import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../.env.local'));
} catch {
  // .env.local may not exist yet — fall back to defaults
}

// oxlint-disable-next-line no-process-env
const apiPort = process.env['API_PORT'] ?? '4400';
// oxlint-disable-next-line no-process-env
const devPort = process.env['DEV_PORT'] ?? '5173';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(devPort),
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
});
