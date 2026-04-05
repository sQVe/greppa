import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { CommitEntry, FileEntry } from '@greppa/core';
import { Data, Effect, Layer, ServiceMap, Stream } from 'effect';
import { ChildProcess } from 'effect/unstable/process';
import type { ChildProcessSpawner } from 'effect/unstable/process/ChildProcessSpawner';

export class GitError extends Data.TaggedError('GitError')<{
  message: string;
}> {}

export class ResolveRefError extends Data.TaggedError('ResolveRefError')<{
  message: string;
}> {}

export class DetectDefaultBranchError extends Data.TaggedError('DetectDefaultBranchError')<{
  message: string;
}> {}

export class MergeBaseError extends Data.TaggedError('MergeBaseError')<{
  message: string;
}> {}

export interface RefsConfigValue {
  oldRef: string;
  newRef: string;
  mergeBaseRef: string;
}

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
};

export const parseNameStatus = (output: string): FileEntry[] =>
  output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap((line): FileEntry[] => {
      const parts = line.split('\t');
      const status = parts[0] ?? '';

      if (status.startsWith('R')) {
        return [{ path: parts[2] ?? '', changeType: 'renamed', oldPath: parts[1] }];
      }

      const changeType = statusMap[status];
      if (changeType == null) {
        return [];
      }

      return [{ path: parts[1] ?? '', changeType }];
    });

const COMMIT_FIELD_SEP = '\x1f';

export const parseCommitLog = (output: string): CommitEntry[] =>
  output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap((line): CommitEntry[] => {
      const parts = line.split(COMMIT_FIELD_SEP);
      if (parts.length !== 5) {
        return [];
      }
      return [
        {
          sha: parts[0] ?? '',
          abbrevSha: parts[1] ?? '',
          subject: parts[2] ?? '',
          author: parts[3] ?? '',
          date: parts[4] ?? '',
        },
      ];
    });

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
      return yield* new GitError({ message: stderr.trim() || `git exited with code ${exitCode}` });
    }

    return stdout;
  }).pipe(
    Effect.scoped,
    Effect.mapError((error) =>
      error instanceof GitError ? error : new GitError({ message: error instanceof Error ? error.message : JSON.stringify(error) }),
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
    ) => Effect.Effect<string, ResolveRefError, ChildProcessSpawner | typeof RepoPath>;
    detectDefaultBranch: () => Effect.Effect<
      string,
      DetectDefaultBranchError,
      ChildProcessSpawner | typeof RepoPath
    >;
    mergeBase: (
      ref1: string,
      ref2: string,
    ) => Effect.Effect<string, MergeBaseError, ChildProcessSpawner | typeof RepoPath>;
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
        Effect.flatMap(() => runGit(['diff', '--name-status', oldRef, newRef])),
        Effect.map(parseNameStatus),
      ),
    getFileContent: (ref, path) =>
      Effect.all([validateRef(ref), validatePath(path)]).pipe(
        Effect.flatMap(() => runGit(['show', `${ref}:${path}`])),
      ),
    resolveRef: (ref) =>
      validateRef(ref).pipe(
        Effect.flatMap(() => runGit(['rev-parse', '--verify', ref])),
        Effect.map(() => ref),
        Effect.mapError((error) => new ResolveRefError({ message: error.message })),
      ),
    detectDefaultBranch: () => {
      const checkRefExists = (ref: string, name: string) =>
        runGit(['rev-parse', '--verify', ref]).pipe(Effect.map(() => name));

      return runGit(['symbolic-ref', 'refs/remotes/origin/HEAD']).pipe(
        Effect.map((output) => output.trim().replace('refs/remotes/origin/', '')),
        Effect.catch(() =>
          checkRefExists('main', 'main').pipe(
            Effect.catch(() => checkRefExists('refs/remotes/origin/main', 'main')),
            Effect.catch(() => checkRefExists('master', 'master')),
            Effect.catch(() => checkRefExists('refs/remotes/origin/master', 'master')),
          ),
        ),
        Effect.mapError((error) =>
          error instanceof DetectDefaultBranchError
            ? error
            : new DetectDefaultBranchError({ message: error.message }),
        ),
      );
    },
    mergeBase: (ref1, ref2) =>
      Effect.all([validateRef(ref1), validateRef(ref2)]).pipe(
        Effect.flatMap(() => runGit(['merge-base', ref1, ref2])),
        Effect.map((output) => output.trim()),
        Effect.mapError((error) => new MergeBaseError({ message: error.message })),
      ),
    listWorkingTreeFiles: () =>
      runGit(['diff', '--name-status', 'HEAD']).pipe(Effect.map(parseNameStatus)),
    getWorkingTreeFileContent: (path) =>
      validatePath(path).pipe(
        Effect.flatMap(() =>
          Effect.gen(function* () {
            const repoPath = yield* RepoPath;
            return Effect.tryPromise({
              try: () => readFile(resolve(repoPath, path), 'utf-8'),
              catch: (error) =>
                new GitError({
                  message: error instanceof Error ? error.message : `Failed to read file: ${path}`,
                }),
            });
          }),
        ),
        Effect.flatten,
      ),
    listCommits: (oldRef, newRef) =>
      Effect.all([validateRef(oldRef), validateRef(newRef)]).pipe(
        Effect.flatMap(() =>
          runGit([
            'log',
            '--format=%H\x1f%h\x1f%s\x1f%an\x1f%aI',
            `${oldRef}..${newRef}`,
          ]),
        ),
        Effect.map(parseCommitLog),
      ),
  }),
);
