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

let handler: (request: Request) => Promise<Response>;
let dispose: () => Promise<void>;

beforeAll(() => {
  const app = HttpRouter.toWebHandler(TestAppLayer);
  // oxlint-disable-next-line no-unsafe-type-assertion -- context is baked into the layer; only Request is needed in tests
  handler = app.handler as (request: Request) => Promise<Response>;
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

    it('returns 500 for invalid refs', async () => {
      const response = await handler(
        new Request('http://localhost/api/files?oldRef=invalid-xxx&newRef=HEAD'),
      );

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/diff/:oldRef/:newRef/*path', () => {
    it('returns diff content for valid refs and path', async () => {
      const filesResponse = await handler(
        new Request('http://localhost/api/files?oldRef=HEAD~1&newRef=HEAD'),
      );
      const files = (await filesResponse.json()) as { path: string; changeType: string }[];
      const modified = files.find((f) => f.changeType === 'modified');
      if (modified == null) {
        expect.fail('Expected at least one modified file');
      }

      const response = await handler(
        new Request(`http://localhost/api/diff/HEAD~1/HEAD/${modified.path}`),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toHaveProperty('path', modified.path);
      expect(body).toHaveProperty('changeType');
      expect(body).toHaveProperty('oldContent');
      expect(body).toHaveProperty('newContent');
      expect(typeof body.oldContent).toBe('string');
      expect(typeof body.newContent).toBe('string');
      expect((body.oldContent as string).length).toBeGreaterThan(0);
      expect((body.newContent as string).length).toBeGreaterThan(0);
    });

    it('returns 500 for invalid refs', async () => {
      const response = await handler(
        new Request('http://localhost/api/diff/invalid-xxx/HEAD/some-file.ts'),
      );

      expect(response.status).toBe(500);
    });
  });

  describe('unknown routes', () => {
    it('returns 404 for unknown routes', async () => {
      const response = await handler(new Request('http://localhost/api/unknown'));

      expect(response.status).toBe(404);
    });
  });
});
