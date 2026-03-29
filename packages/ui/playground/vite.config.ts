import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';
import type { Plugin } from 'vite-plus';

try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../.env.local'));
} catch {
  // .env.local may not exist yet — fall back to defaults
}

// oxlint-disable-next-line no-process-env
const playgroundPort = process.env['PLAYGROUND_PORT'] ?? '5174';
// oxlint-disable-next-line no-process-env
const caddyDomain = process.env['CADDY_DOMAIN'];

const caddyUrlPlugin = (): Plugin => ({
  name: 'greppa:caddy-url',
  configureServer(server) {
    const { printUrls } = server;
    server.printUrls = () => {
      printUrls();
      if (caddyDomain) {
        const colorUrl = `\x1b[36mhttps://playground.${caddyDomain}/\x1b[0m`;
        server.config.logger.info(`  \x1b[32m➜\x1b[0m  \x1b[1mCaddy:\x1b[0m   ${colorUrl}`);
      }
    };
  },
});

export default defineConfig({
  plugins: [react(), caddyUrlPlugin()],
  server: {
    port: Number(playgroundPort),
    strictPort: true,
  },
});
