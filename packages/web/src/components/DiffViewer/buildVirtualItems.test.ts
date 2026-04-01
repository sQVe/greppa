import { describe, expect, it } from 'vitest';

import type { DiffHunk } from '../../fixtures/types';
import { buildRows } from './buildRows';
import { buildVirtualItems } from './buildVirtualItems';

const singleHunk: DiffHunk = {
  header: '@@ -1,2 +1,2 @@',
  oldStart: 1,
  oldCount: 2,
  newStart: 1,
  newCount: 2,
  lines: [
    { lineType: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'const a = 1;' },
    { lineType: 'removed', oldLineNumber: 2, newLineNumber: null, content: 'old' },
    { lineType: 'added', oldLineNumber: null, newLineNumber: 2, content: 'new' },
  ],
};

const twoHunks: DiffHunk[] = [
  {
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldCount: 1,
    newStart: 1,
    newCount: 1,
    lines: [{ lineType: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'a' }],
  },
  {
    header: '@@ -10,1 +10,1 @@',
    oldStart: 10,
    oldCount: 1,
    newStart: 10,
    newCount: 1,
    lines: [{ lineType: 'context', oldLineNumber: 10, newLineNumber: 10, content: 'b' }],
  },
];

describe('buildVirtualItems', () => {
  it('starts with a hunk header followed by diff rows', () => {
    const hunks = [{ header: singleHunk.header, key: '0', rows: buildRows(singleHunk) }];
    const items = buildVirtualItems(hunks);

    expect(items[0]).toEqual({ kind: 'hunk-header', header: '@@ -1,2 +1,2 @@' });
    expect(items[1]?.kind).toBe('diff-row');
  });

  it('produces one hunk-header plus N diff-row items per hunk', () => {
    const hunks = [{ header: singleHunk.header, key: '0', rows: buildRows(singleHunk) }];
    const items = buildVirtualItems(hunks);

    expect(items).toHaveLength(3);
    expect(items.filter((item) => item.kind === 'hunk-header')).toHaveLength(1);
    expect(items.filter((item) => item.kind === 'diff-row')).toHaveLength(2);
  });

  it('interleaves hunk headers between multiple hunks', () => {
    const hunks = twoHunks.map((h, i) => ({
      header: h.header,
      key: String(i),
      rows: buildRows(h),
    }));
    const items = buildVirtualItems(hunks);

    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({ kind: 'hunk-header', header: '@@ -1,1 +1,1 @@' });
    expect(items[1]?.kind).toBe('diff-row');
    expect(items[2]).toEqual({ kind: 'hunk-header', header: '@@ -10,1 +10,1 @@' });
    expect(items[3]?.kind).toBe('diff-row');
  });

  it('preserves DiffRow data in diff-row items', () => {
    const hunks = [{ header: singleHunk.header, key: '0', rows: buildRows(singleHunk) }];
    const items = buildVirtualItems(hunks);
    const diffRow = items[1];

    if (diffRow?.kind !== 'diff-row') {
      throw new Error('expected diff-row');
    }

    expect(diffRow.row.left?.content).toBe('const a = 1;');
    expect(diffRow.row.right?.content).toBe('const a = 1;');
  });

  it('returns an empty array for no hunks', () => {
    expect(buildVirtualItems([])).toEqual([]);
  });
});
