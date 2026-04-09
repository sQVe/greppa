import { createServer } from 'node:http';

import { NodeHttpServer } from '@effect/platform-node';
import { Data, Effect, Layer } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import * as HttpStaticServer from 'effect/unstable/http/HttpStaticServer';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import type { FileEntry } from '@greppa/core';

import { Api } from './Api';
import { CacheService, CacheServiceLive, DEFAULT_DIFF_CACHE_CONFIG } from './CacheService';
import { GitError, GitService, GitServiceLive, RefsConfig } from './GitService';
import type { RefsConfigValue } from './GitService';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

interface DiffContent {
  oldContent: string;
  newContent: string;
}

interface StoredState {
  file: string[];
  wt: string[];
  commits: string[];
}

const createCache = <T>(ttlMs: number, maxEntries: number) => {
  const store = new Map<string, CacheEntry<T>>();

  const evictStale = () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.timestamp >= ttlMs) {
        store.delete(key);
      }
    }
  };

  return {
    get: (key: string): T | null => {
      const cached = store.get(key);
      if (cached != null && Date.now() - cached.timestamp < ttlMs) {
        return cached.value;
      }
      return null;
    },
    set: (key: string, value: T) => {
      if (store.size >= maxEntries) {
        evictStale();
      }
      if (store.size >= maxEntries) {
        store.clear();
      }
      store.set(key, { value, timestamp: Date.now() });
    },
  };
};

const fileListCache = createCache<FileEntry[]>(30_000, 50);

const worktreeDiffContentCache = createCache<DiffContent>(3_000, 100);

const HealthHandlers = HttpApiBuilder.group(Api, 'health', (handlers) =>
  Effect.succeed(handlers.handle('getHealth', () => Effect.succeed({ status: 'ok' as const }))),
);

const getFileList = (oldRef: string, newRef: string) =>
  Effect.gen(function* () {
    const cacheKey = `${oldRef}:${newRef}`;
    const cached = fileListCache.get(cacheKey);
    if (cached != null) {
      return cached;
    }
    const git = yield* GitService;
    const entries = yield* git.listFiles(oldRef, newRef);
    fileListCache.set(cacheKey, entries);
    return entries;
  });

const FilesHandlers = HttpApiBuilder.group(Api, 'files', (handlers) =>
  Effect.succeed(handlers.handle('getFiles', ({ query }) =>
    getFileList(query.oldRef, query.newRef),
  )),
);

const safeDecodeURIComponent = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new GitError({ message: `Invalid percent-encoded path: ${value}` });
  }
};

const extractFilePath = (url: string, oldRef: string, newRef: string) => {
  const parsed = new URL(url, 'http://localhost');
  const decoded = safeDecodeURIComponent(parsed.pathname);
  const prefix = `/api/diff/${oldRef}/${newRef}/`;
  return decoded.slice(prefix.length);
};

