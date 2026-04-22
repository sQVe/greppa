import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { CommitEntry, FileEntry, SizeTier } from '@greppa/core';
import { Brand, Data, Effect, Layer, ServiceMap, Stream } from 'effect';
import { ChildProcess } from 'effect/unstable/process';
import type { ChildProcessSpawner } from 'effect/unstable/process/ChildProcessSpawner';

// Branded opaque type for resolved 40-char commit SHAs. Functions that require
// immutable cache keys should accept `Sha` so the compiler rejects branch
// names, HEAD, or short SHAs at the call site — the SHA-resolution step must
// happen once, at the CLI boundary, not scattered across consumers.
export type Sha = string & Brand.Brand<'Sha'>;

export interface RefsConfigValue {
  oldRef: Sha;
  newRef: Sha;
  mergeBaseRef: Sha;
}

type NameStatusEntry = Omit<FileEntry, 'sizeTier'>;

export const Sha = Brand.nominal<Sha>();

const SIZE_TIER_MEDIUM = 50;
const SIZE_TIER_LARGE = 500;

export const deriveSizeTier = (lineCount: number): SizeTier => {
  if (lineCount >= SIZE_TIER_LARGE) {
    return 'large';
  }
  if (lineCount >= SIZE_TIER_MEDIUM) {
    return 'medium';
  }
  return 'small';
};

export class GitError extends Data.TaggedError('GitError')<{
  message: string;
  cause?: unknown;
}> {}

export class ResolveRefError extends Data.TaggedError('ResolveRefError')<{
  message: string;
  cause?: unknown;
}> {}

export class DetectDefaultBranchError extends Data.TaggedError('DetectDefaultBranchError')<{
  message: string;
  cause?: unknown;
}> {}

export class MergeBaseError extends Data.TaggedError('MergeBaseError')<{
  message: string;
  cause?: unknown;
}> {}

export const RepoPath = ServiceMap.Reference('greppa/RepoPath', {
  defaultValue: () => process.cwd(),
});

export const RefsConfig = ServiceMap.Reference<RefsConfigValue>('greppa/RefsConfig', {
  defaultValue: () => {
    throw new Error('RefsConfig must be provided');
  },
});

const statusMap: Record<string, FileEntry['changeType']> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  T: 'modified',
  U: 'modified',
};

export const parseNameStatus = (output: string): NameStatusEntry[] =>
  output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap((line): NameStatusEntry[] => {
      const parts = line.split('\t');
      const status = parts[0] ?? '';

      if (status.startsWith('R') || status.startsWith('C')) {
        return [{ path: parts[2] ?? '', changeType: 'renamed', oldPath: parts[1] }];
      }

      const changeType = statusMap[status];
      if (changeType == null) {
        return [];
      }

      return [{ path: parts[1] ?? '', changeType }];
    });

const parseNumstatCount = (raw: string | undefined): number => {
  if (raw == null || raw === '-') {
    return 0;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

// git diff --numstat -z emits records terminated by NUL. Regular entries look
// like `added\tdeleted\tpath\0`. Renames are spread across three NUL-separated
// tokens: `added\tdeleted\t\0`, `oldpath\0`, `newpath\0`. Keying by the new
// path keeps the count aligned with the post-rename FileEntry.path.
export const parseNumstat = (output: string): Map<string, number> => {
  const result = new Map<string, number>();
  const tokens = output.split('\0');
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i] ?? '';
    if (token === '') {
      i += 1;
      continue;
    }
    const parts = token.split('\t');
    if (parts.length < 3) {
      i += 1;
      continue;
    }
    const count = parseNumstatCount(parts[0]) + parseNumstatCount(parts[1]);
    if (parts[2] === '') {
      const newPath = tokens[i + 2];
      if (newPath != null && newPath !== '') {
        result.set(newPath, count);
      } else {
        // A rename header (trailing tab) without a follow-up path token indicates
        // truncated or corrupt git output — surface it so a silently-miskeyed
        // cache entry doesn't become a debugging rabbit hole later.
        // oxlint-disable-next-line no-console -- pure parser; no logger plumbed in
        console.warn(`parseNumstat: malformed rename record, missing newPath token (added+deleted=${count})`);
      }
      i += 3;
      continue;
    }
    result.set(parts[2] ?? '', count);
    i += 1;
  }
  return result;
};

