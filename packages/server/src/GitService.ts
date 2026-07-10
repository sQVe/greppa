import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

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

export const parseNameStatus = (output: string): NameStatusEntry[] => {
  const entries: NameStatusEntry[] = [];
  const fields = output.split('\0');
  let i = 0;

  while (i < fields.length) {
    const status = fields[i++] ?? '';
    if (status === '') {
      continue;
    }
    const path = fields[i++] ?? '';

    if (status.startsWith('R') || status.startsWith('C')) {
      entries.push({ path: fields[i++] ?? '', changeType: 'renamed', oldPath: path });
      continue;
    }

    const changeType = statusMap[status];
    if (changeType != null) {
      entries.push({ path, changeType });
    }
  }

  return entries;
};

const parseNumstatCount = (raw: string | undefined): number | null => {
  if (raw === '-') {
    return null;
  }
  if (raw == null) {
    return 0;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

const combineNumstatCounts = (
  added: string | undefined,
  deleted: string | undefined,
): number | null => {
  const addedCount = parseNumstatCount(added);
  const deletedCount = parseNumstatCount(deleted);
  return addedCount === null || deletedCount === null ? null : addedCount + deletedCount;
};

const setRenameEntry = (
  result: Map<string, number | null>,
  newPath: string | undefined,
  count: number | null,
): void => {
  if (newPath != null && newPath !== '') {
    result.set(newPath, count);
    return;
  }
  // A rename header (trailing tab) without a follow-up path token indicates
  // truncated or corrupt git output — surface it so a silently-miskeyed
  // cache entry doesn't become a debugging rabbit hole later.
  // oxlint-disable-next-line no-console -- pure parser; no logger plumbed in
  console.warn(`parseNumstat: malformed rename record, missing newPath token (added+deleted=${count})`);
};

// git diff --numstat -z emits records terminated by NUL. Regular entries look
// like `added\tdeleted\tpath\0`. Renames are spread across three NUL-separated
// tokens: `added\tdeleted\t\0`, `oldpath\0`, `newpath\0`. Keying by the new
// path keeps the count aligned with the post-rename FileEntry.path.
export const parseNumstat = (output: string): Map<string, number | null> => {
  const result = new Map<string, number | null>();
  const tokens = output.split('\0');
  let i = 0;
  while (i < tokens.length) {
    const parts = (tokens[i] ?? '').split('\t');
    if (parts.length < 3) {
      i += 1;
      continue;
    }
    const count = combineNumstatCounts(parts[0], parts[1]);
    if (parts[2] === '') {
      setRenameEntry(result, tokens[i + 2], count);
      i += 3;
      continue;
    }
    result.set(parts[2] ?? '', count);
    i += 1;
  }
  return result;
};

const toFileEntry = (
  entry: NameStatusEntry,
  lineCount: number | null | undefined,
): FileEntry => ({
  ...entry,
  ...(lineCount === null ? { binary: true } : {}),
  sizeTier: deriveSizeTier(lineCount ?? 0),
});

const COMMIT_FIELD_SEP = '\x1f';

const parseCommitHeader = (parts: string[]): CommitEntry & { files: string[] } => ({
  sha: parts[0] ?? '',
  abbrevSha: parts[1] ?? '',
  subject: parts[2] ?? '',
  author: parts[3] ?? '',
  date: parts[4] ?? '',
  files: [],
});

export const parseCommitLog = (output: string): CommitEntry[] => {
  const commits: (CommitEntry & { files: string[] })[] = [];
  let current: (CommitEntry & { files: string[] }) | null = null;

  for (const line of output.split('\n')) {
    if (line === '') {
      continue;
    }
    const parts = line.split(COMMIT_FIELD_SEP);
    if (parts.length === 5) {
      current = parseCommitHeader(parts);
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
): Effect.Effect<string, GitError, ChildProcessSpawner> =>
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
    ) => Effect.Effect<FileEntry[], GitError, ChildProcessSpawner>;
    getFileContent: (
      ref: string,
      path: string,
    ) => Effect.Effect<string, GitError, ChildProcessSpawner>;
    resolveRef: (
      ref: string,
    ) => Effect.Effect<Sha, ResolveRefError, ChildProcessSpawner>;
    detectDefaultBranch: () => Effect.Effect<
      string,
      DetectDefaultBranchError,
      ChildProcessSpawner
    >;
    mergeBase: (
      ref1: string,
      ref2: string,
    ) => Effect.Effect<Sha, MergeBaseError, ChildProcessSpawner>;
    listWorkingTreeFiles: () => Effect.Effect<
      FileEntry[],
      GitError,
      ChildProcessSpawner
    >;
    getWorkingTreeFileContent: (
      path: string,
    ) => Effect.Effect<string, GitError>;
    listCommits: (
      oldRef: string,
      newRef: string,
    ) => Effect.Effect<CommitEntry[], GitError, ChildProcessSpawner>;
  }
>()('greppa/GitService') {}

export const GitServiceLive = Layer.succeed(
  GitService,
  GitService.of({
    listFiles: (oldRef, newRef) =>
      Effect.all([validateRef(oldRef), validateRef(newRef)]).pipe(
        Effect.flatMap(() =>
          Effect.all([
            runGit(['diff', '--name-status', '-z', oldRef, newRef]).pipe(Effect.map(parseNameStatus)),
            runGit(['diff', '--numstat', '-z', oldRef, newRef]).pipe(Effect.map(parseNumstat)),
          ]),
        ),
        Effect.map(([nameStatus, numstat]) =>
          nameStatus.map((entry) => toFileEntry(entry, numstat.get(entry.path))),
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
        runGit(['diff', '--name-status', '-z', 'HEAD']).pipe(Effect.map(parseNameStatus)),
        runGit(['diff', '--numstat', '-z', 'HEAD']).pipe(Effect.map(parseNumstat)),
        runGit(['ls-files', '--others', '--exclude-standard', '-z']).pipe(
          Effect.map((output) => output.split('\0').filter((path) => path !== '')),
        ),
      ]).pipe(
        Effect.map(([nameStatus, numstat, untracked]) =>
          [
            ...nameStatus,
            ...untracked.map(
              (path): NameStatusEntry => ({ path, changeType: 'added' }),
            ),
          ].map((entry) => toFileEntry(entry, numstat.get(entry.path))),
        ),
      ),
    getWorkingTreeFileContent: (path) =>
      validatePath(path).pipe(
        Effect.flatMap(() =>
          Effect.gen(function* () {
            const repoPath = resolve(yield* RepoPath);
            const filePath = resolve(repoPath, path);
            const relativePath = relative(repoPath, filePath);

            if (
              relativePath === '..' ||
              relativePath.startsWith(`..${sep}`) ||
              isAbsolute(relativePath)
            ) {
              return yield* new GitError({ message: `Path escapes repository: ${path}` });
            }

            return yield* Effect.tryPromise({
              try: async () => {
                const stats = await lstat(filePath);
                if (stats.isSymbolicLink()) {
                  throw new Error(`Refusing to read symbolic link: ${path}`);
                }
                return readFile(filePath, 'utf-8');
              },
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
