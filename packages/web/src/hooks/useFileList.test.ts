import { describe, expect, it } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { buildFileTree, compactTree, propagateChangeType, sortPathsTreeOrder } from './useFileList';

describe('buildFileTree', () => {
  it('builds nested tree from flat entries', () => {
    const entries = [
      { path: 'src/index.ts', changeType: 'modified' as const, sizeTier: 'small' as const },
      { path: 'src/utils/helpers.ts', changeType: 'added' as const, sizeTier: 'small' as const },
    ];

    const tree = buildFileTree(entries);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.name).toBe('src');
    expect(tree[0]?.type).toBe('directory');
    expect(tree[0]?.children).toHaveLength(2);
  });

  it('assigns changeType to file nodes', () => {
    const entries = [
      { path: 'README.md', changeType: 'added' as const, sizeTier: 'small' as const },
    ];

    const tree = buildFileTree(entries);

    expect(tree[0]?.changeType).toBe('added');
    expect(tree[0]?.type).toBe('file');
  });

  it('handles renamed files with oldPath', () => {
    const entries = [
      {
        path: 'new/location.ts',
        changeType: 'renamed' as const,
        oldPath: 'old/location.ts',
        sizeTier: 'small' as const,
      },
    ];

    const tree = buildFileTree(entries);

    const file = tree[0]?.children?.[0];
    expect(file?.changeType).toBe('renamed');
    expect(file?.oldPath).toBe('old/location.ts');
  });

  it('sets correct path on nested nodes', () => {
    const entries = [
      { path: 'a/b/c.ts', changeType: 'modified' as const, sizeTier: 'small' as const },
    ];

    const tree = buildFileTree(entries);

    expect(tree[0]?.path).toBe('a/b');
    expect(tree[0]?.displayName).toBe('a/b');
    expect(tree[0]?.children?.[0]?.path).toBe('a/b/c.ts');
  });

  it('groups files under same directory', () => {
    const entries = [
      { path: 'src/a.ts', changeType: 'modified' as const, sizeTier: 'small' as const },
      { path: 'src/b.ts', changeType: 'added' as const, sizeTier: 'small' as const },
    ];

    const tree = buildFileTree(entries);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.children).toHaveLength(2);
  });

  it('sorts directories before files', () => {
    const entries = [
      { path: 'src/z.ts', changeType: 'modified' as const, sizeTier: 'small' as const },
      { path: 'src/a/b.ts', changeType: 'added' as const, sizeTier: 'small' as const },
    ];

    const tree = buildFileTree(entries);
    const children = tree[0]?.children ?? [];

    expect(children[0]?.type).toBe('directory');
    expect(children[1]?.type).toBe('file');
  });

  it('propagates sizeTier onto file nodes', () => {
    const entries = [
      { path: 'src/index.ts', changeType: 'modified' as const, sizeTier: 'small' as const },
      { path: 'src/large.ts', changeType: 'added' as const, sizeTier: 'large' as const },
    ];

    const tree = buildFileTree(entries);
    const [fileA, fileB] = tree[0]?.children ?? [];

    expect(fileA).toHaveProperty('sizeTier', 'small');
    expect(fileB).toHaveProperty('sizeTier', 'large');
  });
});

describe('propagateChangeType', () => {
  it('sets changeType on parent from single child', () => {
    const nodes: FileNode[] = [
      {
        path: 'src',
        name: 'src',
        type: 'directory',
        children: [{ path: 'src/index.ts', name: 'index.ts', type: 'file', changeType: 'added' }],
      },
    ];

    const result = propagateChangeType(nodes);

    expect(result[0]?.changeType).toBe('added');
  });

  it('picks highest-priority changeType among descendants', () => {
    const nodes: FileNode[] = [
      {
        path: 'src',
        name: 'src',
        type: 'directory',
        children: [
          { path: 'src/a.ts', name: 'a.ts', type: 'file', changeType: 'renamed' },
          { path: 'src/b.ts', name: 'b.ts', type: 'file', changeType: 'deleted' },
          { path: 'src/c.ts', name: 'c.ts', type: 'file', changeType: 'modified' },
        ],
      },
    ];

    const result = propagateChangeType(nodes);

    expect(result[0]?.changeType).toBe('deleted');
  });

  it('propagates through nested directories', () => {
    const nodes: FileNode[] = [
      {
        path: 'src',
        name: 'src',
        type: 'directory',
        children: [
          {
            path: 'src/utils',
            name: 'utils',
            type: 'directory',
            children: [
              { path: 'src/utils/helper.ts', name: 'helper.ts', type: 'file', changeType: 'added' },
            ],
          },
        ],
      },
    ];

    const result = propagateChangeType(nodes);

    expect(result[0]?.changeType).toBe('added');
    expect(result[0]?.children?.[0]?.changeType).toBe('added');
  });

  it('does not set changeType on directories with no changed descendants', () => {
    const nodes: FileNode[] = [
      {
        path: 'src',
        name: 'src',
        type: 'directory',
        children: [{ path: 'src/index.ts', name: 'index.ts', type: 'file' }],
      },
    ];

    const result = propagateChangeType(nodes);

    expect(result).toHaveLength(1);
    expect(result[0]?.changeType).toBeUndefined();
  });

  it('does not overwrite file changeType', () => {
    const nodes: FileNode[] = [
      { path: 'README.md', name: 'README.md', type: 'file', changeType: 'modified' },
    ];

    const result = propagateChangeType(nodes);

    expect(result[0]?.changeType).toBe('modified');
  });
});

