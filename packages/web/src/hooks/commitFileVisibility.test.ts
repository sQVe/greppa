import type { CommitEntry } from '@greppa/core';
import { describe, expect, it } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { computeCommitVisibility } from './commitFileVisibility';

const commits: CommitEntry[] = [
  {
    sha: 'aaa111',
    abbrevSha: 'aaa',
    subject: 'feat: a',
    author: 'Alice',
    date: '2026-04-03T10:00:00+00:00',
    files: ['src/a.ts', 'src/b.tsx'],
  },
  {
    sha: 'bbb222',
    abbrevSha: 'bbb',
    subject: 'fix: c',
    author: 'Bob',
    date: '2026-04-02T09:00:00+00:00',
    files: ['src/c.ts'],
  },
];

const lookup = new Map<string, FileNode>([
  ['src/a.ts', { path: 'src/a.ts', name: 'a.ts', type: 'file', changeType: 'modified' }],
  ['src/b.tsx', { path: 'src/b.tsx', name: 'b.tsx', type: 'file', changeType: 'added' }],
  ['src/c.ts', { path: 'src/c.ts', name: 'c.ts', type: 'file', changeType: 'modified' }],
]);

describe('computeCommitVisibility', () => {
  it('returns all files when no filter is active', () => {
    const result = computeCommitVisibility(
      commits,
      new Set(),
      { query: '', extensions: [], changeTypes: [], statuses: [] },
      lookup,
    );

    expect(result.totalVisible).toBe(3);
    expect(result.totalFiles).toBe(3);
    expect(result.visibleFilesBySha.get('aaa111')).toEqual(['src/a.ts', 'src/b.tsx']);
    expect(result.visibleFilesBySha.get('bbb222')).toEqual(['src/c.ts']);
  });

  it('narrows visible files by query', () => {
    const result = computeCommitVisibility(
      commits,
      new Set(),
      { query: 'a.ts', extensions: [], changeTypes: [], statuses: [] },
      lookup,
    );

    expect(result.totalVisible).toBe(1);
    expect(result.visibleFilesBySha.get('aaa111')).toEqual(['src/a.ts']);
    expect(result.visibleFilesBySha.get('bbb222')).toEqual([]);
  });

  it('uses per-commit reviewed sets for the status facet', () => {
    // src/a.ts is reviewed only in commit aaa111
    const reviewed = new Set(['aaa111:src/a.ts']);
    const result = computeCommitVisibility(
      commits,
      reviewed,
      { query: '', extensions: [], changeTypes: [], statuses: ['reviewed'] },
      lookup,
    );

    // Only aaa111:src/a.ts matches "reviewed" — bbb222's src/c.ts is not.
    expect(result.totalVisible).toBe(1);
    expect(result.visibleFilesBySha.get('aaa111')).toEqual(['src/a.ts']);
    expect(result.visibleFilesBySha.get('bbb222')).toEqual([]);
  });

  it('does not bleed reviewed status across commits for the same path', () => {
    const sharedCommits: CommitEntry[] = [
      {
        sha: 'aaa111',
        abbrevSha: 'aaa',
        subject: 'feat: a',
        author: 'Alice',
        date: '2026-04-03T10:00:00+00:00',
        files: ['src/shared.ts'],
      },
      {
        sha: 'bbb222',
        abbrevSha: 'bbb',
        subject: 'feat: b',
        author: 'Bob',
        date: '2026-04-02T09:00:00+00:00',
        files: ['src/shared.ts'],
      },
    ];
    const sharedLookup = new Map<string, FileNode>([
      ['src/shared.ts', { path: 'src/shared.ts', name: 'shared.ts', type: 'file' }],
    ]);
    const reviewed = new Set(['aaa111:src/shared.ts']);

    const result = computeCommitVisibility(
      sharedCommits,
      reviewed,
      { query: '', extensions: [], changeTypes: [], statuses: ['unreviewed'] },
      sharedLookup,
    );

    // shared.ts is reviewed in aaa111 but not in bbb222 → only bbb222 matches.
    expect(result.visibleFilesBySha.get('aaa111')).toEqual([]);
    expect(result.visibleFilesBySha.get('bbb222')).toEqual(['src/shared.ts']);
  });
});
