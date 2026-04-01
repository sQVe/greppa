import type { CharRange } from '../../fixtures/types';
import type { DiffMapping, DiffRange } from '../../workers/diffProtocol';

export type { CharRange };

const rangeForLine = (range: DiffRange, lineNumber: number): CharRange | null => {
  if (lineNumber < range.startLineNumber || lineNumber > range.endLineNumber) {
    return null;
  }

  const isStartLine = lineNumber === range.startLineNumber;
  const isEndLine = lineNumber === range.endLineNumber;

  return {
    startColumn: isStartLine ? range.startColumn : 1,
    endColumn: isEndLine ? range.endColumn : Infinity,
  };
};

export const extractCharRanges = (
  change: DiffMapping,
  lineNumber: number,
  side: 'original' | 'modified',
): CharRange[] => {
  if (change.innerChanges == null) {
    return [];
  }

  const ranges: CharRange[] = [];

  for (const inner of change.innerChanges) {
    const range = side === 'original' ? inner.originalRange : inner.modifiedRange;
    const charRange = rangeForLine(range, lineNumber);
    if (charRange != null) {
      ranges.push(charRange);
    }
  }

  return ranges;
};