describe('compactTree', () => {
  it('merges single-child directory chains', () => {
    const nodes: FileNode[] = [
      {
        path: 'src',
        name: 'src',
        type: 'directory',
        children: [
          {
            path: 'src/events',
            name: 'events',
            type: 'directory',
            children: [{ path: 'src/events/handler.ts', name: 'handler.ts', type: 'file' }],
          },
        ],
      },
    ];

    const result = compactTree(nodes);

    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe('src/events');
    expect(result[0]?.displayName).toBe('src/events');
    expect(result[0]?.children).toHaveLength(1);
    expect(result[0]?.children?.[0]?.name).toBe('handler.ts');
  });

  it('preserves multi-child directories', () => {
    const nodes: FileNode[] = [
      {
        path: 'src',
        name: 'src',
        type: 'directory',
        children: [
          { path: 'src/a.ts', name: 'a.ts', type: 'file' },
          { path: 'src/b.ts', name: 'b.ts', type: 'file' },
        ],
      },
    ];

    const result = compactTree(nodes);

    expect(result[0]?.path).toBe('src');
    expect(result[0]?.displayName).toBeUndefined();
    expect(result[0]?.children).toHaveLength(2);
  });

  it('merges chains of three or more directories', () => {
    const nodes: FileNode[] = [
      {
        path: 'a',
        name: 'a',
        type: 'directory',
        children: [
          {
            path: 'a/b',
            name: 'b',
            type: 'directory',
            children: [
              {
                path: 'a/b/c',
                name: 'c',
                type: 'directory',
                children: [{ path: 'a/b/c/file.ts', name: 'file.ts', type: 'file' }],
              },
            ],
          },
        ],
      },
    ];

    const result = compactTree(nodes);

    expect(result[0]?.path).toBe('a/b/c');
    expect(result[0]?.displayName).toBe('a/b/c');
    expect(result[0]?.children).toHaveLength(1);
    expect(result[0]?.children?.[0]?.name).toBe('file.ts');
  });

  it('does not merge directory with single file child', () => {
    const nodes: FileNode[] = [
      {
        path: 'src',
        name: 'src',
        type: 'directory',
        children: [{ path: 'src/index.ts', name: 'index.ts', type: 'file' }],
      },
    ];

    const result = compactTree(nodes);

    expect(result[0]?.path).toBe('src');
    expect(result[0]?.displayName).toBeUndefined();
  });

  it('preserves changeType from deepest merged directory', () => {
    const nodes: FileNode[] = [
      {
        path: 'src',
        name: 'src',
        type: 'directory',
        changeType: 'modified',
        children: [
          {
            path: 'src/utils',
            name: 'utils',
            type: 'directory',
            changeType: 'added',
            children: [
              { path: 'src/utils/helper.ts', name: 'helper.ts', type: 'file', changeType: 'added' },
            ],
          },
        ],
      },
    ];

    const result = compactTree(nodes);

    expect(result[0]?.changeType).toBe('added');
  });
});

describe('sortPathsTreeOrder', () => {
  it('returns an empty array for empty input', () => {
    expect(sortPathsTreeOrder([])).toEqual([]);
  });

  it('groups directories before top-level files', () => {
    const result = sortPathsTreeOrder(['beads.jsonl', 'packages/web/src/App.tsx']);

    expect(result).toEqual(['packages/web/src/App.tsx', 'beads.jsonl']);
  });

  it('orders sibling directories alphabetically', () => {
    const result = sortPathsTreeOrder([
      'src/components/StackedDiffViewer/FileHeader.tsx',
      'src/components/CommitList/CommitList.tsx',
      'src/components/FileTree/FileTree.tsx',
    ]);

    expect(result).toEqual([
      'src/components/CommitList/CommitList.tsx',
      'src/components/FileTree/FileTree.tsx',
      'src/components/StackedDiffViewer/FileHeader.tsx',
    ]);
  });

  it('places files inside a directory before sibling files at the same level', () => {
    const result = sortPathsTreeOrder(['src/z.ts', 'src/a/b.ts']);

    expect(result).toEqual(['src/a/b.ts', 'src/z.ts']);
  });

  it('reorders git-log emit order into tree-DFS layout', () => {
    const gitLogOrder = [
      'beads.jsonl',
      'packages/web/src/App.tsx',
      'packages/web/src/components/CommitList/CommitList.tsx',
      'packages/web/src/components/FileTree/FileTree.tsx',
      'packages/web/src/fixtures/types.ts',
      'packages/web/src/hooks/useReviewState.ts',
    ];

    const result = sortPathsTreeOrder(gitLogOrder);

    expect(result).toEqual([
      'packages/web/src/components/CommitList/CommitList.tsx',
      'packages/web/src/components/FileTree/FileTree.tsx',
      'packages/web/src/fixtures/types.ts',
      'packages/web/src/hooks/useReviewState.ts',
      'packages/web/src/App.tsx',
      'beads.jsonl',
    ]);
  });
});
