import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  fnv1a,
  resolveWorktreePorts,
  buildEnvContent,
  buildCaddySnippet,
  resolveCaddyDomain,
  writeCaddySnippet,
  writeCaddyfile,
  reloadCaddy,
} from './worktreeEnv';

describe('worktree-env', () => {
  describe('fnv1a', () => {
    it('returns a consistent 32-bit unsigned integer for a given string', () => {
      const hash = fnv1a('test');
      expect(hash).toBeTypeOf('number');
      expect(hash).toBe(fnv1a('test'));
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(2 ** 32);
    });

    it('produces different hashes for different strings', () => {
      expect(fnv1a('foo')).not.toBe(fnv1a('bar'));
    });

    it('matches known FNV-1a test vector', () => {
      // FNV-1a 32-bit hash of empty string is 0x811c9dc5 = 2166136261
      expect(fnv1a('')).toBe(2166136261);
    });
  });

  describe('resolveWorktreePorts', () => {
    it('returns API 4400 and DEV 5173 for "main"', () => {
      const ports = resolveWorktreePorts('main');
      expect(ports).toEqual({ apiPort: 4400, devPort: 5173, playgroundPort: 5174 });
    });

    it('returns API port in range 3100-3999 for non-main names', () => {
      const { apiPort } = resolveWorktreePorts('feature-auth');
      expect(apiPort).toBeGreaterThanOrEqual(3100);
      expect(apiPort).toBeLessThanOrEqual(3999);
    });

    it('returns non-overlapping DEV and PLAYGROUND port pair for non-main names', () => {
      const { devPort, playgroundPort } = resolveWorktreePorts('feature-auth');
      expect(devPort).toBeGreaterThanOrEqual(5100);
      expect(devPort).toBeLessThanOrEqual(5998);
      expect(devPort % 2).toBe(0);
      expect(playgroundPort).toBe(devPort + 1);
    });

    it('produces identical ports for the same name', () => {
      const first = resolveWorktreePorts('my-branch');
      const second = resolveWorktreePorts('my-branch');
      expect(first).toEqual(second);
    });

    it('produces different ports for different names', () => {
      const a = resolveWorktreePorts('branch-a');
      const b = resolveWorktreePorts('branch-b');
      expect(a.apiPort).not.toBe(b.apiPort);
    });
  });

  describe('buildEnvContent', () => {
    it('formats .env.local content with all port, path, and domain variables', () => {
      const content = buildEnvContent({
        apiPort: 3200,
        devPort: 5200,
        playgroundPort: 5201,
        dbPath: '/tmp/worktree/.data/app.db',
        caddyDomain: 'feat-auth.greppa.localhost',
      });

      expect(content).toBe(
        [
          'API_PORT=3200',
          'DEV_PORT=5200',
          'PLAYGROUND_PORT=5201',
          'DB_PATH=/tmp/worktree/.data/app.db',
          'CADDY_DOMAIN=feat-auth.greppa.localhost',
          '',
        ].join('\n'),
      );
    });
  });

  describe('writeCaddySnippet', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'caddy-test-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('writes snippet file to the given directory', () => {
      writeCaddySnippet({
        name: 'main',
        apiPort: 4400,
        devPort: 5173,
        playgroundPort: 5174,
        caddyDir: tempDir,
      });

      const snippetPath = join(tempDir, 'main.caddy');
      expect(existsSync(snippetPath)).toBe(true);
      expect(readFileSync(snippetPath, 'utf-8')).toContain('greppa.localhost');
    });

    it('creates the directory if it does not exist', () => {
      const nestedDir = join(tempDir, 'nested', 'dir');
      writeCaddySnippet({
        name: 'feat-auth',
        apiPort: 3200,
        devPort: 5200,
        playgroundPort: 5201,
        caddyDir: nestedDir,
      });

      expect(existsSync(join(nestedDir, 'feat-auth.caddy'))).toBe(true);
    });
  });

  describe('writeCaddyfile', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'caddy-test-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('creates Caddyfile with import glob', () => {
      writeCaddyfile(tempDir);

      const caddyfilePath = join(tempDir, 'Caddyfile');
      expect(readFileSync(caddyfilePath, 'utf-8')).toBe('import ./*.caddy\n');
    });

    it('does not overwrite existing Caddyfile', () => {
      const caddyfilePath = join(tempDir, 'Caddyfile');
      writeFileSync(caddyfilePath, 'custom content\n');

      writeCaddyfile(tempDir);

      expect(readFileSync(caddyfilePath, 'utf-8')).toBe('custom content\n');
    });
  });

  describe('reloadCaddy', () => {
    it('does not throw when caddy is not installed', () => {
      expect(() => {
        reloadCaddy('/nonexistent/path/Caddyfile');
      }).not.toThrow();
    });
  });

  describe('resolveCaddyDomain', () => {
    it('returns greppa.localhost for main worktree', () => {
      expect(resolveCaddyDomain('main')).toBe('greppa.localhost');
    });

    it('returns prefixed domain for non-main worktree', () => {
      expect(resolveCaddyDomain('feat-auth')).toBe('feat-auth.greppa.localhost');
    });
  });

  describe('buildCaddySnippet', () => {
    it('generates Caddy config for main worktree', () => {
      const snippet = buildCaddySnippet({
        name: 'main',
        apiPort: 4400,
        devPort: 5173,
        playgroundPort: 5174,
      });

      expect(snippet).toBe(
        [
          'greppa.localhost {',
          '  handle /api/* {',
          '    reverse_proxy localhost:4400',
          '  }',
          '  reverse_proxy localhost:5173',
          '}',
          '',
          'playground.greppa.localhost {',
          '  reverse_proxy localhost:5174',
          '}',
          '',
        ].join('\n'),
      );
    });

    it('generates Caddy config for non-main worktree', () => {
      const snippet = buildCaddySnippet({
        name: 'feat-auth',
        apiPort: 3200,
        devPort: 5200,
        playgroundPort: 5201,
      });

      expect(snippet).toBe(
        [
          'feat-auth.greppa.localhost {',
          '  handle /api/* {',
          '    reverse_proxy localhost:3200',
          '  }',
          '  reverse_proxy localhost:5200',
          '}',
          '',
          'playground.feat-auth.greppa.localhost {',
          '  reverse_proxy localhost:5201',
          '}',
          '',
        ].join('\n'),
      );
    });
  });
});
