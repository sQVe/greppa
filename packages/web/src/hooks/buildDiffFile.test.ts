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
    if (result == null) return;
    expect(result.path).toBe('src/foo.ts');
    expect(result.changeType).toBe('modified');
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

    expect(result).not.toBeNull();
    if (result == null) return;
    const hunk = result.hunks[0];
    expect(hunk).toBeDefined();
    if (hunk == null) return;

    expect(hunk.lines.some((line) => line.lineType === 'context' && line.content === 'line 1')).toBe(true);
    expect(hunk.lines.some((line) => line.lineType === 'removed' && line.content === 'line 4')).toBe(true);
    expect(hunk.lines.some((line) => line.lineType === 'added' && line.content === 'CHANGED')).toBe(true);
    expect(hunk.lines.some((line) => line.lineType === 'context' && line.content === 'line 7')).toBe(true);
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

    expect(result).not.toBeNull();
    if (result == null) return;
    expect(result.hunks).toHaveLength(1);
    const hunk = result.hunks[0];
    expect(hunk).toBeDefined();
    if (hunk == null) return;
    expect(hunk.lines.every((line) => line.lineType === 'added')).toBe(true);
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

    expect(result).not.toBeNull();
    if (result == null) return;
    expect(result.hunks).toHaveLength(1);
    const hunk = result.hunks[0];
    expect(hunk).toBeDefined();
    if (hunk == null) return;
    expect(hunk.lines.every((line) => line.lineType === 'removed')).toBe(true);
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

    expect(result).not.toBeNull();
    if (result == null) return;
    expect(result.hunks.length).toBe(1);
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

    expect(result).not.toBeNull();
    if (result == null) return;
    expect(result.hunks.length).toBe(2);
  });

  it('returns empty hunks for identical content', () => {
    const result = buildDiffFile({
      filePath: 'f.ts',
      changeType: 'modified',
      oldContent: 'same',
      newContent: 'same',
      changes: [],
    });

    expect(result).not.toBeNull();
    if (result == null) return;
    expect(result.hunks).toEqual([]);
  });

  it('attaches charRanges to removed and added lines from innerChanges', () => {
    const oldLines = ['line 1', 'const a = 1;', 'line 3'];
    const newLines = ['line 1', 'const a = 2;', 'line 3'];
    const changes: DiffMapping[] = [
      {
        original: { startLineNumber: 2, endLineNumberExclusive: 3 },
        modified: { startLineNumber: 2, endLineNumberExclusive: 3 },
        innerChanges: [
          {
            originalRange: { startLineNumber: 2, startColumn: 7, endLineNumber: 2, endColumn: 8 },
            modifiedRange: { startLineNumber: 2, startColumn: 7, endLineNumber: 2, endColumn: 8 },
          },
        ],
      },
    ];

    const result = buildDiffFile({
      filePath: 'f.ts',
      changeType: 'modified',
      oldContent: oldLines.join('\n'),
      newContent: newLines.join('\n'),
      changes,
    });

    expect(result).not.toBeNull();
    if (result == null) return;
    const hunk = result.hunks[0];
    expect(hunk).toBeDefined();
    if (hunk == null) return;
    const removedLine = hunk.lines.find((line) => line.lineType === 'removed');
    const addedLine = hunk.lines.find((line) => line.lineType === 'added');
    const contextLines = hunk.lines.filter((line) => line.lineType === 'context');

    expect(removedLine).toBeDefined();
    expect(addedLine).toBeDefined();
    if (removedLine == null || addedLine == null) return;
    expect(removedLine.charRanges).toEqual([{ startColumn: 7, endColumn: 8 }]);
    expect(addedLine.charRanges).toEqual([{ startColumn: 7, endColumn: 8 }]);
    expect(contextLines.length).toBeGreaterThan(0);
    for (const contextLine of contextLines) {
      expect(contextLine.charRanges).toBeUndefined();
    }
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

    expect(result).not.toBeNull();
    if (result == null) return;
    expect(result.language).toBe('tsx');
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

    expect(result).not.toBeNull();
    if (result == null) return;
    expect(result.oldContent).toBe('const a = 1;');
    expect(result.newContent).toBe('const a = 2;');
  });
});
