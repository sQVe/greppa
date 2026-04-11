// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-unassigned-import -- side-effect polyfill for IndexedDB under happy-dom
import 'fake-indexeddb/auto';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { useSelectionCoordinator } from './useSelectionCoordinator';

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

const file = (path: string): FileNode => ({ path, name: path, type: 'file' });

const createWrapper = (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

describe('useSelectionCoordinator', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ path: 'stub', changeType: 'modified' }),
    } as Response);
  });

  it('prefetches the two committed files following the selection at depth 2', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery');
    const files = [file('src/a.ts'), file('src/b.ts'), file('src/c.ts'), file('src/d.ts')];

    renderHook(
      () => {
        useSelectionCoordinator({
          files,
          worktreeFiles: [],
          oldRef: 'HEAD~1',
          newRef: 'HEAD',
        });
      },
      { wrapper: createWrapper(queryClient) },
    );

    const queryKeys = prefetchSpy.mock.calls.map((call) => call[0].queryKey);
    expect(queryKeys).toEqual([
      ['diff', 'HEAD~1', 'HEAD', 'src/b.ts'],
      ['diff', 'HEAD~1', 'HEAD', 'src/c.ts'],
    ]);
  });

  it('does not prefetch when refs are unset', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery');
    const files = [file('src/a.ts'), file('src/b.ts'), file('src/c.ts')];

    renderHook(
      () => {
        useSelectionCoordinator({
          files,
          worktreeFiles: [],
          oldRef: '',
          newRef: '',
        });
      },
      { wrapper: createWrapper(queryClient) },
    );

    expect(prefetchSpy).not.toHaveBeenCalled();
  });
});
