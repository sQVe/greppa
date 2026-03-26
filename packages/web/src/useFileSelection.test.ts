// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CommentThread, DiffFile, FileInfo, FileNode } from './fixtures/types';
import { collectFiles, useFileSelection } from './useFileSelection';

const testFiles: FileNode[] = [
  {
    path: 'src',
    name: 'src',
    type: 'directory',
    children: [
      { path: 'src/a.ts', name: 'a.ts', type: 'file', status: 'reviewed' },
      { path: 'src/b.ts', name: 'b.ts', type: 'file', status: 'unreviewed' },
    ],
  },
  { path: 'c.ts', name: 'c.ts', type: 'file', status: 'unreviewed' },
];

const testDiffs = new Map<string, DiffFile>([
  [
    'src/a.ts',
    {
      path: 'src/a.ts',
      changeType: 'modified',
      language: 'typescript',
      hunks: [],
    },
  ],
]);

const testComments: CommentThread[] = [
  {
    id: 't1',
    filePath: 'src/a.ts',
    lineNumber: 5,
    resolved: false,
    comments: [{ id: 'c1', author: 'alice', timestamp: '2026-01-01T00:00:00Z', body: 'fix this' }],
  },
  {
    id: 't2',
    filePath: 'src/b.ts',
    lineNumber: 10,
    resolved: false,
    comments: [{ id: 'c2', author: 'bob', timestamp: '2026-01-01T00:00:00Z', body: 'looks good' }],
  },
];

const testFileInfoMap = new Map<string, FileInfo>([
  [
    'src/a.ts',
    {
      path: 'src/a.ts',
      lastModified: '2026-01-01T00:00:00Z',
      changeFrequency: 5,
      authors: ['alice'],
      relatedPRs: [1],
    },
  ],
]);

const renderFileSelection = () =>
  renderHook(() => useFileSelection(testFiles, testDiffs, testComments, testFileInfoMap));

describe('collectFiles', () => {
  it('flattens nested file nodes into a flat list of files', () => {
    const result = collectFiles(testFiles);
    expect(result.map((f) => f.path)).toEqual(['src/a.ts', 'src/b.ts', 'c.ts']);
  });

  it('excludes directory nodes', () => {
    const result = collectFiles(testFiles);
    expect(result.every((f) => f.type === 'file')).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(collectFiles([])).toEqual([]);
  });
});

describe('useFileSelection', () => {
  describe('initial state', () => {
    it('has no selected file', () => {
      const { result } = renderFileSelection();
      expect(result.current.selectedFilePath).toBeNull();
    });

    it('counts pre-reviewed files', () => {
      const { result } = renderFileSelection();
      expect(result.current.reviewedCount).toBe(1);
    });

    it('counts total files', () => {
      const { result } = renderFileSelection();
      expect(result.current.totalCount).toBe(3);
    });

    it('returns null diff when nothing is selected', () => {
      const { result } = renderFileSelection();
      expect(result.current.selectedDiff).toBeNull();
    });

    it('returns empty threads when nothing is selected', () => {
      const { result } = renderFileSelection();
      expect(result.current.selectedThreads).toEqual([]);
    });

    it('returns null file info when nothing is selected', () => {
      const { result } = renderFileSelection();
      expect(result.current.selectedFileInfo).toBeNull();
    });
  });

  describe('selecting a file', () => {
    it('updates selected file path', () => {
      const { result } = renderFileSelection();
      act(() => {
        result.current.selectFile('src/a.ts');
      });
      expect(result.current.selectedFilePath).toBe('src/a.ts');
    });

    it('returns the diff for the selected file', () => {
      const { result } = renderFileSelection();
      act(() => {
        result.current.selectFile('src/a.ts');
      });
      expect(result.current.selectedDiff?.path).toBe('src/a.ts');
    });

    it('returns null diff when selected file has no diff', () => {
      const { result } = renderFileSelection();
      act(() => {
        result.current.selectFile('c.ts');
      });
      expect(result.current.selectedDiff).toBeNull();
    });

    it('filters comment threads to the selected file', () => {
      const { result } = renderFileSelection();
      act(() => {
        result.current.selectFile('src/a.ts');
      });
      expect(result.current.selectedThreads).toHaveLength(1);
      expect(result.current.selectedThreads[0]?.id).toBe('t1');
    });

    it('returns file info for the selected file', () => {
      const { result } = renderFileSelection();
      act(() => {
        result.current.selectFile('src/a.ts');
      });
      expect(result.current.selectedFileInfo?.path).toBe('src/a.ts');
    });

    it('returns null file info when selected file has none', () => {
      const { result } = renderFileSelection();
      act(() => {
        result.current.selectFile('src/b.ts');
      });
      expect(result.current.selectedFileInfo).toBeNull();
    });
  });

  describe('review tracking', () => {
    it('marks an unreviewed file as reviewed on selection', () => {
      const { result } = renderFileSelection();
      expect(result.current.reviewedCount).toBe(1);
      act(() => {
        result.current.selectFile('src/b.ts');
      });
      expect(result.current.reviewedCount).toBe(2);
    });

    it('does not double-count an already-reviewed file', () => {
      const { result } = renderFileSelection();
      act(() => {
        result.current.selectFile('src/a.ts');
      });
      expect(result.current.reviewedCount).toBe(1);
    });
  });
});
