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
    .map((line): FileEntry => {
      const parts = line.split('\t');
      const status = parts[0] ?? '';

      if (status.startsWith('R')) {
        return { path: parts[2] ?? '', changeType: 'renamed', oldPath: parts[1] };
      }

      const changeType = statusMap[status];
      if (changeType == null) {
        throw new Error(`Unknown git status: ${status}`);
      }

      return { path: parts[1] ?? '', changeType };
    });

const collectString = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  Stream.runCollect(stream).pipe(
    Effect.map((chunks) => {
      const decoder = new TextDecoder();
      return chunks.map((c) => decoder.decode(c)).join('');
    }),
  );

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
    Effect.mapError((e) =>
      e instanceof GitError ? e : new GitError({ message: e instanceof Error ? e.message : JSON.stringify(e) }),
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
      runGit(['diff', '--name-status', oldRef, newRef]).pipe(Effect.map(parseNameStatus)),
    getFileContent: (ref, path) => runGit(['show', `${ref}:${path}`]),
  }),
);
