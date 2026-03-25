import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Layer } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { layer as EtagLayer } from 'effect/unstable/http/Etag';
import { NodeHttpPlatform, NodeServices } from '@effect/platform-node';
import { ApiRoutes } from './Http';

const PlatformLayer = Layer.mergeAll(NodeServices.layer, NodeHttpPlatform.layer, EtagLayer);

const TestAppLayer = ApiRoutes.pipe(Layer.provide(PlatformLayer));

let handler: (request: Request) => Promise<Response>;
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

  describe('unknown routes', () => {
    it('returns 404 for unknown routes', async () => {
      const response = await handler(new Request('http://localhost/api/unknown'));

      expect(response.status).toBe(404);
    });
  });
});
