import type { ChangeType, DiffFile, DiffHunk, DiffLine } from '../fixtures/types';
import { extractCharRanges } from '../components/DiffViewer/extractCharRanges';
import type { DiffMapping } from '../workers/diffProtocol';

interface HunkRange {
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
}

export interface BuildDiffFileInput {
  filePath: string | null;
  changeType: ChangeType | null;
  oldPath?: string | null;
  oldContent: string | null;
  newContent: string | null;
  changes?: DiffMapping[] | null;
}

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
  let oldLineNumber = range.oldStart;
  let newLineNumber = range.newStart;

  const relevantChanges = changes.filter(
    (change) =>
      change.original.endLineNumberExclusive > range.oldStart - CONTEXT_LINES &&
      change.original.startLineNumber <= range.oldEnd + CONTEXT_LINES,
  );

  for (const change of relevantChanges) {
    while (oldLineNumber < change.original.startLineNumber && newLineNumber < change.modified.startLineNumber) {
      lines.push({
        lineType: 'context',
        oldLineNumber: oldLineNumber,
        newLineNumber: newLineNumber,
        content: oldLines[oldLineNumber - 1] ?? '',
      });
      oldLineNumber++;
      newLineNumber++;
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
    oldLineNumber = change.original.endLineNumberExclusive;

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
    newLineNumber = change.modified.endLineNumberExclusive;
  }

  while (oldLineNumber <= range.oldEnd && newLineNumber <= range.newEnd) {
    lines.push({
      lineType: 'context',
      oldLineNumber: oldLineNumber,
      newLineNumber: newLineNumber,
      content: oldLines[oldLineNumber - 1] ?? '',
    });
    oldLineNumber++;
    newLineNumber++;
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

export const buildDiffFile = (input: BuildDiffFileInput): DiffFile | null => {
  const { filePath, changeType, oldPath, oldContent, newContent, changes } = input;

  if (filePath == null || changeType == null || oldContent == null || newContent == null) {
    return null;
  }

  const base = {
    path: filePath,
    changeType,
    ...(oldPath != null ? { oldPath } : {}),
    language: getLanguage(filePath),
    oldContent,
    newContent,
  };

  if (changeType === 'added') {
    const lines = newContent.split('\n');
    const hunkLines: DiffLine[] = lines.map((content, i) => ({
      lineType: 'added',
      oldLineNumber: null,
      newLineNumber: i + 1,
      content,
    }));
    return { ...base, hunks: [{
      header: `@@ -0,0 +1,${lines.length} @@`,
      oldStart: 0,
      oldCount: 0,
      newStart: 1,
      newCount: lines.length,
      lines: hunkLines,
    }] };
  }

  if (changeType === 'deleted') {
    const lines = oldContent.split('\n');
    const hunkLines: DiffLine[] = lines.map((content, i) => ({
      lineType: 'removed',
      oldLineNumber: i + 1,
      newLineNumber: null,
      content,
    }));
    return { ...base, hunks: [{
      header: `@@ -1,${lines.length} +0,0 @@`,
      oldStart: 1,
      oldCount: lines.length,
      newStart: 0,
      newCount: 0,
      lines: hunkLines,
    }] };
  }

  if (changes == null || changes.length === 0) {
    return { ...base, hunks: [] };
  }

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const hunkRanges = computeHunkRanges(changes, oldLines.length, newLines.length);
  const hunks = hunkRanges.map((range) => buildHunk(range, changes, oldLines, newLines));

  return { ...base, hunks };
};
