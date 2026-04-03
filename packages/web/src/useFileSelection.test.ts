// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import type { RefObject } from 'react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
      language: 'TypeScript',
      encoding: 'UTF-8',
      lastModified: '2026-01-01T00:00:00Z',
      changeFrequency: 5,
      authors: ['alice'],
      relatedPRs: [1],
    },
  ],
]);

type HookResult = ReturnType<typeof useFileSelection>;

const renderFileSelection = async (initialLocation = '/') => {
  const resultRef: RefObject<HookResult | null> = { current: null };

  const HookHost = () => {
    const hookResult = useFileSelection(testFiles, [], testDiffs, testComments, testFileInfoMap);
    resultRef.current = hookResult;
    return createElement('div', { 'data-testid': 'hook-host' });
  };

  const rootRoute = createRootRoute({ component: HookHost });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' });
  const fileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/file/$' });
  const wtRoute = createRoute({ getParentRoute: () => rootRoute, path: '/wt/$' });
  const routeTree = rootRoute.addChildren([indexRoute, fileRoute, wtRoute]);
  const history = createMemoryHistory({ initialEntries: [initialLocation] });
  const router = createRouter({ routeTree, history });

  render(createElement(RouterProvider, { router }));
  await waitFor(() => {
    expect(screen.getByTestId('hook-host')).toBeDefined();
  });

  return { result: resultRef as RefObject<HookResult>, router };
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

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
    it('has no selected file', async () => {
      const { result } = await renderFileSelection();
      expect(result.current.selectedFilePath).toBeNull();
    });

    it('counts pre-reviewed files', async () => {
      const { result } = await renderFileSelection();
      expect(result.current.reviewedCount).toBe(1);
    });

    it('counts total files', async () => {
      const { result } = await renderFileSelection();
      expect(result.current.totalCount).toBe(3);
    });

    it('returns null diff when nothing is selected', async () => {
      const { result } = await renderFileSelection();
      expect(result.current.selectedDiff).toBeNull();
    });

    it('returns empty threads when nothing is selected', async () => {
      const { result } = await renderFileSelection();
      expect(result.current.selectedThreads).toEqual([]);
    });

    it('returns null file info when nothing is selected', async () => {
      const { result } = await renderFileSelection();
      expect(result.current.selectedFileInfo).toBeNull();
    });
  });

  describe('selecting a file', () => {
    it('updates selected file path', async () => {
      const { result } = await renderFileSelection();
      act(() => { result.current.selectCommittedFile('src/a.ts'); });
      await waitFor(() => {
        expect(result.current.selectedFilePath).toBe('src/a.ts');
      });
    });

    it('returns the diff for the selected file', async () => {
      const { result } = await renderFileSelection();
      act(() => { result.current.selectCommittedFile('src/a.ts'); });
      await waitFor(() => {
        expect(result.current.selectedDiff?.path).toBe('src/a.ts');
      });
    });

    it('returns null diff when selected file has no diff', async () => {
      const { result } = await renderFileSelection();
      act(() => { result.current.selectCommittedFile('c.ts'); });
      await waitFor(() => {
        expect(result.current.selectedDiff).toBeNull();
      });
    });

    it('filters comment threads to the selected file', async () => {
      const { result } = await renderFileSelection();
      act(() => { result.current.selectCommittedFile('src/a.ts'); });
      await waitFor(() => {
        expect(result.current.selectedThreads).toHaveLength(1);
        expect(result.current.selectedThreads[0]?.id).toBe('t1');
      });
    });

    it('returns file info for the selected file', async () => {
      const { result } = await renderFileSelection();
      act(() => { result.current.selectCommittedFile('src/a.ts'); });
      await waitFor(() => {
        expect(result.current.selectedFileInfo?.path).toBe('src/a.ts');
      });
    });

    it('returns null file info when selected file has none', async () => {
      const { result } = await renderFileSelection();
      act(() => { result.current.selectCommittedFile('src/b.ts'); });
      await waitFor(() => {
        expect(result.current.selectedFileInfo).toBeNull();
      });
    });
  });

  describe('URL sync', () => {
    it('reads initial file from URL path', async () => {
      const { result } = await renderFileSelection('/file/src/a.ts');
      expect(result.current.selectedFilePath).toBe('src/a.ts');
    });

    it('ignores invalid file path in URL', async () => {
      const { result } = await renderFileSelection('/file/nonexistent.ts');
      expect(result.current.selectedFilePath).toBeNull();
    });

    it('updates URL when a file is selected', async () => {
      const { result, router } = await renderFileSelection();
      act(() => { result.current.selectCommittedFile('src/a.ts'); });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/file/src/a.ts');
      });
    });

    it('responds to browser back/forward navigation', async () => {
      const { result, router } = await renderFileSelection();
      act(() => { result.current.selectCommittedFile('src/a.ts'); });
      await waitFor(() => {
        expect(result.current.selectedFilePath).toBe('src/a.ts');
      });

      act(() => { result.current.selectCommittedFile('src/b.ts'); });
      await waitFor(() => {
        expect(result.current.selectedFilePath).toBe('src/b.ts');
      });

      router.history.back();
      await waitFor(() => {
        expect(result.current.selectedFilePath).toBe('src/a.ts');
      });
    });
  });

  describe('review tracking', () => {
    it('marks an unreviewed file as reviewed on selection', async () => {
      const { result } = await renderFileSelection();
      expect(result.current.reviewedCount).toBe(1);
      act(() => { result.current.selectCommittedFile('src/b.ts'); });
      await waitFor(() => {
        expect(result.current.reviewedCount).toBe(2);
      });
    });

    it('does not double-count an already-reviewed file', async () => {
      const { result } = await renderFileSelection();
      act(() => { result.current.selectCommittedFile('src/a.ts'); });
      await waitFor(() => {
        expect(result.current.reviewedCount).toBe(1);
      });
    });

    it('marks a file as reviewed when loaded via deep link', async () => {
      const { result } = await renderFileSelection('/file/src/b.ts');
      await waitFor(() => {
        expect(result.current.reviewedCount).toBe(2);
      });
    });

    it('marks a file as reviewed on browser back navigation', async () => {
      const { result, router } = await renderFileSelection();
      expect(result.current.reviewedCount).toBe(1);

      act(() => { result.current.selectCommittedFile('src/b.ts'); });
      await waitFor(() => {
        expect(result.current.reviewedCount).toBe(2);
      });

      act(() => { result.current.selectCommittedFile('c.ts'); });
      await waitFor(() => {
        expect(result.current.reviewedCount).toBe(3);
      });

      router.history.back();
      await waitFor(() => {
        expect(result.current.selectedFilePath).toBe('src/b.ts');
        expect(result.current.reviewedCount).toBe(3);
      });
    });
  });
});
