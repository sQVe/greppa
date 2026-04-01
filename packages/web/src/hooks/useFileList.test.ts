import { describe, expect, it } from 'vitest';

import { buildFileTree } from './useFileList';

describe('buildFileTree', () => {
  it('builds nested tree from flat entries', () => {
    const entries = [
      { path: 'src/index.ts', changeType: 'modified' as const },
      { path: 'src/utils/helpers.ts', changeType: 'added' as const },
    ];

    const tree = buildFileTree(entries);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('src');
    expect(tree[0].type).toBe('directory');
    expect(tree[0].children).toHaveLength(2);
  });

  it('assigns changeType to file nodes', () => {
    const entries = [{ path: 'README.md', changeType: 'added' as const }];

    const tree = buildFileTree(entries);

    expect(tree[0].changeType).toBe('added');
    expect(tree[0].type).toBe('file');
  });

  it('handles renamed files with oldPath', () => {
    const entries = [
      { path: 'new/location.ts', changeType: 'renamed' as const, oldPath: 'old/location.ts' },
    ];

    const tree = buildFileTree(entries);

    const file = tree[0].children?.[0];
    expect(file?.changeType).toBe('renamed');
    expect(file?.oldPath).toBe('old/location.ts');
  });

  it('sets correct path on nested nodes', () => {
    const entries = [{ path: 'a/b/c.ts', changeType: 'modified' as const }];

    const tree = buildFileTree(entries);

    expect(tree[0].path).toBe('a');
    expect(tree[0].children?.[0].path).toBe('a/b');
    expect(tree[0].children?.[0].children?.[0].path).toBe('a/b/c.ts');
  });

  it('groups files under same directory', () => {
    const entries = [
      { path: 'src/a.ts', changeType: 'modified' as const },
      { path: 'src/b.ts', changeType: 'added' as const },
    ];

    const tree = buildFileTree(entries);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
  });

  it('sorts directories before files', () => {
    const entries = [
      { path: 'src/z.ts', changeType: 'modified' as const },
      { path: 'src/a/b.ts', changeType: 'added' as const },
    ];

    const tree = buildFileTree(entries);
    const children = tree[0].children ?? [];

    expect(children[0].type).toBe('directory');
    expect(children[1].type).toBe('file');
  });
});
