import { createServer } from 'node:http';

import { NodeHttpServer } from '@effect/platform-node';
import { Data, Effect, Layer, Stream } from 'effect';
import type { ServiceMap } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import * as HttpStaticServer from 'effect/unstable/http/HttpStaticServer';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import type { ChildProcessSpawner } from 'effect/unstable/process/ChildProcessSpawner';

import type { FileEntry } from '@greppa/core';

import { Api } from './Api';
import { CacheService, CacheServiceLive, DEFAULT_DIFF_CACHE_CONFIG } from './CacheService';
import { GitError, GitService, GitServiceLive, RefsConfig } from './GitService';
import type { RefsConfigValue, RepoPath } from './GitService';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

interface DiffContent {
  oldContent: string;
  newContent: string;
}

const isDiffContent = (value: unknown): value is DiffContent =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Partial<DiffContent>).oldContent === 'string' &&
  typeof (value as Partial<DiffContent>).newContent === 'string';

interface StoredState {
  file: string[];
  wt: string[];
  commits: string[];
}

// Mirrors CacheService's LRU-by-insertion-order semantics for caches that don't
// need Effect wrapping (REST-only, not shared with the SSE warm-up path). Keeping
// behavior aligned means a future consolidation is a mechanical rename.
const createCache = <T>(ttlMs: number, maxEntries: number) => {
  const store = new Map<string, CacheEntry<T>>();

  return {
    get: (key: string): T | null => {
      const entry = store.get(key);
      if (entry == null) {
        return null;
      }
      if (Date.now() - entry.timestamp >= ttlMs) {
        store.delete(key);
        return null;
      }
      store.delete(key);
      store.set(key, entry);
      return entry.value;
    },
    set: (key: string, value: T) => {
      store.delete(key);
      if (store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest != null) {
          store.delete(oldest);
        }
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

const computeDiffForEntry = (oldRef: string, newRef: string, entry: FileEntry) =>
  Effect.gen(function* () {
    const git = yield* GitService;
    const cache = yield* CacheService;

    const { path: filePath, changeType } = entry;
    const contentKey = `${oldRef}:${newRef}:${filePath}`;
    const cachedContent = yield* cache.get(contentKey);

    if (isDiffContent(cachedContent)) {
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

const computeDiff = (oldRef: string, newRef: string, filePath: string) =>
  Effect.gen(function* () {
    const entries = yield* getFileList(oldRef, newRef);
    const entry = entries.find((candidate) => candidate.path === filePath);
    if (entry == null) {
      return yield* Effect.fail(new GitError({ message: `File not found in diff: ${filePath}` }));
    }
    return yield* computeDiffForEntry(oldRef, newRef, entry);
  });

const DiffHandlers = HttpApiBuilder.group(Api, 'diff', (handlers) =>
  Effect.succeed(
    handlers.handle('getDiff', ({ params, request }) => {
      const { oldRef, newRef } = params;
      const filePath = extractFilePath(request.url, oldRef, newRef);
      if (filePath === '') {
        return Effect.fail(new GitError({ message: 'File path is required' }));
      }
      return computeDiff(oldRef, newRef, filePath);
    }),
  ),
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

const sseEncoder = new TextEncoder();

const encodeSseData = (payload: unknown): Uint8Array =>
  sseEncoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

const SSE_DONE_EVENT = sseEncoder.encode('event: done\ndata: {}\n\n');

const WARMUP_CONCURRENCY = 2;

type WarmupServices = GitService | CacheService | ChildProcessSpawner | typeof RepoPath;

const makeWarmupHandler = (services: ServiceMap.ServiceMap<WarmupServices>) =>
  Effect.gen(function* () {
    const params = yield* HttpRouter.params;
    const oldRef = params.oldRef ?? '';
    const newRef = params.newRef ?? '';
    if (oldRef === '' || newRef === '') {
      return yield* Effect.fail(new GitError({ message: 'oldRef and newRef are required' }));
    }
    const entries = yield* getFileList(oldRef, newRef).pipe(Effect.provideServices(services));
    const nonLarge = entries.filter((entry) => entry.sizeTier !== 'large');

    // A single bad file (binary, encoding error, missing blob) must not terminate the
    // stream — the browser would read a mid-stream close as a disconnect and reconnect,
    // re-running warm-up against the same bad file forever. Log the failure so a
    // partially-broken warm-up is debuggable rather than silent.
    const diffs = Stream.fromIterable(nonLarge).pipe(
      Stream.mapEffect(
        (entry) =>
          computeDiffForEntry(oldRef, newRef, entry).pipe(
            Effect.tapError((error) =>
              Effect.logWarning(`warm-up failed for ${entry.path}`, error),
            ),
            Effect.orElseSucceed(() => null),
          ),
        { concurrency: WARMUP_CONCURRENCY },
      ),
      Stream.filter((value) => value != null),
      Stream.map(encodeSseData),
    );

    // Terminal event lets the client explicitly close(); without it, EventSource treats
    // the normal response close as a disconnection and auto-reconnects indefinitely.
    const stream = Stream.concat(diffs, Stream.succeed(SSE_DONE_EVENT)).pipe(
      Stream.provideServices(services),
    );

    return HttpServerResponse.stream(stream, {
      contentType: 'text/event-stream',
      headers: { 'Cache-Control': 'no-cache' },
    });
  });

export const WarmupRoute = Layer.effectDiscard(
  Effect.gen(function* () {
    const router = yield* HttpRouter.HttpRouter;
    const services = yield* Effect.services<WarmupServices>();
    yield* router.add('GET', '/api/warmup/:oldRef/:newRef', makeWarmupHandler(services));
  }),
);

export const makeHttpLayer = (port: number, refsConfig: RefsConfigValue, webDistPath: string) => {
  const StaticFiles = HttpStaticServer.layer({ root: webDistPath, spa: true });
  return HttpRouter.serve(Layer.mergeAll(ApiRoutes, WarmupRoute, StaticFiles)).pipe(
    Layer.provide(GitServiceLive),
    Layer.provide(CacheServiceLive(DEFAULT_DIFF_CACHE_CONFIG)),
    Layer.provide(Layer.succeed(RefsConfig, refsConfig)),
    Layer.provide(NodeHttpServer.layer(createServer, { port })),
  );
};
