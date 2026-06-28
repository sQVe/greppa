import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { zodValidator, fallback } from '@tanstack/zod-adapter';
// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { RefObject } from 'react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { parseSearch, stringifySearch } from '../router';
import { cacheState, clearAllStateCaches } from '../stateCache';
import { useMultiSelect } from './useMultiSelect';

vi.mock('nanoid', () => {
  let counter = 0;
  return { nanoid: () => `t${++counter}` };
});

type HookResult = ReturnType<typeof useMultiSelect>;

const committedFilePaths = ['src/index.ts', 'src/utils.ts', 'README.md'];
const worktreeFilePaths = ['config.ts', 'lib/helpers.ts'];

const changesSearch = z.object({
  s: fallback(z.string(), '').default(''),
  file: fallback(z.array(z.string()), []).default([]),
});

const worktreeSearch = z.object({
  s: fallback(z.string(), '').default(''),
  wt: fallback(z.array(z.string()), []).default([]),
});

const sectionUrl = (state: { file?: string[]; wt?: string[] }) => {
  const full = { file: state.file ?? [], wt: state.wt ?? [], commits: [], commitFile: [] };
  const id = `test-${Math.random().toString(36).slice(2, 6)}`;
  cacheState(id, full);
  if (full.wt.length > 0) {
    return `/worktree?s=${id}`;
  }
  return `/changes?s=${id}`;
};

const renderMultiSelect = async (initialLocation = '/changes') => {
  const resultRef: RefObject<HookResult | null> = { current: null };

  const HookHost = () => {
    const hookResult = useMultiSelect({ committedFilePaths, worktreeFilePaths });
    resultRef.current = hookResult;
    return createElement('div', { 'data-testid': 'hook-host' });
  };

  const rootRoute = createRootRoute({ component: HookHost });
  const changesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/changes',
    validateSearch: zodValidator(changesSearch),
  });
  const worktreeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/worktree',
    validateSearch: zodValidator(worktreeSearch),
  });
  const routeTree = rootRoute.addChildren([changesRoute, worktreeRoute]);
  const history = createMemoryHistory({ initialEntries: [initialLocation] });
  const router = createRouter({ routeTree, history, parseSearch, stringifySearch });

  render(createElement(RouterProvider, { router }));
  await waitFor(() => {
    expect(screen.getByTestId('hook-host')).toBeDefined();
  });

  return { result: resultRef as RefObject<HookResult>, router };
};

afterEach(() => {
  cleanup();
  clearAllStateCaches();
});