const DiffHandlers = HttpApiBuilder.group(Api, 'diff', (handlers) =>
  Effect.gen(function* () {
    const git = yield* GitService;
    const cache = yield* CacheService;

    const handleGetDiff = (params: { oldRef: string; newRef: string }, requestUrl: string) => {
      const { oldRef, newRef } = params;
      const filePath = extractFilePath(requestUrl, oldRef, newRef);

      if (filePath === '') {
        return Effect.fail(new GitError({ message: 'File path is required' }));
      }

      return Effect.gen(function* () {
        const entries = yield* getFileList(oldRef, newRef);
        const matchesPath = (entry: FileEntry) => entry.path === filePath;
        const entry = entries.find(matchesPath);
        if (entry == null) {
          return yield* Effect.fail(new GitError({ message: `File not found in diff: ${filePath}` }));
        }
        const changeType = entry.changeType;
        const contentKey = `${oldRef}:${newRef}:${filePath}`;
        // oxlint-disable-next-line no-unsafe-type-assertion -- CacheService is type-erased at rest; this call site owns the DiffContent contract for `contentKey`
        const cachedContent = (yield* cache.get(contentKey)) as DiffContent | null;

        if (cachedContent != null) {
          return { path: filePath, changeType, ...(entry.oldPath != null ? { oldPath: entry.oldPath } : {}), ...cachedContent };
        }

        const [oldContent, newContent] = yield* Effect.all([
          changeType === 'added' ? Effect.succeed('') : git.getFileContent(oldRef, entry.oldPath ?? filePath),
          changeType === 'deleted' ? Effect.succeed('') : git.getFileContent(newRef, filePath),
        ]);
        yield* cache.set(contentKey, { oldContent, newContent });

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

const CommitsHandlers = HttpApiBuilder.group(Api, 'commits', (handlers) =>
  Effect.gen(function* () {
    const git = yield* GitService;
    return handlers.handle('getCommits', ({ query }) =>
      git.listCommits(query.oldRef, query.newRef),
    );
  }),
);

const RefsHandlers = HttpApiBuilder.group(Api, 'refs', (handlers) =>
  Effect.gen(function* () {
    const refs = yield* RefsConfig;
    return handlers.handle('getRefs', () =>
      Effect.succeed({ oldRef: refs.oldRef, newRef: refs.newRef, mergeBaseRef: refs.mergeBaseRef }),
    );
  }),
);

const worktreeFileListCache = createCache<FileEntry[]>(3_000, 1);

const getWorktreeFileList = () =>
  Effect.gen(function* () {
    const cached = worktreeFileListCache.get('worktree');
    if (cached != null) {
      return cached;
    }
    const git = yield* GitService;
    const entries = yield* git.listWorkingTreeFiles();
    worktreeFileListCache.set('worktree', entries);
    return entries;
  });

const WorktreeFilesHandlers = HttpApiBuilder.group(Api, 'worktreeFiles', (handlers) =>
  Effect.succeed(handlers.handle('getWorktreeFiles', () => getWorktreeFileList())),
);

const extractWorktreeFilePath = (url: string) => {
  const parsed = new URL(url, 'http://localhost');
  const decoded = safeDecodeURIComponent(parsed.pathname);
  const prefix = '/api/worktree/diff/';
  return decoded.slice(prefix.length);
};

const handleGetWorktreeDiff = (filePath: string) =>
  Effect.gen(function* () {
    const git = yield* GitService;
    const entries = yield* getWorktreeFileList();
    const entry = entries.find((e) => e.path === filePath);
    if (entry == null) {
      return yield* Effect.fail(
        new GitError({ message: `File not found in working tree: ${filePath}` }),
      );
    }

    const contentKey = `worktree:${filePath}`;
    const cachedContent = worktreeDiffContentCache.get(contentKey);

    if (cachedContent != null) {
      return { path: filePath, changeType: entry.changeType, ...(entry.oldPath != null ? { oldPath: entry.oldPath } : {}), ...cachedContent };
    }

    const [oldContent, newContent] = yield* Effect.all([
      entry.changeType === 'added' ? Effect.succeed('') : git.getFileContent('HEAD', entry.oldPath ?? filePath),
      entry.changeType === 'deleted' ? Effect.succeed('') : git.getWorkingTreeFileContent(filePath),
    ]);
    worktreeDiffContentCache.set(contentKey, { oldContent, newContent });

    return {
      path: filePath,
      changeType: entry.changeType,
      ...(entry.oldPath != null ? { oldPath: entry.oldPath } : {}),
      oldContent,
      newContent,
    };
  });

const WorktreeDiffHandlers = HttpApiBuilder.group(Api, 'worktreeDiff', (handlers) =>
  Effect.succeed(handlers.handle('getWorktreeDiff', ({ request }) => {
    const filePath = extractWorktreeFilePath(request.url);

    if (filePath === '') {
      return Effect.fail(new GitError({ message: 'File path is required' }));
    }

    return handleGetWorktreeDiff(filePath);
  })),
);

class StateNotFoundError extends Data.TaggedError('StateNotFound')<{
  message: string;
}> {}

const STATE_MAX_ENTRIES = 10_000;
const stateStore = new Map<string, StoredState>();

const StateHandlers = HttpApiBuilder.group(Api, 'state', (handlers) =>
  Effect.succeed(
    handlers
      .handle('saveState', ({ payload }) => {
        if (stateStore.size >= STATE_MAX_ENTRIES) {
          const firstKey = stateStore.keys().next().value;
          if (firstKey != null) {
            stateStore.delete(firstKey);
          }
        }
        stateStore.set(payload.id, { file: [...payload.file], wt: [...payload.wt], commits: [...payload.commits] });
        return Effect.succeed({ id: payload.id });
      })
      .handle('getState', ({ params }) => {
        const state = stateStore.get(params.id);
        if (state == null) {
          return Effect.fail(new StateNotFoundError({ message: `State not found: ${params.id}` }));
        }
        return Effect.succeed(state);
      }),
  ),
);

export const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(HealthHandlers),
  Layer.provide(FilesHandlers),
  Layer.provide(DiffHandlers),
  Layer.provide(RefsHandlers),
  Layer.provide(CommitsHandlers),
  Layer.provide(WorktreeFilesHandlers),
  Layer.provide(WorktreeDiffHandlers),
  Layer.provide(StateHandlers),
);

export const makeHttpLayer = (port: number, refsConfig: RefsConfigValue, webDistPath: string) => {
  const StaticFiles = HttpStaticServer.layer({ root: webDistPath, spa: true });
  return HttpRouter.serve(Layer.mergeAll(ApiRoutes, StaticFiles)).pipe(
    Layer.provide(GitServiceLive),
    Layer.provide(CacheServiceLive(DEFAULT_DIFF_CACHE_CONFIG)),
    Layer.provide(Layer.succeed(RefsConfig, refsConfig)),
    Layer.provide(NodeHttpServer.layer(createServer, { port })),
  );
};
