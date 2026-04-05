import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NodeHttpPlatform, NodeServices } from '@effect/platform-node';
import { Layer } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { layer as EtagLayer } from 'effect/unstable/http/Etag';
import * as HttpStaticServer from 'effect/unstable/http/HttpStaticServer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GitServiceLive, RefsConfig, RepoPath } from './GitService';
import { ApiRoutes } from './Http';

const monorepoRoot = process.cwd().replace(/\/packages\/server$/, '');

const resolveRef = (ref: string): string | null => {
  try {
    return execSync(`git rev-parse --verify ${ref}`, {
      cwd: monorepoRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

const parentSha = resolveRef('HEAD~1');
const headSha = resolveRef('HEAD');

const PlatformLayer = Layer.mergeAll(
  NodeServices.layer,
  NodeHttpPlatform.layer,
  EtagLayer,
  GitServiceLive,
  Layer.succeed(RepoPath, monorepoRoot),
  Layer.succeed(RefsConfig, { oldRef: 'main', newRef: 'HEAD', mergeBaseRef: parentSha ?? '' }),
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
    it('should return 200 with { status: ok }', async () => {
      const response = await handler(new Request('http://localhost/api/health'));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });
    });
  });

  describe.runIf(parentSha != null && headSha != null)('GET /api/files', () => {
    const oldRef = parentSha ?? '';
    const newRef = headSha ?? '';

    it('should return file list for valid refs', async () => {
      const response = await handler(
        new Request(`http://localhost/api/files?oldRef=${oldRef}&newRef=${newRef}`),
      );

      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      expect(Array.isArray(body)).toBe(true);
      const entries = body as Record<string, unknown>[];
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0]).toHaveProperty('path');
      expect(entries[0]).toHaveProperty('changeType');
    });

    it('should return 500 for invalid newRef', async () => {
      const response = await handler(
        new Request('http://localhost/api/files?oldRef=HEAD&newRef=invalid-xxx'),
      );

      expect(response.status).toBe(500);
    });
  });

  describe.runIf(parentSha != null && headSha != null)('GET /api/diff/:oldRef/:newRef/*path', () => {
    const oldRef = parentSha ?? '';
    const newRef = headSha ?? '';

    it('should return diff content for valid refs and path', async () => {
      const filesResponse = await handler(
        new Request(`http://localhost/api/files?oldRef=${oldRef}&newRef=${newRef}`),
      );
      const files = (await filesResponse.json()) as { path: string; changeType: string }[];
      const modified = files.find((fileEntry) => fileEntry.changeType === 'modified');
      if (modified == null) {
        return;
      }

      const response = await handler(
        new Request(`http://localhost/api/diff/${oldRef}/${newRef}/${modified.path}`),
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

    it('should return 500 for invalid newRef', async () => {
      const response = await handler(
        new Request('http://localhost/api/diff/HEAD/invalid-xxx/some-file.ts'),
      );

      expect(response.status).toBe(500);
    });
  });

  describe.runIf(parentSha != null && headSha != null)('GET /api/commits', () => {
    const oldRef = parentSha ?? '';
    const newRef = headSha ?? '';

    it('should return commit list for valid refs', async () => {
      const response = await handler(
        new Request(`http://localhost/api/commits?oldRef=${oldRef}&newRef=${newRef}`),
      );

      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      expect(Array.isArray(body)).toBe(true);
      const entries = body as Record<string, unknown>[];
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0]).toHaveProperty('sha');
      expect(entries[0]).toHaveProperty('abbrevSha');
      expect(entries[0]).toHaveProperty('subject');
      expect(entries[0]).toHaveProperty('author');
      expect(entries[0]).toHaveProperty('date');
    });

    it('should return 500 for invalid ref', async () => {
      const response = await handler(
        new Request('http://localhost/api/commits?oldRef=HEAD&newRef=invalid-xxx'),
      );

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/refs', () => {
    it('should return refs from config', async () => {
      const response = await handler(new Request('http://localhost/api/refs'));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ oldRef: 'main', newRef: 'HEAD', mergeBaseRef: parentSha ?? '' });
    });
  });

  describe('GET /api/worktree/files', () => {
    it('should return an array of file entries', async () => {
      const response = await handler(new Request('http://localhost/api/worktree/files'));

      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('GET /api/worktree/diff/*path', () => {
    it('should return 500 for file not in working tree', async () => {
      const response = await handler(
        new Request('http://localhost/api/worktree/diff/nonexistent-file.xyz'),
      );

      expect(response.status).toBe(500);
    });
  });

  describe('unknown routes', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await handler(new Request('http://localhost/api/unknown'));

      expect(response.status).toBe(404);
    });
  });
});

describe('static file serving', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'greppa-static-'));
  const indexContent = '<html><body>greppa</body></html>';

  beforeAll(() => {
    writeFileSync(join(tmpDir, 'index.html'), indexContent);
    mkdirSync(join(tmpDir, 'assets'), { recursive: true });
    writeFileSync(join(tmpDir, 'assets', 'app.js'), 'console.log("app")');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const StaticFiles = HttpStaticServer.layer({ root: tmpDir, spa: true });
  const StaticAppLayer = Layer.mergeAll(ApiRoutes, StaticFiles).pipe(Layer.provide(PlatformLayer));

  let staticHandler: (request: Request) => Promise<Response>;
  let staticDispose: () => Promise<void>;

  beforeAll(() => {
    const app = HttpRouter.toWebHandler(StaticAppLayer);
    staticHandler = app.handler as (request: Request) => Promise<Response>;
    staticDispose = app.dispose;
  });

  afterAll(async () => {
    await staticDispose();
  });

  it('should serve index.html at root', async () => {
    const response = await staticHandler(new Request('http://localhost/'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(indexContent);
  });

  it('should serve static assets', async () => {
    const response = await staticHandler(new Request('http://localhost/assets/app.js'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('console.log("app")');
  });

  it('should serve index.html for SPA fallback routes', async () => {
    const response = await staticHandler(
      new Request('http://localhost/file/some/path', {
        headers: { Accept: 'text/html' },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(indexContent);
  });

  it('should still serve API routes', async () => {
    const response = await staticHandler(new Request('http://localhost/api/health'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('should return 404 for unknown API routes with SPA fallback enabled', async () => {
    const response = await staticHandler(new Request('http://localhost/api/unknown'));

    expect(response.status).toBe(404);
  });
});
