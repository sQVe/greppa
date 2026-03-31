import { DefaultLinesDiffComputer } from 'vscode-diff';

import type { DiffInnerChange, DiffMapping, DiffRequest, DiffResponse } from './diffProtocol';

const computer = new DefaultLinesDiffComputer();

const splitLines = (content: string): string[] => content.split('\n');

export const handleDiffRequest = (request: DiffRequest): DiffResponse => {
  const { filePath, oldContent, newContent } = request;

  const originalLines = splitLines(oldContent);
  const modifiedLines = splitLines(newContent);

  const result = computer.computeDiff(originalLines, modifiedLines, {
    ignoreTrimWhitespace: false,
    maxComputationTimeMs: 5000,
    computeMoves: false,
  });

  const changes: DiffMapping[] = result.changes.map((change) => ({
    original: {
      startLineNumber: change.original.startLineNumber,
      endLineNumberExclusive: change.original.endLineNumberExclusive,
    },
    modified: {
      startLineNumber: change.modified.startLineNumber,
      endLineNumberExclusive: change.modified.endLineNumberExclusive,
    },
    innerChanges:
      change.innerChanges?.map(
        (inner): DiffInnerChange => ({
          originalRange: {
            startLineNumber: inner.originalRange.startLineNumber,
            startColumn: inner.originalRange.startColumn,
            endLineNumber: inner.originalRange.endLineNumber,
            endColumn: inner.originalRange.endColumn,
          },
          modifiedRange: {
            startLineNumber: inner.modifiedRange.startLineNumber,
            startColumn: inner.modifiedRange.startColumn,
            endLineNumber: inner.modifiedRange.endLineNumber,
            endColumn: inner.modifiedRange.endColumn,
          },
        }),
      ) ?? null,
  }));

  return {
    type: 'diff-result',
    filePath,
    changes,
    hitTimeout: result.hitTimeout,
  };
};
