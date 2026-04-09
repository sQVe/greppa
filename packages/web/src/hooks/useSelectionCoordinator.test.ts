// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { usePrefetchNeighbors } from './usePrefetchNeighbors';
import { useSelectionCoordinator } from './useSelectionCoordinator';

vi.mock('./usePrefetchNeighbors', () => ({
  usePrefetchNeighbors: vi.fn(),
}));

vi.mock('./useMultiSelect', () => ({
  useMultiSelect: () => ({
    selectedPaths: new Set(['src/a.ts']),
    activeSource: 'committed' as const,
    isMultiSelect: false,
    select: vi.fn(),
    toggle: vi.fn(),
    selectRange: vi.fn(),
    selectAll: vi.fn(),
    toggleAll: vi.fn(),
    clear: vi.fn(),
  }),
}));

vi.mock('./useCommitList', () => ({
  useCommitList: () => ({ commits: [] }),
}));

vi.mock('./useCommitSelection', () => ({
  useCommitSelection: () => ({
    isActive: false,
    diffRange: null,
    selectCommit: vi.fn(),
  }),
}));

vi.mock('./useComputedDiffs', () => ({
  useComputedDiffs: () => ({ diffs: [], failedPaths: [] }),
}));

vi.mock('./useFileList', () => ({
  useFileList: () => ({ files: null, isLoading: false, isError: false }),
}));

vi.mock('./useFileSelectionHandlers', () => ({
  useFileSelectionHandlers: () => ({
    handleSelectCommittedFile: vi.fn(),
    handleSelectWorktreeFile: vi.fn(),
    handleSelectCommittedDirectory: vi.fn(),
    handleSelectWorktreeDirectory: vi.fn(),
  }),
}));

const mockedPrefetchNeighbors = vi.mocked(usePrefetchNeighbors);

const file = (path: string): FileNode => ({ path, name: path, type: 'file' });

describe('useSelectionCoordinator', () => {
  beforeEach(() => {
    mockedPrefetchNeighbors.mockClear();
  });

  it('invokes usePrefetchNeighbors with depth 2 for the committed context', () => {
    const files = [file('src/a.ts'), file('src/b.ts'), file('src/c.ts')];

    renderHook(() => {
      useSelectionCoordinator({
        files,
        worktreeFiles: [],
        oldRef: 'HEAD~1',
        newRef: 'HEAD',
      });
    });

    const committedCall = mockedPrefetchNeighbors.mock.calls.find(
      (call) => call[0].oldRef === 'HEAD~1' && call[0].newRef === 'HEAD',
    );
    expect(committedCall).toBeDefined();
    expect(committedCall?.[0].depth).toBe(2);
    expect(committedCall?.[0].selectedPath).toBe('src/a.ts');
    expect(committedCall?.[0].orderedFiles.map((n) => n.path)).toEqual([
      'src/a.ts',
      'src/b.ts',
      'src/c.ts',
    ]);
  });
});
