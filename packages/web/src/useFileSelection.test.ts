// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { zodValidator, fallback } from '@tanstack/zod-adapter';
import type { RefObject } from 'react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { CommentThread, DiffFile, FileInfo, FileNode } from './fixtures/types';
import { parseSearch, stringifySearch } from './router';
import { cacheState, clearAllStateCaches } from './stateCache';
import { collectDescendantFilePaths, collectFiles, useFileSelection } from './useFileSelection';

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

const changesSearch = z.object({
  s: fallback(z.string(), '').default(''),
  file: fallback(z.array(z.string()), []).default([]),
});

const changesUrl = (files: string[]) => {
  const full = { file: files, wt: [], commits: [] };
  const id = `test-${Math.random().toString(36).slice(2, 6)}`;
  cacheState(id, full);
  return `/changes?s=${id}`;
};

const renderFileSelection = async (initialLocation = '/changes') => {
  const resultRef: RefObject<HookResult | null> = { current: null };

  const HookHost = () => {
    const hookResult = useFileSelection(testFiles, [], testDiffs, testComments, testFileInfoMap);
    resultRef.current = hookResult;
    return createElement('div', { 'data-testid': 'hook-host' });
  };

  const rootRoute = createRootRoute({ component: HookHost });
  const changesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/changes',
    validateSearch: zodValidator(changesSearch),
  });
  const routeTree = rootRoute.addChildren([changesRoute]);
  const history = createMemoryHistory({ initialEntries: [initialLocation] });
  const router = createRouter({ routeTree, history, parseSearch, stringifySearch });

  render(createElement(RouterProvider, { router }));
  await waitFor(() => {
    expect(screen.getByTestId('hook-host')).toBeDefined();
  });

  const navigateTo = (path: string) => {
    act(() => { void router.navigate({ to: '/changes', search: { s: '', file: [path] } }); });
  };

  return { result: resultRef as RefObject<HookResult>, router, navigateTo };
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  clearAllStateCaches();
});

describe('collectFiles', () => {
  it('should flatten nested file nodes into a flat list of files', () => {
    const result = collectFiles(testFiles);

    expect(result.map((file) => file.path)).toEqual(['src/a.ts', 'src/b.ts', 'c.ts']);
  });

  it('should exclude directory nodes', () => {
    const result = collectFiles(testFiles);

    expect(result.every((file) => file.type === 'file')).toBe(true);
  });

  it('should return empty array for empty input', () => {
    expect(collectFiles([])).toEqual([]);
  });
});

describe('collectDescendantFilePaths', () => {
  it('should return file paths under the given directory', () => {
    const result = collectDescendantFilePaths(testFiles, 'src');

    expect(result).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('should return empty array for unknown directory', () => {
    expect(collectDescendantFilePaths(testFiles, 'unknown')).toEqual([]);
  });

  it('should return empty array for file paths', () => {
    expect(collectDescendantFilePaths(testFiles, 'c.ts')).toEqual([]);
  });
});

describe('useFileSelection', () => {
  describe('initial state', () => {
    it('should have no selected file', async () => {
      const { result } = await renderFileSelection();
      expect(result.current.selectedFilePath).toBeNull();
    });

    it('should return null diff when nothing is selected', async () => {
      const { result } = await renderFileSelection();
      expect(result.current.selectedDiff).toBeNull();
    });

    it('should return empty threads when nothing is selected', async () => {
      const { result } = await renderFileSelection();
      expect(result.current.selectedThreads).toEqual([]);
    });

    it('should return null file info when nothing is selected', async () => {
      const { result } = await renderFileSelection();
      expect(result.current.selectedFileInfo).toBeNull();
    });
  });

  describe('selecting a file', () => {
    it('should update selected file path', async () => {
      const { result, navigateTo } = await renderFileSelection();
      navigateTo('src/a.ts');
      await waitFor(() => {
        expect(result.current.selectedFilePath).toBe('src/a.ts');
      });
    });

    it('should return the diff for the selected file', async () => {
      const { result, navigateTo } = await renderFileSelection();
      navigateTo('src/a.ts');
      await waitFor(() => {
        expect(result.current.selectedDiff?.path).toBe('src/a.ts');
      });
    });

    it('should return null diff when selected file has no diff', async () => {
      const { result, navigateTo } = await renderFileSelection();
      navigateTo('c.ts');
      await waitFor(() => {
        expect(result.current.selectedDiff).toBeNull();
      });
    });

    it('should filter comment threads to the selected file', async () => {
      const { result, navigateTo } = await renderFileSelection();
      navigateTo('src/a.ts');
      await waitFor(() => {
        expect(result.current.selectedThreads).toHaveLength(1);
        expect(result.current.selectedThreads[0]?.id).toBe('t1');
      });
    });

    it('should return file info for the selected file', async () => {
      const { result, navigateTo } = await renderFileSelection();
      navigateTo('src/a.ts');
      await waitFor(() => {
        expect(result.current.selectedFileInfo?.path).toBe('src/a.ts');
      });
    });

    it('should return null file info when selected file has none', async () => {
      const { result, navigateTo } = await renderFileSelection();
      navigateTo('src/b.ts');
      await waitFor(() => {
        expect(result.current.selectedFileInfo).toBeNull();
      });
    });
  });

  describe('URL sync', () => {
    it('should read initial file from search params', async () => {
      const { result } = await renderFileSelection(changesUrl(['src/a.ts']));
      expect(result.current.selectedFilePath).toBe('src/a.ts');
    });

    it('should ignore invalid file path in search params', async () => {
      const { result } = await renderFileSelection(changesUrl(['nonexistent.ts']));
      expect(result.current.selectedFilePath).toBeNull();
    });

    it('should update search params when navigating', async () => {
      const { router, navigateTo } = await renderFileSelection();
      navigateTo('src/a.ts');
      await waitFor(() => {
        expect(router.state.location.search).toMatchObject({ file: ['src/a.ts'] });
      });
    });

    it('should respond to browser back/forward navigation', async () => {
      const { result, router, navigateTo } = await renderFileSelection();
      navigateTo('src/a.ts');
      await waitFor(() => {
        expect(result.current.selectedFilePath).toBe('src/a.ts');
      });

      navigateTo('src/b.ts');
      await waitFor(() => {
        expect(result.current.selectedFilePath).toBe('src/b.ts');
      });

      router.history.back();
      await waitFor(() => {
        expect(result.current.selectedFilePath).toBe('src/a.ts');
      });
    });
  });

  describe('review state', () => {
    it('should not mutate review state when selecting a file', async () => {
      const { result, navigateTo } = await renderFileSelection();
      navigateTo('src/b.ts');
      await waitFor(() => {
        expect(result.current.selectedFilePath).toBe('src/b.ts');
      });
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('gr-review'));
      expect(keys).toEqual([]);
    });

    it('should not mutate review state on deep link', async () => {
      const { result } = await renderFileSelection(changesUrl(['src/b.ts']));
      await waitFor(() => {
        expect(result.current.selectedFilePath).toBe('src/b.ts');
      });
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('gr-review'));
      expect(keys).toEqual([]);
    });
  });
});
