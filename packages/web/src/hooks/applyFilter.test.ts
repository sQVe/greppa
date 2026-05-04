import { describe, expect, it } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { applyFilter } from './applyFilter';

const tree: FileNode[] = [
  {
    path: 'src',
    name: 'src',
    type: 'directory',
    children: [
      { path: 'src/index.ts', name: 'index.ts', type: 'file', changeType: 'modified' },
      {
        path: 'src/utils',
        name: 'utils',
        type: 'directory',
        children: [
          { path: 'src/utils/format.ts', name: 'format.ts', type: 'file', changeType: 'added' },
          { path: 'src/utils/parse.ts', name: 'parse.ts', type: 'file', changeType: 'added' },
        ],
      },
    ],
  },
  { path: 'README.md', name: 'README.md', type: 'file', changeType: 'modified' },
];

describe('applyFilter', () => {
  it('returns the input tree untouched when query is empty', () => {
    const result = applyFilter(tree, '');

    expect(result.files).toBe(tree);
    expect(result.autoExpand.size).toBe(0);
    expect(result.visibleCount).toBe(4);
    expect(result.totalCount).toBe(4);
  });

  it('matches a leaf and surfaces ancestor directories in autoExpand', () => {
    const result = applyFilter(tree, 'format');

    expect(result.visibleCount).toBe(1);
    expect(result.totalCount).toBe(4);
    expect([...result.autoExpand].toSorted()).toEqual(['src', 'src/utils']);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe('src');
    expect(result.files[0]?.children?.[0]?.path).toBe('src/utils');
    expect(result.files[0]?.children?.[0]?.children?.map((node) => node.path)).toEqual([
      'src/utils/format.ts',
    ]);
  });

  it('prunes directories whose descendants do not match', () => {
    const result = applyFilter(tree, 'README');

    expect(result.visibleCount).toBe(1);
    expect(result.files.map((node) => node.path)).toEqual(['README.md']);
    expect(result.autoExpand.size).toBe(0);
  });

  it('matches case-insensitively', () => {
    const lower = applyFilter(tree, 'index.ts');
    const upper = applyFilter(tree, 'INDEX.TS');

    expect(lower.visibleCount).toBe(1);
    expect(upper.visibleCount).toBe(1);
    expect(lower.files[0]?.children?.[0]?.path).toBe('src/index.ts');
    expect(upper.files[0]?.children?.[0]?.path).toBe('src/index.ts');
  });

  it('returns no files for a non-matching query and empty autoExpand', () => {
    const result = applyFilter(tree, 'zzz');

    expect(result.visibleCount).toBe(0);
    expect(result.totalCount).toBe(4);
    expect(result.files).toEqual([]);
    expect(result.autoExpand.size).toBe(0);
  });
});
