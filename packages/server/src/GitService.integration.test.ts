import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import type { CommitEntry, FileEntry } from '@greppa/core';
import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  deriveSizeTier,
  GitService,
  GitServiceLive,
  MergeBaseError,
  parseCommitLog,
  parseNameStatus,
  parseNumstat,
  RepoPath,
  ResolveRefError,
} from './GitService';

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
const hasDefaultBranchRef =
  resolveRef('main') != null ||
  resolveRef('master') != null ||
  resolveRef('refs/remotes/origin/main') != null ||
  resolveRef('refs/remotes/origin/master') != null;

const TestLayer = Layer.mergeAll(
  GitServiceLive,
  Layer.succeed(RepoPath, monorepoRoot),
  NodeServices.layer,
);

type Git = InstanceType<typeof GitService>;

const runGitService = <A, E, R>(fn: (git: Git) => Effect.Effect<A, E, R>): Promise<A> =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const git = yield* GitService;
        return yield* fn(git);
      }),
      TestLayer,
    ) as Effect.Effect<A, E>,
  );

describe('GitService', () => {
  describe('parseNameStatus', () => {
    it('should parse modified file', () => {
      const result = parseNameStatus('M\tsrc/index.ts');

      expect(result).toEqual([
        { path: 'src/index.ts', changeType: 'modified' },
      ]);
    });

    it('should parse added file', () => {
      const result = parseNameStatus('A\tnew-file.ts');

      expect(result).toEqual([
        { path: 'new-file.ts', changeType: 'added' },
      ]);
    });

    it('should parse deleted file', () => {
      const result = parseNameStatus('D\told-file.ts');

      expect(result).toEqual([
        { path: 'old-file.ts', changeType: 'deleted' },
      ]);
    });

    it('should parse renamed file with similarity', () => {
      const result = parseNameStatus('R100\told.ts\tnew.ts');

      expect(result).toEqual([
        { path: 'new.ts', changeType: 'renamed', oldPath: 'old.ts' },
      ]);
    });

    it('should parse multiple lines', () => {
      const output = 'M\ta.ts\nA\tb.ts\nD\tc.ts';
      const result = parseNameStatus(output);

      expect(result).toEqual([
        { path: 'a.ts', changeType: 'modified' },
        { path: 'b.ts', changeType: 'added' },
        { path: 'c.ts', changeType: 'deleted' },
      ]);
    });

    it('should parse copied file with similarity', () => {
      const result = parseNameStatus('C100\told.ts\tnew.ts');

      expect(result).toEqual([
        { path: 'new.ts', changeType: 'renamed', oldPath: 'old.ts' },
      ]);
    });

    it('should parse type-change as modified', () => {
      const result = parseNameStatus('T\tpath/to/file');

      expect(result).toEqual([
        { path: 'path/to/file', changeType: 'modified' },
      ]);
    });

    it('should parse unmerged file as modified', () => {
      const result = parseNameStatus('U\tconflict.ts');

      expect(result).toEqual([
        { path: 'conflict.ts', changeType: 'modified' },
      ]);
    });

    it('should skip truly unknown status letters', () => {
      const result = parseNameStatus('Z\tfile.ts\nM\ta.ts');

      expect(result).toEqual([
        { path: 'a.ts', changeType: 'modified' },
      ]);
    });

    it('should skip empty lines', () => {
      const result = parseNameStatus('M\ta.ts\n\nA\tb.ts\n');

      expect(result).toEqual([
        { path: 'a.ts', changeType: 'modified' },
        { path: 'b.ts', changeType: 'added' },
      ]);
    });
  });

  describe('parseNumstat', () => {
    it('parses a numeric record into added+removed', () => {
      const result = parseNumstat('3\t2\tsrc/index.ts\0');

      expect(result.get('src/index.ts')).toBe(5);
    });

    it('parses multiple NUL-terminated records', () => {
      const result = parseNumstat('3\t2\ta.ts\x0010\t0\tb.ts\x000\t7\tc.ts\x00');

      expect(result.get('a.ts')).toBe(5);
      expect(result.get('b.ts')).toBe(10);
      expect(result.get('c.ts')).toBe(7);
      expect(result.size).toBe(3);
    });

    it('treats binary diff as zero lines', () => {
      const result = parseNumstat('-\t-\tassets/logo.png\0');

      expect(result.get('assets/logo.png')).toBe(0);
    });

    it('keys renamed files by the new path', () => {
      // git diff --numstat -z rename format: "added\tdeleted\t\0oldpath\0newpath\0"
      const result = parseNumstat('9\t39\t\0packages/old/file.css\0packages/new/file.css\0');

      expect(result.get('packages/new/file.css')).toBe(48);
      expect(result.size).toBe(1);
    });

    it('handles a rename followed by a regular entry', () => {
      const result = parseNumstat('2\t1\t\x00old/a.ts\x00new/a.ts\x0010\t0\tregular/b.ts\x00');

      expect(result.get('new/a.ts')).toBe(3);
      expect(result.get('regular/b.ts')).toBe(10);
      expect(result.size).toBe(2);
    });
  });

  describe('deriveSizeTier', () => {
    it('derives size tier from line count at 50/500 boundaries', () => {
      expect(deriveSizeTier(0)).toBe('small');
      expect(deriveSizeTier(49)).toBe('small');
      expect(deriveSizeTier(50)).toBe('medium');
      expect(deriveSizeTier(499)).toBe('medium');
      expect(deriveSizeTier(500)).toBe('large');
      expect(deriveSizeTier(9999)).toBe('large');
    });
  });

  describe('parseCommitLog', () => {
    it('should parse a single commit with no files', () => {
      const output = 'abc123full\x1fabc123\x1ffix: some bug\x1fAlice\x1f2026-04-03T10:00:00+00:00';
      expect(parseCommitLog(output)).toEqual([
        {
          sha: 'abc123full',
          abbrevSha: 'abc123',
          subject: 'fix: some bug',
          author: 'Alice',
          date: '2026-04-03T10:00:00+00:00',
          files: [],
        },
      ]);
    });

    it('should attach file list following a commit header', () => {
      const output = [
        'sha1\x1fab1\x1ffeat\x1fAlice\x1f2026-04-03T10:00:00+00:00',
        'src/a.ts',
        'src/b.ts',
      ].join('\n');

      expect(parseCommitLog(output)).toEqual([
        {
          sha: 'sha1',
          abbrevSha: 'ab1',
          subject: 'feat',
          author: 'Alice',
          date: '2026-04-03T10:00:00+00:00',
          files: ['src/a.ts', 'src/b.ts'],
        },
      ]);
    });

    it('should parse multiple commits separated by blank lines, each with its own files', () => {
      const output = [
        'sha1\x1fab1\x1ffeat: first\x1fAlice\x1f2026-04-03T10:00:00+00:00',
        'src/a.ts',
        '',
        'sha2\x1fab2\x1ffix: second\x1fBob\x1f2026-04-02T09:00:00+00:00',
        'src/b.ts',
        'src/c.ts',
      ].join('\n');

      expect(parseCommitLog(output)).toEqual([
        { sha: 'sha1', abbrevSha: 'ab1', subject: 'feat: first', author: 'Alice', date: '2026-04-03T10:00:00+00:00', files: ['src/a.ts'] },
        { sha: 'sha2', abbrevSha: 'ab2', subject: 'fix: second', author: 'Bob', date: '2026-04-02T09:00:00+00:00', files: ['src/b.ts', 'src/c.ts'] },
      ]);
    });

    it('should return empty array for empty input', () => {
      expect(parseCommitLog('')).toEqual([]);
    });

    it('should skip trailing blank lines', () => {
      const output = 'sha1\x1fab1\x1ffeat: first\x1fAlice\x1f2026-04-03T10:00:00+00:00\n\n';
      expect(parseCommitLog(output)).toEqual([
        { sha: 'sha1', abbrevSha: 'ab1', subject: 'feat: first', author: 'Alice', date: '2026-04-03T10:00:00+00:00', files: [] },
      ]);
    });

    it('should skip malformed header lines with wrong field count', () => {
      const output = 'sha1\x1fab1\x1fincomplete';
      expect(parseCommitLog(output)).toEqual([]);
    });
  });

  describe.runIf(parentSha != null && headSha != null)('listFiles', () => {
    const oldRef = parentSha ?? '';
    const newRef = headSha ?? '';

    it('should list changed files between two refs', async () => {
      const result = (await runGitService((git) => git.listFiles(oldRef, newRef))) as FileEntry[];

      expect(result.length).toBeGreaterThan(0);
      for (const entry of result) {
        expect(['added', 'modified', 'deleted', 'renamed']).toContain(entry.changeType);
        expect(entry.path).toBeTruthy();
      }
    });

    it('should carry valid sizeTier on every entry', async () => {
      const result = (await runGitService((git) => git.listFiles(oldRef, newRef))) as FileEntry[];

      expect(result.length).toBeGreaterThan(0);
      for (const entry of result) {
        expect(['small', 'medium', 'large']).toContain(entry.sizeTier);
      }
    });

    it('should fail with invalid ref', async () => {
      await expect(
        runGitService((git) => git.listFiles('invalid-ref-xxx', 'HEAD')),
      ).rejects.toThrow();
    });

    it('should reject refs starting with a dash', async () => {
      await expect(
        runGitService((git) => git.listFiles('--output=/tmp/pwned', 'HEAD')),
      ).rejects.toThrow('Invalid ref');
    });
  });

  describe('getFileContent', () => {
    it('should return content for valid ref and path', async () => {
      const result = (await runGitService((git) =>
        git.getFileContent('HEAD', 'package.json'),
      )) as string;

      expect(result).toContain('"name"');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should fail with GitError for invalid ref', async () => {
      await expect(
        runGitService((git) => git.getFileContent('invalid-ref-xxx', 'package.json')),
      ).rejects.toThrow();
    });

    it('should fail with GitError for non-existent path', async () => {
      await expect(
        runGitService((git) => git.getFileContent('HEAD', 'does-not-exist.xyz')),
      ).rejects.toThrow();
    });
  });

  describe('resolveRef', () => {
    it('returns the resolved 40-char SHA for a symbolic ref', async () => {
      const result = (await runGitService((git) => git.resolveRef('HEAD'))) as string;

      expect(result).toMatch(/^[0-9a-f]{40}$/);
    });

    it('returns the same SHA when called with that SHA directly', async () => {
      const sha = (await runGitService((git) => git.resolveRef('HEAD'))) as string;
      const second = (await runGitService((git) => git.resolveRef(sha))) as string;

      expect(second).toBe(sha);
    });

    it('expands an abbreviated SHA to the full 40-char form', async () => {
      const fullSha = (await runGitService((git) => git.resolveRef('HEAD'))) as string;
      const abbrev = fullSha.slice(0, 8);

      const resolved = (await runGitService((git) => git.resolveRef(abbrev))) as string;

      expect(resolved).toBe(fullSha);
      expect(resolved).toMatch(/^[0-9a-f]{40}$/);
    });

    it('should fail with ResolveRefError for nonexistent ref', async () => {
      const error = await runGitService((git) =>
        git.resolveRef('nonexistent-ref-xyz').pipe(Effect.flip),
      );

      expect(error).toBeInstanceOf(ResolveRefError);
    });

    it('should reject refs starting with a dash', async () => {
      const error = await runGitService((git) =>
        git.resolveRef('--output=/tmp/pwned').pipe(Effect.flip),
      );

      expect(error).toBeInstanceOf(ResolveRefError);
      if (error instanceof ResolveRefError) {
        expect(error.message).toContain('Invalid ref');
      }
    });
  });

  describe.runIf(hasDefaultBranchRef)('detectDefaultBranch', () => {
    it('should return the default branch name', async () => {
      const result = (await runGitService((git) => git.detectDefaultBranch())) as string;

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe.runIf(parentSha != null && headSha != null)('mergeBase', () => {
    it('should return the common ancestor SHA', async () => {
      const result = await runGitService((git) => git.mergeBase('HEAD~1', 'HEAD'));

      expect(result).toMatch(/^[0-9a-f]{40}$/);
    });

    it('should fail with MergeBaseError for invalid refs', async () => {
      const error = await runGitService((git) =>
        git.mergeBase('nonexistent-ref-aaa', 'nonexistent-ref-bbb').pipe(Effect.flip),
      );

      expect(error).toBeInstanceOf(MergeBaseError);
    });
  });

  describe('listWorkingTreeFiles', () => {
    it('should return an array of FileEntry', async () => {
      const result = (await runGitService((git) => git.listWorkingTreeFiles())) as FileEntry[];

      expect(Array.isArray(result)).toBe(true);
      for (const entry of result) {
        expect(['added', 'modified', 'deleted', 'renamed']).toContain(entry.changeType);
        expect(entry.path).toBeTruthy();
      }
    });

    it('should carry valid sizeTier on every entry', async () => {
      const result = (await runGitService((git) => git.listWorkingTreeFiles())) as FileEntry[];

      for (const entry of result) {
        expect(['small', 'medium', 'large']).toContain(entry.sizeTier);
      }
    });
  });

  describe.runIf(parentSha != null && headSha != null)('listCommits', () => {
    it('should return commits between two refs', async () => {
      const result = (await runGitService((git) => git.listCommits('HEAD~1', 'HEAD'))) as CommitEntry[];

      expect(result.length).toBeGreaterThan(0);
      for (const entry of result) {
        expect(entry.sha).toMatch(/^[0-9a-f]{40}$/);
        expect(entry.abbrevSha.length).toBeGreaterThan(0);
        expect(entry.subject.length).toBeGreaterThan(0);
        expect(entry.author.length).toBeGreaterThan(0);
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(Array.isArray(entry.files)).toBe(true);
      }
      expect(result.some((entry) => entry.files.length > 0)).toBe(true);
    });

    it('should return empty array when refs are identical', async () => {
      const result = await runGitService((git) => git.listCommits('HEAD', 'HEAD'));
      expect(result).toEqual([]);
    });

    it('should reject refs starting with a dash', async () => {
      await expect(
        runGitService((git) => git.listCommits('--output=/tmp/pwned', 'HEAD')),
      ).rejects.toThrow('Invalid ref');
    });
  });

  describe('getWorkingTreeFileContent', () => {
    it('should read a known file from the working tree', async () => {
      const result = await runGitService((git) =>
        git.getWorkingTreeFileContent('package.json'),
      );

      const expected = readFileSync(`${monorepoRoot}/package.json`, 'utf-8');
      expect(result).toBe(expected);
    });

    it('should fail for non-existent file', async () => {
      await expect(
        runGitService((git) => git.getWorkingTreeFileContent('does-not-exist.xyz')),
      ).rejects.toThrow();
    });

    it('should reject path traversal', async () => {
      await expect(
        runGitService((git) => git.getWorkingTreeFileContent('../etc/passwd')),
      ).rejects.toThrow('Invalid path');
    });

    it('should reject absolute paths', async () => {
      await expect(
        runGitService((git) => git.getWorkingTreeFileContent('/etc/passwd')),
      ).rejects.toThrow('Invalid path');
    });
  });
});
