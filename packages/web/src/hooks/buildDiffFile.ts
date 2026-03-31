import type { DiffFile, DiffHunk, DiffLine } from '../fixtures/types';
import { extractCharRanges } from '../components/DiffViewer/extractCharRanges';
import type { DiffMapping } from '../workers/diffProtocol';

const CHANGE_TYPES = new Set(['added', 'modified', 'deleted', 'renamed']);

const isChangeType = (value: string): value is DiffFile['changeType'] => CHANGE_TYPES.has(value);

const CONTEXT_LINES = 3;

const extensionToLanguage: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  json: 'json',
  css: 'css',
  html: 'html',
  md: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  py: 'python',
  go: 'go',
  rs: 'rust',
  sh: 'shellscript',
  bash: 'shellscript',
};

const getLanguage = (filePath: string): string => {
  const ext = filePath.split('.').pop() ?? '';
  return extensionToLanguage[ext] ?? ext;
};

interface HunkRange {
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
}

const computeHunkRanges = (
  changes: DiffMapping[],
  oldLineCount: number,
  newLineCount: number,
): HunkRange[] => {
  if (changes.length === 0) {
    return [];
  }

  const ranges: HunkRange[] = [];

  for (const change of changes) {
    const oldStart = Math.max(1, change.original.startLineNumber - CONTEXT_LINES);
    const oldEnd = Math.min(oldLineCount, change.original.endLineNumberExclusive - 1 + CONTEXT_LINES);
    const newStart = Math.max(1, change.modified.startLineNumber - CONTEXT_LINES);
    const newEnd = Math.min(newLineCount, change.modified.endLineNumberExclusive - 1 + CONTEXT_LINES);

    const prev = ranges[ranges.length - 1];
    if (prev != null && oldStart <= prev.oldEnd + 1) {
      prev.oldEnd = Math.max(prev.oldEnd, oldEnd);
      prev.newEnd = Math.max(prev.newEnd, newEnd);
    } else {
      ranges.push({ oldStart, oldEnd, newStart, newEnd });
    }
  }

  return ranges;
};

const buildHunk = (
  range: HunkRange,
  changes: DiffMapping[],
  oldLines: string[],
  newLines: string[],
): DiffHunk => {
  const lines: DiffLine[] = [];
  let oldIdx = range.oldStart;
  let newIdx = range.newStart;

  const relevantChanges = changes.filter(
    (c) =>
      c.original.endLineNumberExclusive > range.oldStart - CONTEXT_LINES &&
      c.original.startLineNumber <= range.oldEnd + CONTEXT_LINES,
  );

  for (const change of relevantChanges) {
    while (oldIdx < change.original.startLineNumber && newIdx < change.modified.startLineNumber) {
      lines.push({
        lineType: 'context',
        oldLineNumber: oldIdx,
        newLineNumber: newIdx,
        content: oldLines[oldIdx - 1] ?? '',
      });
      oldIdx++;
      newIdx++;
    }

    for (let i = change.original.startLineNumber; i < change.original.endLineNumberExclusive; i++) {
      const charRanges = extractCharRanges(change, i, 'original');
      lines.push({
        lineType: 'removed',
        oldLineNumber: i,
        newLineNumber: null,
        content: oldLines[i - 1] ?? '',
        ...(charRanges.length > 0 ? { charRanges } : {}),
      });
    }
    oldIdx = change.original.endLineNumberExclusive;

    for (let i = change.modified.startLineNumber; i < change.modified.endLineNumberExclusive; i++) {
      const charRanges = extractCharRanges(change, i, 'modified');
      lines.push({
        lineType: 'added',
        oldLineNumber: null,
        newLineNumber: i,
        content: newLines[i - 1] ?? '',
        ...(charRanges.length > 0 ? { charRanges } : {}),
      });
    }
    newIdx = change.modified.endLineNumberExclusive;
  }

  while (oldIdx <= range.oldEnd && newIdx <= range.newEnd) {
    lines.push({
      lineType: 'context',
      oldLineNumber: oldIdx,
      newLineNumber: newIdx,
      content: oldLines[oldIdx - 1] ?? '',
    });
    oldIdx++;
    newIdx++;
  }

  const oldCount = range.oldEnd - range.oldStart + 1;
  const newCount = range.newEnd - range.newStart + 1;

  return {
    header: `@@ -${range.oldStart},${oldCount} +${range.newStart},${newCount} @@`,
    oldStart: range.oldStart,
    oldCount,
    newStart: range.newStart,
    newCount,
    lines,
  };
};

export interface BuildDiffFileInput {
  filePath: string | null;
  changeType: string | null;
  oldContent: string | null;
  newContent: string | null;
  changes?: DiffMapping[] | null;
}

export const buildDiffFile = (input: BuildDiffFileInput): DiffFile | null => {
  const { filePath, changeType, oldContent, newContent, changes } = input;

  if (filePath == null || changeType == null || !isChangeType(changeType) || oldContent == null || newContent == null) {
    return null;
  }

  if (changes == null || changes.length === 0) {
    return {
      path: filePath,
      changeType,
      language: getLanguage(filePath),
      hunks: [],
      oldContent,
      newContent,
    };
  }

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const hunkRanges = computeHunkRanges(changes, oldLines.length, newLines.length);
  const hunks = hunkRanges.map((range) => buildHunk(range, changes, oldLines, newLines));

  return {
    path: filePath,
    changeType,
    language: getLanguage(filePath),
    hunks,
    oldContent,
    newContent,
  };
};
