import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  GitService,
  GitServiceLive,
  MergeBaseError,
  parseCommitLog,
  parseNameStatus,
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

const runGitService = <A, E>(fn: (git: GitService['Type']) => Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    const git = yield* GitService;
    return yield* fn(git);
  }).pipe(Effect.provide(TestLayer), Effect.runPromise);

describe('GitService', () => {
  describe('parseNameStatus', () => {
    it('parses modified file', () => {
      expect(parseNameStatus('M\tsrc/index.ts')).toEqual([
        { path: 'src/index.ts', changeType: 'modified' },
      ]);
    });

    it('parses added file', () => {
      expect(parseNameStatus('A\tnew-file.ts')).toEqual([
        { path: 'new-file.ts', changeType: 'added' },
      ]);
    });

    it('parses deleted file', () => {
      expect(parseNameStatus('D\told-file.ts')).toEqual([
        { path: 'old-file.ts', changeType: 'deleted' },
      ]);
    });

    it('parses renamed file with similarity', () => {
      expect(parseNameStatus('R100\told.ts\tnew.ts')).toEqual([
        { path: 'new.ts', changeType: 'renamed', oldPath: 'old.ts' },
      ]);
    });

    it('parses multiple lines', () => {
      const output = 'M\ta.ts\nA\tb.ts\nD\tc.ts';

      expect(parseNameStatus(output)).toEqual([
        { path: 'a.ts', changeType: 'modified' },
        { path: 'b.ts', changeType: 'added' },
        { path: 'c.ts', changeType: 'deleted' },
      ]);
    });

    it('skips unknown status letters', () => {
      expect(parseNameStatus('C100\tsrc.ts\tdst.ts\nM\ta.ts')).toEqual([
        { path: 'a.ts', changeType: 'modified' },
      ]);
    });

    it('skips empty lines', () => {
      expect(parseNameStatus('M\ta.ts\n\nA\tb.ts\n')).toEqual([
        { path: 'a.ts', changeType: 'modified' },
        { path: 'b.ts', changeType: 'added' },
      ]);
    });
  });

  describe('parseCommitLog', () => {
    it('parses a single commit', () => {
      const output = 'abc123full\x1fabc123\x1ffix: some bug\x1fAlice\x1f2026-04-03T10:00:00+00:00';
      expect(parseCommitLog(output)).toEqual([
        {
          sha: 'abc123full',
          abbrevSha: 'abc123',
          subject: 'fix: some bug',
          author: 'Alice',
          date: '2026-04-03T10:00:00+00:00',
        },
      ]);
    });

    it('parses multiple commits', () => {
      const output = [
        'sha1\x1fab1\x1ffeat: first\x1fAlice\x1f2026-04-03T10:00:00+00:00',
        'sha2\x1fab2\x1ffix: second\x1fBob\x1f2026-04-02T09:00:00+00:00',
      ].join('\n');

      expect(parseCommitLog(output)).toEqual([
        { sha: 'sha1', abbrevSha: 'ab1', subject: 'feat: first', author: 'Alice', date: '2026-04-03T10:00:00+00:00' },
        { sha: 'sha2', abbrevSha: 'ab2', subject: 'fix: second', author: 'Bob', date: '2026-04-02T09:00:00+00:00' },
      ]);
    });

    it('skips empty lines', () => {
      const output = 'sha1\x1fab1\x1ffeat: first\x1fAlice\x1f2026-04-03T10:00:00+00:00\n\n';
      expect(parseCommitLog(output)).toHaveLength(1);
    });

    it('returns empty array for empty input', () => {
      expect(parseCommitLog('')).toEqual([]);
    });

    it('skips malformed lines with wrong field count', () => {
      const output = 'sha1\x1fab1\x1fincomplete';
      expect(parseCommitLog(output)).toEqual([]);
    });
  });

  describe.runIf(parentSha != null && headSha != null)('listFiles', () => {
    const oldRef = parentSha ?? '';
    const newRef = headSha ?? '';

    it('lists changed files between two refs', async () => {
      const result = await runGitService((git) => git.listFiles(oldRef, newRef));

      expect(result.length).toBeGreaterThan(0);
      for (const entry of result) {
        expect(['added', 'modified', 'deleted', 'renamed']).toContain(entry.changeType);
        expect(entry.path).toBeTruthy();
      }
    });

    it('fails with invalid ref', async () => {
      await expect(
        runGitService((git) => git.listFiles('invalid-ref-xxx', 'HEAD')),
      ).rejects.toThrow();
    });

    it('rejects refs starting with a dash', async () => {
      await expect(
        runGitService((git) => git.listFiles('--output=/tmp/pwned', 'HEAD')),
      ).rejects.toThrow('Invalid ref');
    });
  });

  describe('getFileContent', () => {
    it('returns content for valid ref and path', async () => {
      const result = await runGitService((git) =>
        git.getFileContent('HEAD', 'package.json'),
      );

      expect(result).toContain('"name"');
      expect(result.length).toBeGreaterThan(0);
    });

    it('fails with GitError for invalid ref', async () => {
      await expect(
        runGitService((git) => git.getFileContent('invalid-ref-xxx', 'package.json')),
      ).rejects.toThrow();
    });

    it('fails with GitError for non-existent path', async () => {
      await expect(
        runGitService((git) => git.getFileContent('HEAD', 'does-not-exist.xyz')),
      ).rejects.toThrow();
    });
  });

  describe('resolveRef', () => {
    it('succeeds for a valid branch name', async () => {
      const result = await runGitService((git) => git.resolveRef('HEAD'));

      expect(result).toBe('HEAD');
    });

    it('fails with ResolveRefError for nonexistent ref', async () => {
      // eslint-disable-next-line @typescript-eslint/await-thenable
      const result = await Effect.gen(function* () {
        const git = yield* GitService;
        return yield* git.resolveRef('nonexistent-ref-xyz');
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise);

      expect(result).toBeInstanceOf(ResolveRefError);
    });

    it('rejects refs starting with a dash', async () => {
      // eslint-disable-next-line @typescript-eslint/await-thenable
      const error = await Effect.gen(function* () {
        const git = yield* GitService;
        return yield* git.resolveRef('--output=/tmp/pwned');
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise);

      expect(error).toBeInstanceOf(ResolveRefError);
      expect(error.message).toContain('Invalid ref');
    });
  });

  describe.runIf(hasDefaultBranchRef)('detectDefaultBranch', () => {
    it('returns the default branch name', async () => {
      const result = await runGitService((git) => git.detectDefaultBranch());

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe.runIf(parentSha != null && headSha != null)('mergeBase', () => {
    it('returns the common ancestor SHA', async () => {
      const result = await runGitService((git) => git.mergeBase('HEAD~1', 'HEAD'));

      expect(result).toMatch(/^[0-9a-f]{40}$/);
    });

    it('fails with MergeBaseError for invalid refs', async () => {
      // eslint-disable-next-line @typescript-eslint/await-thenable
      const result = await Effect.gen(function* () {
        const git = yield* GitService;
        return yield* git.mergeBase('nonexistent-ref-aaa', 'nonexistent-ref-bbb');
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise);

      expect(result).toBeInstanceOf(MergeBaseError);
    });
  });

  describe('listWorkingTreeFiles', () => {
    it('returns an array of FileEntry', async () => {
      const result = await runGitService((git) => git.listWorkingTreeFiles());

      expect(Array.isArray(result)).toBe(true);
      for (const entry of result) {
        expect(['added', 'modified', 'deleted', 'renamed']).toContain(entry.changeType);
        expect(entry.path).toBeTruthy();
      }
    });
  });

  describe.runIf(parentSha != null && headSha != null)('listCommits', () => {
    it('returns commits between two refs', async () => {
      const result = await runGitService((git) => git.listCommits('HEAD~3', 'HEAD'));

      expect(result.length).toBeGreaterThan(0);
      for (const entry of result) {
        expect(entry.sha).toMatch(/^[0-9a-f]{40}$/);
        expect(entry.abbrevSha.length).toBeGreaterThan(0);
        expect(entry.subject.length).toBeGreaterThan(0);
        expect(entry.author.length).toBeGreaterThan(0);
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });

    it('returns empty array when refs are identical', async () => {
      const result = await runGitService((git) => git.listCommits('HEAD', 'HEAD'));
      expect(result).toEqual([]);
    });

    it('rejects refs starting with a dash', async () => {
      await expect(
        runGitService((git) => git.listCommits('--output=/tmp/pwned', 'HEAD')),
      ).rejects.toThrow('Invalid ref');
    });
  });

  describe('getWorkingTreeFileContent', () => {
    it('reads a known file from the working tree', async () => {
      const result = await runGitService((git) =>
        git.getWorkingTreeFileContent('package.json'),
      );

      const expected = readFileSync(`${monorepoRoot}/package.json`, 'utf-8');
      expect(result).toBe(expected);
    });

    it('fails for non-existent file', async () => {
      await expect(
        runGitService((git) => git.getWorkingTreeFileContent('does-not-exist.xyz')),
      ).rejects.toThrow();
    });

    it('rejects path traversal', async () => {
      await expect(
        runGitService((git) => git.getWorkingTreeFileContent('../etc/passwd')),
      ).rejects.toThrow('Invalid path');
    });

    it('rejects absolute paths', async () => {
      await expect(
        runGitService((git) => git.getWorkingTreeFileContent('/etc/passwd')),
      ).rejects.toThrow('Invalid path');
    });
  });
});
