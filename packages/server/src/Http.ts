import { createServer } from 'node:http';

import { NodeHttpServer } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import type { FileEntry } from '@greppa/core';

import { Api } from './Api';
import { GitError, GitService } from './GitService';

const fileListCache = new Map<string, { entries: FileEntry[]; timestamp: number }>();
const CACHE_TTL_MS = 30_000;

const getCachedFileList = (key: string) => {
  const cached = fileListCache.get(key);
  if (cached != null && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.entries;
  }
  return null;
};

const HealthHandlers = HttpApiBuilder.group(Api, 'health', (handlers) =>
  Effect.succeed(handlers.handle('getHealth', () => Effect.succeed({ status: 'ok' as const }))),
);

const FilesHandlers = HttpApiBuilder.group(Api, 'files', (handlers) =>
  Effect.gen(function* () {
    const git = yield* GitService;
    return handlers.handle('getFiles', ({ query }) =>
      git.listFiles(query.oldRef, query.newRef),
    );
  }),
);

const extractFilePath = (url: string, oldRef: string, newRef: string) => {
  const parsed = new URL(url, 'http://localhost');
  const prefix = `/api/diff/${oldRef}/${newRef}/`;
  return decodeURIComponent(parsed.pathname.slice(prefix.length));
};

const DiffHandlers = HttpApiBuilder.group(Api, 'diff', (handlers) =>
  Effect.gen(function* () {
    const git = yield* GitService;

    const handleGetDiff = (params: { oldRef: string; newRef: string }, requestUrl: string) => {
      const { oldRef, newRef } = params;
      const filePath = extractFilePath(requestUrl, oldRef, newRef);

      if (filePath === '') {
        return Effect.fail(new GitError({ message: 'File path is required' }));
      }

      return Effect.gen(function* () {
        const cacheKey = `${oldRef}:${newRef}`;
        const cached = getCachedFileList(cacheKey);
        const entries = cached ?? (yield* git.listFiles(oldRef, newRef));
        if (cached == null) {
          fileListCache.set(cacheKey, { entries, timestamp: Date.now() });
        }
        const entry = entries.find((e) => e.path === filePath);
        if (entry == null) {
          return yield* Effect.fail(new GitError({ message: `File not found in diff: ${filePath}` }));
        }
        const changeType = entry.changeType;

        const oldContent =
          changeType === 'added' ? '' : yield* git.getFileContent(oldRef, entry.oldPath ?? filePath);
        const newContent =
          changeType === 'deleted' ? '' : yield* git.getFileContent(newRef, filePath);

        return {
          path: filePath,
          changeType,
          ...(entry.oldPath != null ? { oldPath: entry.oldPath } : {}),
          oldContent,
          newContent,
        };
      });
    };

    return handlers.handle('getDiff', ({ params, request }) =>
      handleGetDiff(params, request.url),
    );
  }),
);

export const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(HealthHandlers),
  Layer.provide(FilesHandlers),
  Layer.provide(DiffHandlers),
);

export const makeHttpLayer = (port: number) =>
  HttpRouter.serve(ApiRoutes).pipe(Layer.provide(NodeHttpServer.layer(createServer, { port })));
