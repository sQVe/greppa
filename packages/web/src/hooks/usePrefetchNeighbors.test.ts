// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { usePrefetchNeighbors } from './usePrefetchNeighbors';

const file = (path: string, sizeTier?: FileNode['sizeTier']): FileNode => ({
  path,
  name: path,
  type: 'file',
  sizeTier,
});

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('usePrefetchNeighbors', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ path: 'stub', changeType: 'modified' }),
    } as Response);
  });

  it('prefetches neighbors with the canonical diff query key', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery');
    const files = [file('a.ts'), file('b.ts'), file('c.ts'), file('d.ts')];

    renderHook(
      () => {
        usePrefetchNeighbors({
          orderedFiles: files,
          selectedPath: 'a.ts',
          oldRef: 'HEAD~1',
          newRef: 'HEAD',
          depth: 2,
        });
      },
      { wrapper: createWrapper(queryClient) },
    );

    const queryKeys = prefetchSpy.mock.calls.map((call) => call[0].queryKey);
    expect(queryKeys).toEqual([
      ['diff', 'HEAD~1', 'HEAD', 'b.ts'],
      ['diff', 'HEAD~1', 'HEAD', 'c.ts'],
    ]);
  });

  it('does not re-fire when re-rendered with an equivalent ordered list', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery');
    const wrapper = createWrapper(queryClient);

    const { rerender } = renderHook(
      ({ orderedFiles }: { orderedFiles: FileNode[] }) => {
        usePrefetchNeighbors({
          orderedFiles,
          selectedPath: 'a.ts',
          oldRef: 'HEAD~1',
          newRef: 'HEAD',
          depth: 2,
        });
      },
      {
        wrapper,
        initialProps: {
          orderedFiles: [file('a.ts'), file('b.ts'), file('c.ts')],
        },
      },
    );

    expect(prefetchSpy).toHaveBeenCalledTimes(2);
    prefetchSpy.mockClear();

    rerender({
      orderedFiles: [file('a.ts'), file('b.ts'), file('c.ts')],
    });

    expect(prefetchSpy).not.toHaveBeenCalled();
  });
});
