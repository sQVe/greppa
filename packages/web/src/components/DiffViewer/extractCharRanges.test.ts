import { describe, expect, it } from 'vitest';

import type { DiffMapping } from '../../workers/diffProtocol';
import { extractCharRanges } from './extractCharRanges';

const mapping: DiffMapping = {
  original: { startLineNumber: 5, endLineNumberExclusive: 6 },
  modified: { startLineNumber: 5, endLineNumberExclusive: 6 },
  innerChanges: [
    {
      originalRange: { startLineNumber: 5, startColumn: 10, endLineNumber: 5, endColumn: 15 },
      modifiedRange: { startLineNumber: 5, startColumn: 10, endLineNumber: 5, endColumn: 20 },
    },
  ],
};

const multiInnerChanges: DiffMapping = {
  original: { startLineNumber: 3, endLineNumberExclusive: 5 },
  modified: { startLineNumber: 3, endLineNumberExclusive: 5 },
  innerChanges: [
    {
      originalRange: { startLineNumber: 3, startColumn: 1, endLineNumber: 3, endColumn: 5 },
      modifiedRange: { startLineNumber: 3, startColumn: 1, endLineNumber: 3, endColumn: 8 },
    },
    {
      originalRange: { startLineNumber: 4, startColumn: 2, endLineNumber: 4, endColumn: 10 },
      modifiedRange: { startLineNumber: 4, startColumn: 2, endLineNumber: 4, endColumn: 12 },
    },
  ],
};

const multiLineInnerChange: DiffMapping = {
  original: { startLineNumber: 10, endLineNumberExclusive: 13 },
  modified: { startLineNumber: 10, endLineNumberExclusive: 13 },
  innerChanges: [
    {
      originalRange: { startLineNumber: 10, startColumn: 5, endLineNumber: 12, endColumn: 3 },
      modifiedRange: { startLineNumber: 10, startColumn: 5, endLineNumber: 12, endColumn: 3 },
    },
  ],
};

describe('extractCharRanges', () => {
  it('extracts column range for a single-line innerChange on the original side', () => {
    const ranges = extractCharRanges(mapping, 5, 'original');
    expect(ranges).toEqual([{ startColumn: 10, endColumn: 15 }]);
  });

  it('extracts column range for a single-line innerChange on the modified side', () => {
    const ranges = extractCharRanges(mapping, 5, 'modified');
    expect(ranges).toEqual([{ startColumn: 10, endColumn: 20 }]);
  });

  it('returns empty array when line has no innerChanges', () => {
    const ranges = extractCharRanges(mapping, 6, 'original');
    expect(ranges).toEqual([]);
  });

  it('returns empty array when innerChanges is null', () => {
    const noInner: DiffMapping = {
      original: { startLineNumber: 1, endLineNumberExclusive: 2 },
      modified: { startLineNumber: 1, endLineNumberExclusive: 2 },
      innerChanges: null,
    };
    const ranges = extractCharRanges(noInner, 1, 'original');
    expect(ranges).toEqual([]);
  });

  it('extracts ranges for the correct line when multiple innerChanges exist', () => {
    expect(extractCharRanges(multiInnerChanges, 3, 'original')).toEqual([
      { startColumn: 1, endColumn: 5 },
    ]);
    expect(extractCharRanges(multiInnerChanges, 4, 'original')).toEqual([
      { startColumn: 2, endColumn: 10 },
    ]);
  });

  it('handles multi-line innerChange — start line gets startColumn to end of line', () => {
    const ranges = extractCharRanges(multiLineInnerChange, 10, 'original');
    expect(ranges).toEqual([{ startColumn: 5, endColumn: Infinity }]);
  });

  it('handles multi-line innerChange — middle line is fully highlighted', () => {
    const ranges = extractCharRanges(multiLineInnerChange, 11, 'original');
    expect(ranges).toEqual([{ startColumn: 1, endColumn: Infinity }]);
  });

  it('handles multi-line innerChange — end line gets column 1 to endColumn', () => {
    const ranges = extractCharRanges(multiLineInnerChange, 12, 'original');
    expect(ranges).toEqual([{ startColumn: 1, endColumn: 3 }]);
  });
});
