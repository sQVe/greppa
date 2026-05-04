import { describe, expect, it } from 'vitest';

import type { FileNode } from '../fixtures/types';
import {
  collectChangeTypeCounts,
  collectExtensionCounts,
  collectStatusCounts,
} from './facetCounts';

const tree: FileNode[] = [
  {
    path: 'src',
    name: 'src',
    type: 'directory',
    children: [
      { path: 'src/index.ts', name: 'index.ts', type: 'file', changeType: 'modified' },
      { path: 'src/page.tsx', name: 'page.tsx', type: 'file', changeType: 'added' },
      {
        path: 'src/utils',
        name: 'utils',
        type: 'directory',
        children: [
          { path: 'src/utils/format.ts', name: 'format.ts', type: 'file', changeType: 'added' },
          { path: 'src/utils/parse.ts', name: 'parse.ts', type: 'file', changeType: 'deleted' },
        ],
      },
    ],
  },
  { path: 'README.md', name: 'README.md', type: 'file', changeType: 'modified' },
];

describe('collectExtensionCounts', () => {
  it('counts unique extensions across the tree, sorted by count desc then ext asc', () => {
    const counts = collectExtensionCounts(tree);

    expect(counts).toEqual([
      { extension: 'ts', count: 3 },
      { extension: 'md', count: 1 },
      { extension: 'tsx', count: 1 },
    ]);
  });

  it('lower-cases extensions when aggregating', () => {
    const mixed: FileNode[] = [
      { path: 'a.TS', name: 'a.TS', type: 'file' },
      { path: 'b.ts', name: 'b.ts', type: 'file' },
    ];

    expect(collectExtensionCounts(mixed)).toEqual([{ extension: 'ts', count: 2 }]);
  });

  it('skips files without an extension', () => {
    const nodes: FileNode[] = [
      { path: 'Makefile', name: 'Makefile', type: 'file' },
      { path: 'a.ts', name: 'a.ts', type: 'file' },
    ];

    expect(collectExtensionCounts(nodes)).toEqual([{ extension: 'ts', count: 1 }]);
  });
});

describe('collectChangeTypeCounts', () => {
  it('initializes every change type to zero and accumulates correctly', () => {
    const counts = collectChangeTypeCounts(tree);

    expect(counts).toEqual({ added: 2, modified: 2, deleted: 1, renamed: 0 });
  });

  it('ignores files without a changeType field', () => {
    const nodes: FileNode[] = [
      { path: 'a.ts', name: 'a.ts', type: 'file' },
      { path: 'b.ts', name: 'b.ts', type: 'file', changeType: 'added' },
    ];

    expect(collectChangeTypeCounts(nodes)).toEqual({
      added: 1,
      modified: 0,
      deleted: 0,
      renamed: 0,
    });
  });
});

describe('collectStatusCounts', () => {
  it('returns zero reviewed when reviewed-set is empty', () => {
    const counts = collectStatusCounts(tree, new Set());

    expect(counts).toEqual({ reviewed: 0, unreviewed: 5 });
  });

  it('counts reviewed vs unreviewed against the file set', () => {
    const counts = collectStatusCounts(tree, new Set(['src/index.ts', 'README.md']));

    expect(counts).toEqual({ reviewed: 2, unreviewed: 3 });
  });
});
