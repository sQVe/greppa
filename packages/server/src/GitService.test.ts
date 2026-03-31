import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import { GitService, GitServiceLive, parseNameStatus, RepoPath } from './GitService';

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

  it('skips empty lines', () => {
    expect(parseNameStatus('M\ta.ts\n\nA\tb.ts\n')).toEqual([
      { path: 'a.ts', changeType: 'modified' },
      { path: 'b.ts', changeType: 'added' },
    ]);
  });
});

const monorepoRoot = process.cwd().replace(/\/packages\/server$/, '');

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
  it('lists changed files between two refs', async () => {
    const result = await runGitService((git) => git.listFiles('HEAD~1', 'HEAD'));

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
});

describe('GitService.getFileContent', () => {
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
