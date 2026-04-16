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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { CommitEntry } from '@greppa/core';

import { parseSearch, stringifySearch } from '../router';
import { cacheState, clearAllStateCaches, stateCache } from '../stateCache';
import { useCommitSelection } from './useCommitSelection';

vi.mock('nanoid', () => {
  let counter = 0;
  return { nanoid: () => `t${++counter}` };
});

const makeCommit = (sha: string, abbrev: string): CommitEntry => ({
  sha,
  abbrevSha: abbrev,
  subject: `commit ${abbrev}`,
  author: 'Test',
  date: '2026-04-03T10:00:00+00:00',
});

const commits = [
  makeCommit('aaa', 'a'),
  makeCommit('bbb', 'b'),
  makeCommit('ccc', 'c'),
  makeCommit('ddd', 'd'),
];

type HookResult = ReturnType<typeof useCommitSelection>;

const commitsSearch = z.object({
  s: fallback(z.string(), '').default(''),
  commits: fallback(z.array(z.string()), []).default([]),
  commitFile: fallback(z.array(z.string()), []).default([]),
});

const commitsUrl = (shas: string[]) => {
  const full = { file: [], wt: [], commits: shas, commitFile: [] };
  const id = `test-${Math.random().toString(36).slice(2, 6)}`;
  cacheState(id, full);
  return `/commits?s=${id}`;
};

const renderCommitSelection = async (initialLocation = '/commits') => {
  const resultRef: RefObject<HookResult | null> = { current: null };

  const HookHost = () => {
    const hookResult = useCommitSelection(commits);
    resultRef.current = hookResult;
    return createElement('div', { 'data-testid': 'hook-host' });
  };

  const rootRoute = createRootRoute({ component: HookHost });
  const commitsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/commits',
    validateSearch: zodValidator(commitsSearch),
  });
  const routeTree = rootRoute.addChildren([commitsRoute]);
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

describe('useCommitSelection', () => {
  it('should start with no selection', async () => {
    const { result } = await renderCommitSelection();

    expect(result.current.selectedShas.size).toBe(0);
    expect(result.current.isActive).toBe(false);
    expect(result.current.diffRange).toBeNull();
  });

  it('should read single commit from URL', async () => {
    const { result } = await renderCommitSelection(commitsUrl(['bbb']));

    expect(result.current.selectedShas).toEqual(new Set(['bbb']));
    expect(result.current.isActive).toBe(true);
  });

  it('should select a single commit on click', async () => {
    const { result } = await renderCommitSelection();

    act(() => { result.current.selectCommit('bbb', { shiftKey: false, metaKey: false }); });

    await waitFor(() => {
      expect(result.current.selectedShas).toEqual(new Set(['bbb']));
      expect(result.current.isActive).toBe(true);
    });
  });

  it('should replace selection on plain click', async () => {
    const { result } = await renderCommitSelection();

    act(() => { result.current.selectCommit('aaa', { shiftKey: false, metaKey: false }); });
    await waitFor(() => {
      expect(result.current.selectedShas).toEqual(new Set(['aaa']));
    });

    act(() => { result.current.selectCommit('ccc', { shiftKey: false, metaKey: false }); });

    await waitFor(() => {
      expect(result.current.selectedShas).toEqual(new Set(['ccc']));
    });
  });

  it('should select range on shift+click', async () => {
    const { result } = await renderCommitSelection();

    act(() => { result.current.selectCommit('aaa', { shiftKey: false, metaKey: false }); });
    await waitFor(() => {
      expect(result.current.selectedShas).toEqual(new Set(['aaa']));
    });

    act(() => { result.current.selectCommit('ccc', { shiftKey: true, metaKey: false }); });

    await waitFor(() => {
      expect(result.current.selectedShas).toEqual(new Set(['aaa', 'bbb', 'ccc']));
    });
  });

  it('should toggle on meta+click', async () => {
    const { result } = await renderCommitSelection(commitsUrl(['aaa']));

    act(() => { result.current.selectCommit('bbb', { shiftKey: false, metaKey: true }); });

    await waitFor(() => {
      expect(result.current.selectedShas).toEqual(new Set(['aaa', 'bbb']));
    });
  });

  it('should compute diffRange using next commit as parent', async () => {
    const { result } = await renderCommitSelection(commitsUrl(['bbb']));

    expect(result.current.diffRange).toEqual({
      oldRef: 'ccc',
      newRef: 'bbb',
    });
  });

  it('should fall back to sha~1 for the last commit in the list', async () => {
    const { result } = await renderCommitSelection(commitsUrl(['ddd']));

    expect(result.current.diffRange).toEqual({
      oldRef: 'ddd~1',
      newRef: 'ddd',
    });
  });

  it('should clear selection', async () => {
    const { result } = await renderCommitSelection(commitsUrl(['aaa', 'bbb']));

    act(() => { result.current.clear(); });

    await waitFor(() => {
      expect(result.current.selectedShas.size).toBe(0);
      expect(result.current.isActive).toBe(false);
      expect(result.current.diffRange).toBeNull();
    });
  });

  it('should carry forward commitFile into the new state', async () => {
    const seededId = 'seed-1';
    cacheState(seededId, { file: [], wt: [], commits: ['aaa'], commitFile: ['aaa:src/a.ts'] });
    const { result, router } = await renderCommitSelection(`/commits?s=${seededId}`);

    act(() => { result.current.selectCommit('bbb', { shiftKey: false, metaKey: false }); });

    await waitFor(() => {
      expect(result.current.selectedShas).toEqual(new Set(['bbb']));
    });

    const newId = (router.state.location.search as { s: string }).s;
    expect(newId).toBeTruthy();
    expect(newId).not.toBe(seededId);
    const payload = stateCache.get(newId);
    expect(payload).toBeDefined();
    expect(payload?.commits).toEqual(['bbb']);
    expect(payload?.commitFile).toEqual(['aaa:src/a.ts']);
  });

  it('should navigate to /commits route', async () => {
    const { result, router } = await renderCommitSelection();

    act(() => { result.current.selectCommit('aaa', { shiftKey: false, metaKey: false }); });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/commits');
    });
  });
});
