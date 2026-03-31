import { describe, expect, it } from 'vitest';

import type { DiffMapping } from '../workers/diffProtocol';
import { buildDiffFile } from './buildDiffFile';

describe('buildDiffFile', () => {
  it('returns null when inputs are null', () => {
    expect(
      buildDiffFile({ filePath: null, changeType: null, oldContent: null, newContent: null }),
    ).toBeNull();
  });

  it('builds a DiffFile with path and changeType', () => {
    const result = buildDiffFile({
      filePath: 'src/foo.ts',
      changeType: 'modified',
      oldContent: 'const a = 1;',
      newContent: 'const a = 2;',
      changes: [
        {
          original: { startLineNumber: 1, endLineNumberExclusive: 2 },
          modified: { startLineNumber: 1, endLineNumberExclusive: 2 },
          innerChanges: null,
        },
      ],
    });

    expect(result).not.toBeNull();
    expect(result!.path).toBe('src/foo.ts');
    expect(result!.changeType).toBe('modified');
  });

  it('produces hunk with context lines around changes', () => {
    const oldLines = ['line 1', 'line 2', 'line 3', 'line 4', 'line 5', 'line 6', 'line 7'];
    const newLines = ['line 1', 'line 2', 'line 3', 'CHANGED', 'line 5', 'line 6', 'line 7'];
    const changes: DiffMapping[] = [
      {
        original: { startLineNumber: 4, endLineNumberExclusive: 5 },
        modified: { startLineNumber: 4, endLineNumberExclusive: 5 },
        innerChanges: null,
      },
    ];

    const result = buildDiffFile({
      filePath: 'f.ts',
      changeType: 'modified',
      oldContent: oldLines.join('\n'),
      newContent: newLines.join('\n'),
      changes,
    });
    const hunk = result!.hunks[0];

    expect(hunk.lines.some((l) => l.lineType === 'context' && l.content === 'line 1')).toBe(true);
    expect(hunk.lines.some((l) => l.lineType === 'removed' && l.content === 'line 4')).toBe(true);
    expect(hunk.lines.some((l) => l.lineType === 'added' && l.content === 'CHANGED')).toBe(true);
    expect(hunk.lines.some((l) => l.lineType === 'context' && l.content === 'line 7')).toBe(true);
  });

  it('handles added file', () => {
    const changes: DiffMapping[] = [
      {
        original: { startLineNumber: 1, endLineNumberExclusive: 1 },
        modified: { startLineNumber: 1, endLineNumberExclusive: 3 },
        innerChanges: null,
      },
    ];

    const result = buildDiffFile({
      filePath: 'new.ts',
      changeType: 'added',
      oldContent: '',
      newContent: 'line 1\nline 2',
      changes,
    });

    expect(result!.hunks.length).toBe(1);
    expect(result!.hunks[0].lines.every((l) => l.lineType === 'added')).toBe(true);
  });

  it('handles deleted file', () => {
    const changes: DiffMapping[] = [
      {
        original: { startLineNumber: 1, endLineNumberExclusive: 3 },
        modified: { startLineNumber: 1, endLineNumberExclusive: 1 },
        innerChanges: null,
      },
    ];

    const result = buildDiffFile({
      filePath: 'del.ts',
      changeType: 'deleted',
      oldContent: 'line 1\nline 2',
      newContent: '',
      changes,
    });

    expect(result!.hunks.length).toBe(1);
    expect(result!.hunks[0].lines.every((l) => l.lineType === 'removed')).toBe(true);
  });

  it('merges nearby changes into one hunk', () => {
    const oldLines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
    const newLines = [...oldLines];
    newLines[1] = 'CHANGED 2';
    newLines[4] = 'CHANGED 5';

    const changes: DiffMapping[] = [
      {
        original: { startLineNumber: 2, endLineNumberExclusive: 3 },
        modified: { startLineNumber: 2, endLineNumberExclusive: 3 },
        innerChanges: null,
      },
      {
        original: { startLineNumber: 5, endLineNumberExclusive: 6 },
        modified: { startLineNumber: 5, endLineNumberExclusive: 6 },
        innerChanges: null,
      },
    ];

    const result = buildDiffFile({
      filePath: 'f.ts',
      changeType: 'modified',
      oldContent: oldLines.join('\n'),
      newContent: newLines.join('\n'),
      changes,
    });

    expect(result!.hunks.length).toBe(1);
  });

  it('splits distant changes into separate hunks', () => {
    const oldLines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    const newLines = [...oldLines];
    newLines[1] = 'CHANGED 2';
    newLines[18] = 'CHANGED 19';

    const changes: DiffMapping[] = [
      {
        original: { startLineNumber: 2, endLineNumberExclusive: 3 },
        modified: { startLineNumber: 2, endLineNumberExclusive: 3 },
        innerChanges: null,
      },
      {
        original: { startLineNumber: 19, endLineNumberExclusive: 20 },
        modified: { startLineNumber: 19, endLineNumberExclusive: 20 },
        innerChanges: null,
      },
    ];

    const result = buildDiffFile({
      filePath: 'f.ts',
      changeType: 'modified',
      oldContent: oldLines.join('\n'),
      newContent: newLines.join('\n'),
      changes,
    });

    expect(result!.hunks.length).toBe(2);
  });

  it('returns empty hunks for identical content', () => {
    const result = buildDiffFile({
      filePath: 'f.ts',
      changeType: 'modified',
      oldContent: 'same',
      newContent: 'same',
      changes: [],
    });

    expect(result!.hunks).toEqual([]);
  });

  it('attaches charRanges to removed and added lines from innerChanges', () => {
    const changes: DiffMapping[] = [
      {
        original: { startLineNumber: 1, endLineNumberExclusive: 2 },
        modified: { startLineNumber: 1, endLineNumberExclusive: 2 },
        innerChanges: [
          {
            originalRange: { startLineNumber: 1, startColumn: 7, endLineNumber: 1, endColumn: 8 },
            modifiedRange: { startLineNumber: 1, startColumn: 7, endLineNumber: 1, endColumn: 8 },
          },
        ],
      },
    ];

    const result = buildDiffFile({
      filePath: 'f.ts',
      changeType: 'modified',
      oldContent: 'const a = 1;',
      newContent: 'const a = 2;',
      changes,
    });

    const removedLine = result!.hunks[0].lines.find((l) => l.lineType === 'removed');
    const addedLine = result!.hunks[0].lines.find((l) => l.lineType === 'added');
    const contextLine = result!.hunks[0].lines.find((l) => l.lineType === 'context');

    expect(removedLine!.charRanges).toEqual([{ startColumn: 7, endColumn: 8 }]);
    expect(addedLine!.charRanges).toEqual([{ startColumn: 7, endColumn: 8 }]);
    expect(contextLine?.charRanges).toBeUndefined();
  });

  it('derives language from file extension', () => {
    const result = buildDiffFile({
      filePath: 'src/app.tsx',
      changeType: 'modified',
      oldContent: 'a',
      newContent: 'b',
      changes: [
        {
          original: { startLineNumber: 1, endLineNumberExclusive: 2 },
          modified: { startLineNumber: 1, endLineNumberExclusive: 2 },
          innerChanges: null,
        },
      ],
    });

    expect(result!.language).toBe('tsx');
  });

  it('includes oldContent and newContent in result', () => {
    const result = buildDiffFile({
      filePath: 'f.ts',
      changeType: 'modified',
      oldContent: 'const a = 1;',
      newContent: 'const a = 2;',
      changes: [
        {
          original: { startLineNumber: 1, endLineNumberExclusive: 2 },
          modified: { startLineNumber: 1, endLineNumberExclusive: 2 },
          innerChanges: null,
        },
      ],
    });

    expect(result!.oldContent).toBe('const a = 1;');
    expect(result!.newContent).toBe('const a = 2;');
  });
});