const COMMIT_FIELD_SEP = '\x1f';

export const parseCommitLog = (output: string): CommitEntry[] => {
  const commits: (CommitEntry & { files: string[] })[] = [];
  let current: (CommitEntry & { files: string[] }) | null = null;

  for (const line of output.split('\n')) {
    if (line === '') {
      continue;
    }
    const parts = line.split(COMMIT_FIELD_SEP);
    if (parts.length === 5) {
      current = {
        sha: parts[0] ?? '',
        abbrevSha: parts[1] ?? '',
        subject: parts[2] ?? '',
        author: parts[3] ?? '',
        date: parts[4] ?? '',
        files: [],
      };
      commits.push(current);
    } else if (parts.length === 1 && current != null) {
      current.files.push(line);
    } else {
      // Line has the separator but isn't a valid header — avoid attaching
      // subsequent file lines to the previous commit.
      current = null;
    }
  }
  return commits;
};

const collectString = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  Stream.runCollect(stream).pipe(
    Effect.map((chunks) => {
      const decoder = new TextDecoder();
      const parts = chunks.map((chunk) => decoder.decode(chunk, { stream: true }));
      parts.push(decoder.decode());
      return parts.join('');
    }),
  );

const validateRef = (ref: string): Effect.Effect<void, GitError> => {
  if (ref.startsWith('-')) {
    return Effect.fail(new GitError({ message: `Invalid ref: ${ref}` }));
  }
  return Effect.void;
};

const validatePath = (path: string): Effect.Effect<void, GitError> => {
  if (path === '' || path.startsWith('/') || path.split('/').includes('..')) {
    return Effect.fail(new GitError({ message: `Invalid path: ${path}` }));
  }
  return Effect.void;
};

const runGit = (
  args: string[],
): Effect.Effect<string, GitError, ChildProcessSpawner | typeof RepoPath> =>
  Effect.gen(function* () {
    const repoPath = yield* RepoPath;
    const cmd = ChildProcess.make('git', args, { cwd: repoPath });
    const handle = yield* cmd;
    const stdout = yield* collectString(handle.stdout);
    const stderr = yield* collectString(handle.stderr);
    const exitCode = yield* handle.exitCode;

    if (exitCode !== 0) {
      const trimmed = stderr.trim();
      return yield* new GitError({
        message: trimmed.length > 0 ? trimmed : `git exited with code ${exitCode}`,
      });
    }

    return stdout;
  }).pipe(
    Effect.scoped,
    Effect.mapError((error) =>
      error instanceof GitError
        ? error
        : new GitError({ message: error instanceof Error ? error.message : JSON.stringify(error), cause: error }),
    ),
  );

export class GitService extends ServiceMap.Service<
  GitService,
  {
    listFiles: (
      oldRef: string,
      newRef: string,
    ) => Effect.Effect<FileEntry[], GitError, ChildProcessSpawner | typeof RepoPath>;
    getFileContent: (
      ref: string,
      path: string,
    ) => Effect.Effect<string, GitError, ChildProcessSpawner | typeof RepoPath>;
    resolveRef: (
      ref: string,
    ) => Effect.Effect<Sha, ResolveRefError, ChildProcessSpawner | typeof RepoPath>;
    detectDefaultBranch: () => Effect.Effect<
      string,
      DetectDefaultBranchError,
      ChildProcessSpawner | typeof RepoPath
    >;
    mergeBase: (
      ref1: string,
      ref2: string,
    ) => Effect.Effect<Sha, MergeBaseError, ChildProcessSpawner | typeof RepoPath>;
    listWorkingTreeFiles: () => Effect.Effect<
      FileEntry[],
      GitError,
      ChildProcessSpawner | typeof RepoPath
    >;
    getWorkingTreeFileContent: (
      path: string,
    ) => Effect.Effect<string, GitError, typeof RepoPath>;
    listCommits: (
      oldRef: string,
      newRef: string,
    ) => Effect.Effect<CommitEntry[], GitError, ChildProcessSpawner | typeof RepoPath>;
  }
