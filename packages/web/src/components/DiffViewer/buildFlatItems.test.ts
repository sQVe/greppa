import { describe, expect, it } from 'vitest';

import type { DiffFile } from '../../fixtures/types';
import { buildFlatItems } from './buildFlatItems';

const fileA: DiffFile = {
  path: 'src/Api.ts',
  changeType: 'modified',
  language: 'typescript',
  hunks: [
    {
      header: '@@ -1,2 +1,2 @@',
      oldStart: 1,
      oldCount: 2,
      newStart: 1,
      newCount: 2,
      lines: [
        { lineType: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'line 1' },
        { lineType: 'removed', oldLineNumber: 2, newLineNumber: null, content: 'old' },
        { lineType: 'added', oldLineNumber: null, newLineNumber: 2, content: 'new' },
      ],
    },
  ],
};

const fileB: DiffFile = {
  path: 'src/GitService.ts',
  changeType: 'added',
  language: 'typescript',
  hunks: [
    {
      header: '@@ -0,0 +1,1 @@',
      oldStart: 0,
      oldCount: 0,
      newStart: 1,
      newCount: 1,
      lines: [
        { lineType: 'added', oldLineNumber: null, newLineNumber: 1, content: 'new file' },
      ],
    },
  ],
};

describe('buildFlatItems', () => {
  it('returns empty array for no files', () => {
    expect(buildFlatItems([])).toEqual([]);
  });

  it('starts each file with a file-header item', () => {
    const items = buildFlatItems([fileA]);

    expect(items[0]?.kind).toBe('file-header');
    if (items[0]?.kind === 'file-header') {
      expect(items[0].diff).toBe(fileA);
    }
  });

  it('includes hunk-header and diff-row items after file-header', () => {
    const items = buildFlatItems([fileA]);
    const kinds = items.map((item) => item.kind);

    expect(kinds).toEqual(['file-header', 'hunk-header', 'diff-row', 'diff-row']);
  });

  it('inserts file-separator between files but not after the last', () => {
    const items = buildFlatItems([fileA, fileB]);
    const kinds = items.map((item) => item.kind);

    expect(kinds).toEqual([
      'file-header', 'hunk-header', 'diff-row', 'diff-row',
      'file-separator',
      'file-header', 'hunk-header', 'diff-row',
    ]);
  });

  it('preserves diff data in file-header items', () => {
    const items = buildFlatItems([fileA, fileB]);
    const headers = items.filter((item) => item.kind === 'file-header');

    expect(headers).toHaveLength(2);
    if (headers[0]?.kind === 'file-header' && headers[1]?.kind === 'file-header') {
      expect(headers[0].diff.path).toBe('src/Api.ts');
      expect(headers[1].diff.path).toBe('src/GitService.ts');
    }
  });

  it('preserves row data in diff-row items', () => {
    const items = buildFlatItems([fileA]);
    const rows = items.filter((item) => item.kind === 'diff-row');

    expect(rows).toHaveLength(2);
    if (rows[0]?.kind === 'diff-row') {
      expect(rows[0].row.left?.content).toBe('line 1');
    }
  });

  it('preserves hunk header text', () => {
    const items = buildFlatItems([fileA]);
    const hunkHeaders = items.filter((item) => item.kind === 'hunk-header');

    expect(hunkHeaders).toHaveLength(1);
    if (hunkHeaders[0]?.kind === 'hunk-header') {
      expect(hunkHeaders[0].header).toBe('@@ -1,2 +1,2 @@');
    }
  });
});
