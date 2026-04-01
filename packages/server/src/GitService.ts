import type { FileEntry } from '@greppa/core';
import { Data, Effect, Layer, ServiceMap, Stream } from 'effect';
import { ChildProcess } from 'effect/unstable/process';
import type { ChildProcessSpawner } from 'effect/unstable/process/ChildProcessSpawner';

export class GitError extends Data.TaggedError('GitError')<{
  message: string;
}> {}

export const RepoPath = ServiceMap.Reference('greppa/RepoPath', {
  defaultValue: () => process.cwd(),
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

const collectString = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  Stream.runCollect(stream).pipe(
    Effect.map((chunks) => {
      const decoder = new TextDecoder();
      return chunks.map((chunk) => decoder.decode(chunk)).join('');
    }),
  );

const validateRef = (ref: string): Effect.Effect<void, GitError> => {
  if (ref.startsWith('-')) {
    return Effect.fail(new GitError({ message: `Invalid ref: ${ref}` }));
  }
  return Effect.void;
};

const validatePath = (path: string): Effect.Effect<void, GitError> => {
  if (path === '' || path.startsWith('/') || path.includes('..')) {
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
  }),
);
