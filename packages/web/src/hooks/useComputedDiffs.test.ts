// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiffResponse } from '@greppa/core';
import type { DiffMapping, DiffWorkerResponse } from '../workers/diffProtocol';
import { resetDiffWorkerForTesting } from './useDiffComputation';
import { useComputedDiffs } from './useComputedDiffs';

const messageHandlers = new Set<(event: MessageEvent) => void>();
const mockPostMessage = vi.fn();

const makeDiffResponse = (path: string): DiffResponse => ({
  path,
  changeType: 'modified',
  oldContent: `old ${path}`,
  newContent: `new ${path}`,
});

const sampleChanges: DiffMapping[] = [
  {
    original: { startLineNumber: 1, endLineNumberExclusive: 2 },
    modified: { startLineNumber: 1, endLineNumberExclusive: 2 },
    innerChanges: null,
  },
];

vi.stubGlobal(
  'Worker',
  class {
    postMessage = mockPostMessage.mockImplementation((request: { requestId: string; filePath: string }) => {
      const response: DiffWorkerResponse = {
        type: 'diff-result',
        requestId: request.requestId,
        filePath: request.filePath,
        changes: sampleChanges,
        hitTimeout: false,
        error: null,
      };
      setTimeout(() => {
        for (const handler of messageHandlers) {
          handler({ data: response } as MessageEvent);
        }
      }, 0);
    });
    addEventListener = vi.fn(
      (_type: string, handler: (event: MessageEvent) => void) => {
        if (_type === 'message') {
          messageHandlers.add(handler);
        }
      },
    );
    removeEventListener = vi.fn(
      (_type: string, handler: (event: MessageEvent) => void) => {
        if (_type === 'message') {
          messageHandlers.delete(handler);
        }
      },
    );
    terminate = vi.fn();
  },
);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useComputedDiffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageHandlers.clear();
    resetDiffWorkerForTesting();
    vi.spyOn(globalThis, 'fetch').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetDiffWorkerForTesting();
  });

  it('returns empty array when no paths', () => {
    const { result } = renderHook(
      () => useComputedDiffs([], null, 'old', 'new'),
      { wrapper: createWrapper() },
    );

    expect(result.current).toEqual({ diffs: [], failedPaths: [] });
  });

  it('fetches and computes diffs for committed paths', async () => {
    const response = makeDiffResponse('src/index.ts');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    } as Response);

    const { result } = renderHook(
      () => useComputedDiffs(['src/index.ts'], 'committed', 'HEAD~1', 'HEAD'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.diffs).toHaveLength(1);
    });

    expect(result.current.diffs[0]?.path).toBe('src/index.ts');
    expect(result.current.diffs[0]?.changeType).toBe('modified');
  });

  it('fetches and computes diffs for multiple paths', async () => {
    vi.mocked(fetch).mockImplementation((url) => {
      const path = (url as string).replace('/api/diff/HEAD~1/HEAD/', '');
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(makeDiffResponse(decodeURIComponent(path))),
      } as Response);
    });

    const paths = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
    const { result } = renderHook(
      () => useComputedDiffs(paths, 'committed', 'HEAD~1', 'HEAD'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.diffs).toHaveLength(3);
    });

    expect(result.current.diffs.map((d) => d.path)).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  });

  it('fetches worktree diffs when source is worktree', async () => {
    const response = makeDiffResponse('src/index.ts');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    } as Response);

    const { result } = renderHook(
      () => useComputedDiffs(['src/index.ts'], 'worktree', '', ''),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.diffs).toHaveLength(1);
    });

    expect(fetch).toHaveBeenCalledWith('/api/worktree/diff/src/index.ts');
  });

  it('preserves path order in output', async () => {
    vi.mocked(fetch).mockImplementation((url) => {
      const path = (url as string).replace('/api/diff/a/b/', '');
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(makeDiffResponse(decodeURIComponent(path))),
      } as Response);
    });

    const paths = ['z.ts', 'a.ts', 'm.ts'];
    const { result } = renderHook(
      () => useComputedDiffs(paths, 'committed', 'a', 'b'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.diffs).toHaveLength(3);
    });

    expect(result.current.diffs.map((d) => d.path)).toEqual(['z.ts', 'a.ts', 'm.ts']);
  });

  it('reports failed paths when fetch errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(
      () => useComputedDiffs(['src/broken.ts'], 'committed', 'HEAD~1', 'HEAD'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.failedPaths).toEqual(['src/broken.ts']);
    });

    expect(result.current.diffs).toEqual([]);
  });
});
