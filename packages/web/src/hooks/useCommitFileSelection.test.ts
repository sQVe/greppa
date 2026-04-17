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
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseSearch, stringifySearch } from '../router';
import { cacheState, clearAllStateCaches, stateCache } from '../stateCache';
import { useCommitFileSelection } from './useCommitFileSelection';

type HookResult = ReturnType<typeof useCommitFileSelection>;

const commitsSearch = z.object({
  s: fallback(z.string(), '').default(''),
  commits: fallback(z.array(z.string()), []).default([]),
  commitFile: fallback(z.array(z.string()), []).default([]),
});

const renderHook = async (initialLocation = '/commits') => {
  const resultRef: RefObject<HookResult | null> = { current: null };

  const HookHost = () => {
    resultRef.current = useCommitFileSelection();
    return createElement('div', { 'data-testid': 'host' });
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
    expect(screen.getByTestId('host')).toBeDefined();
  });

  return { result: resultRef as RefObject<HookResult>, router };
};

afterEach(() => {
  cleanup();
  clearAllStateCaches();
});

describe('useCommitFileSelection', () => {
  it('starts with no entries', async () => {
    const { result } = await renderHook();
    expect(result.current.entries).toEqual([]);
    expect(result.current.isSelected('sha1', 'a.ts')).toBe(false);
  });

  it('decodes entries from URL', async () => {
    const { result } = await renderHook(
      '/commits?commitFile=sha1:src/a.ts&commitFile=sha2:src/b.ts',
    );
    expect(result.current.entries).toEqual([
      { sha: 'sha1', path: 'src/a.ts' },
      { sha: 'sha2', path: 'src/b.ts' },
    ]);
    expect(result.current.isSelected('sha1', 'src/a.ts')).toBe(true);
    expect(result.current.isSelected('sha2', 'src/b.ts')).toBe(true);
  });

  it('toggle adds an entry', async () => {
    const { result, router } = await renderHook();
    await act(async () => {
      result.current.toggle('sha1', 'src/a.ts');
    });
    await waitFor(() => {
      expect(result.current.isSelected('sha1', 'src/a.ts')).toBe(true);
    });
    expect(router.state.location.search).toMatchObject({
      commitFile: ['sha1:src/a.ts'],
    });
  });

  it('toggle removes an existing entry', async () => {
    const { result } = await renderHook('/commits?commitFile=sha1:src/a.ts');
    await act(async () => {
      result.current.toggle('sha1', 'src/a.ts');
    });
    await waitFor(() => {
      expect(result.current.isSelected('sha1', 'src/a.ts')).toBe(false);
    });
    expect(result.current.entries).toEqual([]);
  });

  it('same path under two different shas produces two entries', async () => {
    const { result } = await renderHook();
    await act(async () => {
      result.current.toggle('sha1', 'src/a.ts');
    });
    await act(async () => {
      result.current.toggle('sha2', 'src/a.ts');
    });
    await waitFor(() => {
      expect(result.current.entries).toEqual([
        { sha: 'sha1', path: 'src/a.ts' },
        { sha: 'sha2', path: 'src/a.ts' },
      ]);
    });
  });

  it('toggle with no other selection writes plain commitFile params, not a state id', async () => {
    const { result, router } = await renderHook();

    await act(async () => {
      result.current.toggle('sha1', 'src/a.ts');
    });

    await waitFor(() => {
      expect(result.current.isSelected('sha1', 'src/a.ts')).toBe(true);
    });

    const search = router.state.location.search as { s?: string; commitFile?: string[] };
    expect(search.s ?? '').toBe('');
    expect(search.commitFile).toEqual(['sha1:src/a.ts']);
  });

  it('toggle survives a state-id URL by minting a new state id', async () => {
    const seededId = 'seed-cf';
    cacheState(seededId, {
      file: ['src/x.ts'],
      wt: ['src/y.ts'],
      commits: ['aaa'],
      commitFile: [],
    });
    const { result, router } = await renderHook(`/commits?s=${seededId}`);

    await act(async () => {
      result.current.toggle('aaa', 'src/a.ts');
    });

    await waitFor(() => {
      expect(result.current.isSelected('aaa', 'src/a.ts')).toBe(true);
    });

    const newId = (router.state.location.search as { s: string }).s;
    expect(newId).toBeTruthy();
    expect(newId).not.toBe(seededId);
    const payload = stateCache.get(newId);
    expect(payload).toBeDefined();
    expect(payload?.file).toEqual(['src/x.ts']);
    expect(payload?.wt).toEqual(['src/y.ts']);
    expect(payload?.commits).toEqual(['aaa']);
    expect(payload?.commitFile).toEqual(['aaa:src/a.ts']);
  });

  it('toggle does not modify commits param', async () => {
    const { result, router } = await renderHook('/commits?commits=aaa&commits=bbb');
    await act(async () => {
      result.current.toggle('aaa', 'src/a.ts');
    });
    await waitFor(() => {
      expect(result.current.isSelected('aaa', 'src/a.ts')).toBe(true);
    });
    expect(router.state.location.search).toMatchObject({
      commits: ['aaa', 'bbb'],
      commitFile: ['aaa:src/a.ts'],
    });
  });
});
