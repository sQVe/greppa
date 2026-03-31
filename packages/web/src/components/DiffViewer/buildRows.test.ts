import { describe, expect, it } from 'vitest';

import type { DiffHunk } from '../../fixtures/types';
import { buildRows, diffLineKey } from './buildRows';

const contextOnly: DiffHunk = {
  header: '@@ -1,2 +1,2 @@',
  oldStart: 1,
  oldCount: 2,
  newStart: 1,
  newCount: 2,
  lines: [
    { lineType: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'const a = 1;' },
    { lineType: 'context', oldLineNumber: 2, newLineNumber: 2, content: 'const b = 2;' },
  ],
};

const pairedChange: DiffHunk = {
  header: '@@ -1,2 +1,2 @@',
  oldStart: 1,
  oldCount: 2,
  newStart: 1,
  newCount: 2,
  lines: [
    { lineType: 'removed', oldLineNumber: 1, newLineNumber: null, content: 'old line' },
    { lineType: 'added', oldLineNumber: null, newLineNumber: 1, content: 'new line' },
  ],
};

const unmatchedLines: DiffHunk = {
  header: '@@ -1,1 +1,3 @@',
  oldStart: 1,
  oldCount: 1,
  newStart: 1,
  newCount: 3,
  lines: [
    { lineType: 'removed', oldLineNumber: 1, newLineNumber: null, content: 'old' },
    { lineType: 'added', oldLineNumber: null, newLineNumber: 1, content: 'new 1' },
    { lineType: 'added', oldLineNumber: null, newLineNumber: 2, content: 'new 2' },
  ],
};

const trailingChanges: DiffHunk = {
  header: '@@ -1,2 +1,2 @@',
  oldStart: 1,
  oldCount: 2,
  newStart: 1,
  newCount: 2,
  lines: [
    { lineType: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'keep' },
    { lineType: 'removed', oldLineNumber: 2, newLineNumber: null, content: 'gone' },
    { lineType: 'added', oldLineNumber: null, newLineNumber: 2, content: 'here' },
  ],
};

describe('buildRows', () => {
  it('maps context lines to both left and right sides', () => {
    const rows = buildRows(contextOnly);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.left?.type).toBe('context');
    expect(rows[0]?.right?.type).toBe('context');
    expect(rows[0]?.left?.lineNumber).toBe(1);
    expect(rows[0]?.right?.lineNumber).toBe(1);
  });

  it('pairs a removed line with an added line on the same row', () => {
    const rows = buildRows(pairedChange);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.left?.type).toBe('removed');
    expect(rows[0]?.left?.content).toBe('old line');
    expect(rows[0]?.right?.type).toBe('added');
    expect(rows[0]?.right?.content).toBe('new line');
  });

  it('produces null on the shorter side when counts differ', () => {
    const rows = buildRows(unmatchedLines);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.left?.content).toBe('old');
    expect(rows[0]?.right?.content).toBe('new 1');
    expect(rows[1]?.left).toBeNull();
    expect(rows[1]?.right?.content).toBe('new 2');
  });

  it('flushes pending changes at the end of the hunk', () => {
    const rows = buildRows(trailingChanges);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.left?.type).toBe('context');
    expect(rows[1]?.left?.type).toBe('removed');
    expect(rows[1]?.right?.type).toBe('added');
  });

  it('assigns tokenMapKey from diffLineKey', () => {
    const rows = buildRows(pairedChange);
    expect(rows[0]?.left?.tokenMapKey).toBe('removed:1:');
    expect(rows[0]?.right?.tokenMapKey).toBe('added::1');
  });

  it('passes charRanges through to RowSide', () => {
    const hunk: DiffHunk = {
      header: '@@ -1,1 +1,1 @@',
      oldStart: 1,
      oldCount: 1,
      newStart: 1,
      newCount: 1,
      lines: [
        {
          lineType: 'removed',
          oldLineNumber: 1,
          newLineNumber: null,
          content: 'old',
          charRanges: [{ startColumn: 1, endColumn: 3 }],
        },
        {
          lineType: 'added',
          oldLineNumber: null,
          newLineNumber: 1,
          content: 'new',
          charRanges: [{ startColumn: 1, endColumn: 4 }],
        },
      ],
    };
    const rows = buildRows(hunk);
    expect(rows[0]?.left?.charRanges).toEqual([{ startColumn: 1, endColumn: 3 }]);
    expect(rows[0]?.right?.charRanges).toEqual([{ startColumn: 1, endColumn: 4 }]);
  });

  it('omits charRanges on context lines', () => {
    const rows = buildRows(contextOnly);
    expect(rows[0]?.left?.charRanges).toBeUndefined();
    expect(rows[0]?.right?.charRanges).toBeUndefined();
  });
});

describe('diffLineKey', () => {
  it('includes line type and both line numbers', () => {
    expect(
      diffLineKey({ lineType: 'context', oldLineNumber: 1, newLineNumber: 1, content: '' }),
    ).toBe('context:1:1');
  });

  it('uses empty string for null line numbers', () => {
    expect(
      diffLineKey({ lineType: 'removed', oldLineNumber: 5, newLineNumber: null, content: '' }),
    ).toBe('removed:5:');
    expect(
      diffLineKey({ lineType: 'added', oldLineNumber: null, newLineNumber: 3, content: '' }),
    ).toBe('added::3');
  });
});