>()('greppa/GitService') {}

export const GitServiceLive = Layer.succeed(
  GitService,
  GitService.of({
    listFiles: (oldRef, newRef) =>
      Effect.all([validateRef(oldRef), validateRef(newRef)]).pipe(
        Effect.flatMap(() =>
          Effect.all([
            runGit(['diff', '--name-status', oldRef, newRef]).pipe(Effect.map(parseNameStatus)),
            runGit(['diff', '--numstat', '-z', oldRef, newRef]).pipe(Effect.map(parseNumstat)),
          ]),
        ),
        Effect.map(([nameStatus, numstat]) =>
          nameStatus.map((entry): FileEntry => {
            const lineCount = numstat.get(entry.path) ?? 0;
            return {
              ...entry,
              sizeTier: deriveSizeTier(lineCount),
            };
          }),
        ),
      ),
    getFileContent: (ref, path) =>
      Effect.all([validateRef(ref), validatePath(path)]).pipe(
        Effect.flatMap(() => runGit(['show', `${ref}:${path}`])),
      ),
    resolveRef: (ref) =>
      validateRef(ref).pipe(
        Effect.flatMap(() => runGit(['rev-parse', '--verify', `${ref}^{commit}`])),
        Effect.map((output) => Sha(output.trim())),
        Effect.mapError((error) => new ResolveRefError({ message: error.message, cause: error })),
      ),
    detectDefaultBranch: () => {
      const checkRefExists = (ref: string) =>
        runGit(['rev-parse', '--verify', ref]).pipe(Effect.map(() => ref));

      return runGit(['symbolic-ref', 'refs/remotes/origin/HEAD']).pipe(
        Effect.map((output) => `origin/${output.trim().replace('refs/remotes/origin/', '')}`),
        Effect.catch(() =>
          checkRefExists('origin/main').pipe(
            Effect.catch(() => checkRefExists('origin/master')),
            Effect.catch(() => checkRefExists('main')),
            Effect.catch(() => checkRefExists('master')),
          ),
        ),
        Effect.mapError((error) =>
          error instanceof DetectDefaultBranchError
            ? error
            : new DetectDefaultBranchError({ message: error.message, cause: error }),
        ),
      );
    },
    mergeBase: (ref1, ref2) =>
      Effect.all([validateRef(ref1), validateRef(ref2)]).pipe(
        Effect.flatMap(() => runGit(['merge-base', ref1, ref2])),
        Effect.map((output) => Sha(output.trim())),
        Effect.mapError((error) => new MergeBaseError({ message: error.message, cause: error })),
      ),
    listWorkingTreeFiles: () =>
      Effect.all([
        runGit(['diff', '--name-status', 'HEAD']).pipe(Effect.map(parseNameStatus)),
        runGit(['diff', '--numstat', '-z', 'HEAD']).pipe(Effect.map(parseNumstat)),
      ]).pipe(
        Effect.map(([nameStatus, numstat]) =>
          nameStatus.map((entry): FileEntry => {
            const lineCount = numstat.get(entry.path) ?? 0;
            return {
              ...entry,
              sizeTier: deriveSizeTier(lineCount),
            };
          }),
        ),
      ),
    getWorkingTreeFileContent: (path) =>
      validatePath(path).pipe(
        Effect.flatMap(() =>
          Effect.gen(function* () {
            const repoPath = yield* RepoPath;
            return yield* Effect.tryPromise({
              try: () => readFile(resolve(repoPath, path), 'utf-8'),
              catch: (error) =>
                new GitError({
                  message: error instanceof Error ? error.message : `Failed to read file: ${path}`,
                  cause: error,
                }),
            });
          }),
        ),
      ),
    listCommits: (oldRef, newRef) =>
      Effect.all([validateRef(oldRef), validateRef(newRef)]).pipe(
        Effect.flatMap(() =>
          runGit([
            'log',
            '--format=%H\x1f%h\x1f%s\x1f%an\x1f%aI',
            '--name-only',
            `${oldRef}..${newRef}`,
          ]),
        ),
        Effect.map(parseCommitLog),
      ),
  }),
);
