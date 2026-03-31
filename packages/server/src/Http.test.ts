import { NodeHttpPlatform, NodeServices } from '@effect/platform-node';
import { Layer } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { layer as EtagLayer } from 'effect/unstable/http/Etag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GitServiceLive, RepoPath } from './GitService';
import { ApiRoutes } from './Http';

const monorepoRoot = process.cwd().replace(/\/packages\/server$/, '');

const PlatformLayer = Layer.mergeAll(
  NodeServices.layer,
  NodeHttpPlatform.layer,
  EtagLayer,
  GitServiceLive,
  Layer.succeed(RepoPath, monorepoRoot),
);

const TestAppLayer = ApiRoutes.pipe(Layer.provide(PlatformLayer));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: (...args: any[]) => Promise<Response>;
let dispose: () => Promise<void>;

beforeAll(() => {
  const app = HttpRouter.toWebHandler(TestAppLayer);
  handler = app.handler;
  dispose = app.dispose;
});

afterAll(async () => {
  await dispose();
});

describe('Http', () => {
  describe('GET /api/health', () => {
    it('returns 200 with { status: ok }', async () => {
      const response = await handler(new Request('http://localhost/api/health'));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });
    });
  });

  describe('GET /api/files', () => {
    it('returns file list for valid refs', async () => {
      const response = await handler(
        new Request('http://localhost/api/files?oldRef=HEAD~1&newRef=HEAD'),
      );

      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      expect(Array.isArray(body)).toBe(true);
      const entries = body as Record<string, unknown>[];
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0]).toHaveProperty('path');
      expect(entries[0]).toHaveProperty('changeType');
    });

    it('returns error for invalid refs', async () => {
      const response = await handler(
        new Request('http://localhost/api/files?oldRef=invalid-xxx&newRef=HEAD'),
      );

      expect(response.status).not.toBe(200);
    });
  });

  describe('unknown routes', () => {
    it('returns 404 for unknown routes', async () => {
      const response = await handler(new Request('http://localhost/api/unknown'));

      expect(response.status).toBe(404);
    });
  });
});
