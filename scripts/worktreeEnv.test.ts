import { describe, expect, it } from 'vitest';

import { fnv1a, resolveWorktreePorts, buildEnvContent } from './worktreeEnv';

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
      expect(ports).toEqual({ apiPort: 4400, devPort: 5173 });
    });

    it('returns API port in range 3100-3999 for non-main names', () => {
      const { apiPort } = resolveWorktreePorts('feature-auth');
      expect(apiPort).toBeGreaterThanOrEqual(3100);
      expect(apiPort).toBeLessThanOrEqual(3999);
    });

    it('returns DEV port in range 5100-5999 for non-main names', () => {
      const { devPort } = resolveWorktreePorts('feature-auth');
      expect(devPort).toBeGreaterThanOrEqual(5100);
      expect(devPort).toBeLessThanOrEqual(5999);
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
    it('formats .env.local content with all port and path variables', () => {
      const content = buildEnvContent({
        apiPort: 3200,
        devPort: 5200,
        playgroundPort: 5201,
        dbPath: '/tmp/worktree/.data/app.db',
      });

      expect(content).toBe(
        [
          'API_PORT=3200',
          'DEV_PORT=5200',
          'PLAYGROUND_PORT=5201',
          'DB_PATH=/tmp/worktree/.data/app.db',
          '',
        ].join('\n'),
      );
    });
  });
});