describe('useMultiSelect', () => {
  describe('initial state', () => {
    it('should have empty selection', async () => {
      const { result } = await renderMultiSelect();

      expect(result.current.selectedPaths).toEqual(new Set());
    });

    it('should have no active source', async () => {
      const { result } = await renderMultiSelect();

      expect(result.current.activeSource).toBeNull();
    });

    it('should report not multi-selecting', async () => {
      const { result } = await renderMultiSelect();

      expect(result.current.isMultiSelect).toBe(false);
    });
  });

  describe('URL hydration', () => {
    it('should read single file from URL', async () => {
      const { result } = await renderMultiSelect(sectionUrl({ file: ['src/index.ts'] }));

      expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts']));
      expect(result.current.activeSource).toBe('committed');
    });

    it('should read multiple files from URL', async () => {
      const { result } = await renderMultiSelect(
        sectionUrl({ file: ['src/index.ts', 'README.md'] }),
      );

      expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts', 'README.md']));
      expect(result.current.isMultiSelect).toBe(true);
    });

    it('should read worktree file from URL', async () => {
      const { result } = await renderMultiSelect(sectionUrl({ wt: ['config.ts'] }));

      expect(result.current.selectedPaths).toEqual(new Set(['config.ts']));
      expect(result.current.activeSource).toBe('worktree');
    });

    it('should resolve * sentinel to all committed files', async () => {
      const { result } = await renderMultiSelect(sectionUrl({ file: ['*'] }));

      expect(result.current.selectedPaths).toEqual(new Set(committedFilePaths));
      expect(result.current.isMultiSelect).toBe(true);
    });

    it('should resolve * sentinel to all worktree files', async () => {
      const { result } = await renderMultiSelect(sectionUrl({ wt: ['*'] }));

      expect(result.current.selectedPaths).toEqual(new Set(worktreeFilePaths));
    });
  });

  describe('select', () => {
    it('should replace selection with a single path', async () => {
      const { result } = await renderMultiSelect();

      act(() => {
        result.current.select('src/index.ts', 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts']));
      });
    });

    it('should clear previous selection', async () => {
      const { result } = await renderMultiSelect();
      act(() => {
        result.current.select('src/index.ts', 'committed');
      });
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts']));
      });

      act(() => {
        result.current.select('src/utils.ts', 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/utils.ts']));
      });
    });

    it('should set active source', async () => {
      const { result } = await renderMultiSelect();

      act(() => {
        result.current.select('config.ts', 'worktree');
      });

      await waitFor(() => {
        expect(result.current.activeSource).toBe('worktree');
      });
    });

    it('should report not multi-selecting for single selection', async () => {
      const { result } = await renderMultiSelect();

      act(() => {
        result.current.select('src/index.ts', 'committed');
      });

      await waitFor(() => {
        expect(result.current.isMultiSelect).toBe(false);
      });
    });

    it('should use pushState for navigation', async () => {
      const { result, router } = await renderMultiSelect();

      act(() => {
        result.current.select('src/index.ts', 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts']));
      });

      act(() => {
        result.current.select('src/utils.ts', 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/utils.ts']));
      });

      router.history.back();
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts']));
      });
    });

    it('should produce short URL with s param', async () => {
      const { result, router } = await renderMultiSelect();

      act(() => {
        result.current.select('src/index.ts', 'committed');
      });

      await waitFor(() => {
        const search = router.state.location.search as Record<string, unknown>;
        expect(search.s).toBeDefined();
        expect(typeof search.s).toBe('string');
        expect((search.s as string).length).toBeGreaterThan(0);
      });
    });

    it('should navigate to /changes for committed files', async () => {
      const { result, router } = await renderMultiSelect();

      act(() => {
        result.current.select('src/index.ts', 'committed');
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/changes');
      });
    });

    it('should navigate to /worktree for worktree files', async () => {
      const { result, router } = await renderMultiSelect();

      act(() => {
        result.current.select('config.ts', 'worktree');
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/worktree');
      });
    });
  });

  describe('toggle', () => {
    it('should add a path to the selection', async () => {
      const { result } = await renderMultiSelect(sectionUrl({ file: ['src/index.ts'] }));

      act(() => {
        result.current.toggle('src/utils.ts', 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts', 'src/utils.ts']));
      });
    });

    it('should remove a path already in the selection', async () => {
      const { result } = await renderMultiSelect(
        sectionUrl({ file: ['src/index.ts', 'src/utils.ts'] }),
      );

      act(() => {
        result.current.toggle('src/index.ts', 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/utils.ts']));
      });
    });

    it('should report multi-selecting when more than one selected', async () => {
      const { result } = await renderMultiSelect(sectionUrl({ file: ['src/index.ts'] }));

      act(() => {
        result.current.toggle('src/utils.ts', 'committed');
      });

      await waitFor(() => {
        expect(result.current.isMultiSelect).toBe(true);
      });
    });

    it('should reset selection when toggling from a different source', async () => {
      const { result } = await renderMultiSelect(sectionUrl({ file: ['src/index.ts'] }));

      act(() => {
        result.current.toggle('config.ts', 'worktree');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['config.ts']));
        expect(result.current.activeSource).toBe('worktree');
      });
    });

    it('should use replaceState for navigation', async () => {
      const { result, router } = await renderMultiSelect();
      act(() => {
        result.current.select('src/index.ts', 'committed');
      });
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts']));
      });

      act(() => {
        result.current.toggle('src/utils.ts', 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts', 'src/utils.ts']));
      });

      router.history.back();
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set());
      });
    });
  });

  describe('selectAll', () => {
    it('should write * sentinel to URL', async () => {
      const { result, router } = await renderMultiSelect();

      act(() => {
        result.current.selectAll(committedFilePaths, 'committed');
      });

      await waitFor(() => {
        expect(router.state.location.search).toMatchObject({ file: ['*'] });
      });
    });

    it('should resolve * sentinel to all committed file paths', async () => {
      const { result } = await renderMultiSelect();

      act(() => {
        result.current.selectAll(committedFilePaths, 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(committedFilePaths));
      });
    });

    it('should set active source', async () => {
      const { result } = await renderMultiSelect();

      act(() => {
        result.current.selectAll(worktreeFilePaths, 'worktree');
      });

      await waitFor(() => {
        expect(result.current.activeSource).toBe('worktree');
      });
    });

    it('should report multi-selecting when given multiple paths', async () => {
      const { result } = await renderMultiSelect();

      act(() => {
        result.current.selectAll(committedFilePaths, 'committed');
      });

      await waitFor(() => {
        expect(result.current.isMultiSelect).toBe(true);
      });
    });

    it('should use replaceState for navigation', async () => {
      const { result, router } = await renderMultiSelect();
      act(() => {
        result.current.select('src/index.ts', 'committed');
      });
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts']));
      });

      act(() => {
        result.current.selectAll(committedFilePaths, 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(committedFilePaths));
      });

      router.history.back();
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set());
      });
    });
  });

  describe('toggleAll', () => {
    it('should add all given paths to existing selection', async () => {
      const { result } = await renderMultiSelect(sectionUrl({ file: ['src/index.ts'] }));

      act(() => {
        result.current.toggleAll(['src/utils.ts', 'README.md'], 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(
          new Set(['src/index.ts', 'src/utils.ts', 'README.md']),
        );
      });
    });

    it('should remove paths that are all already selected', async () => {
      const { result } = await renderMultiSelect(
        sectionUrl({ file: ['src/index.ts', 'src/utils.ts', 'README.md'] }),
      );

      act(() => {
        result.current.toggleAll(['src/index.ts', 'src/utils.ts'], 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['README.md']));
      });
    });

    it('should add paths when not all are already selected', async () => {
      const { result } = await renderMultiSelect(
        sectionUrl({ file: ['src/index.ts', 'src/utils.ts'] }),
      );

      act(() => {
        result.current.toggleAll(['src/utils.ts', 'README.md'], 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(
          new Set(['src/index.ts', 'src/utils.ts', 'README.md']),
        );
      });
    });

    it('should reset selection when toggling from a different source', async () => {
      const { result } = await renderMultiSelect(sectionUrl({ file: ['src/index.ts'] }));

      act(() => {
        result.current.toggleAll(['config.ts', 'lib/helpers.ts'], 'worktree');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['config.ts', 'lib/helpers.ts']));
        expect(result.current.activeSource).toBe('worktree');
      });
    });
  });

  describe('selectRange', () => {
    it('should select all paths between anchor and target inclusive', async () => {
      const { result } = await renderMultiSelect();
      act(() => {
        result.current.select('src/utils.ts', 'committed');
      });
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/utils.ts']));
      });

      act(() => {
        result.current.selectRange('README.md', committedFilePaths, 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/utils.ts', 'README.md']));
      });
    });

    it('should select range in reverse direction', async () => {
      const { result } = await renderMultiSelect();
      act(() => {
        result.current.select('README.md', 'committed');
      });
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['README.md']));
      });

      act(() => {
        result.current.selectRange('src/index.ts', committedFilePaths, 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(committedFilePaths));
      });
    });

    it('should select only target when no anchor exists', async () => {
      const { result } = await renderMultiSelect();

      act(() => {
        result.current.selectRange('src/utils.ts', committedFilePaths, 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/utils.ts']));
      });
    });

    it('should preserve anchor for subsequent range selections', async () => {
      const { result } = await renderMultiSelect();
      act(() => {
        result.current.select('src/index.ts', 'committed');
      });
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts']));
      });

      act(() => {
        result.current.selectRange('src/utils.ts', committedFilePaths, 'committed');
      });
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts', 'src/utils.ts']));
      });

      act(() => {
        result.current.selectRange('README.md', committedFilePaths, 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(committedFilePaths));
      });
    });

    it('should reset selection when source changes', async () => {
      const { result } = await renderMultiSelect();
      act(() => {
        result.current.select('src/index.ts', 'committed');
      });
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts']));
      });

      act(() => {
        result.current.selectRange('lib/helpers.ts', worktreeFilePaths, 'worktree');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['lib/helpers.ts']));
        expect(result.current.activeSource).toBe('worktree');
      });
    });

    it('should use replaceState for navigation', async () => {
      const { result, router } = await renderMultiSelect();
      act(() => {
        result.current.select('src/index.ts', 'committed');
      });
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(['src/index.ts']));
      });

      act(() => {
        result.current.selectRange('README.md', committedFilePaths, 'committed');
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set(committedFilePaths));
      });

      router.history.back();
      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set());
      });
    });
  });

  describe('clear', () => {
    it('should empty the selection', async () => {
      const { result } = await renderMultiSelect(
        sectionUrl({ file: ['src/index.ts', 'src/utils.ts'] }),
      );

      act(() => {
        result.current.clear();
      });

      await waitFor(() => {
        expect(result.current.selectedPaths).toEqual(new Set());
      });
    });

    it('should reset active source', async () => {
      const { result } = await renderMultiSelect(sectionUrl({ file: ['src/index.ts'] }));

      act(() => {
        result.current.clear();
      });

      await waitFor(() => {
        expect(result.current.activeSource).toBeNull();
      });
    });
  });
});
