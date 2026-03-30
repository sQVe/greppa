// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import type { DiffFile } from '../../fixtures/types';
import type { HighlightResponse } from '../../workers/highlightProtocol';
import { resetWorkerForTesting, useSyntaxHighlighting } from './useSyntaxHighlighting';

let messageHandler: ((event: MessageEvent) => void) | null = null;

const mockPostMessage = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
const mockTerminate = vi.fn();

let workerConstructCount = 0;

vi.stubGlobal(
  'Worker',
  class {
    postMessage = mockPostMessage.mockImplementation(() => {
      const response: HighlightResponse = {
        type: 'highlight-result',
        filePath: 'src/foo.ts',
        tokens: {
          'context:1:1': [{ content: 'const a = 1;', color: '#f00' }],
          'added::2': [{ content: 'const b = 2;', color: '#0f0' }],
        },
      };
      setTimeout(() => {
        messageHandler?.({ data: response } as MessageEvent);
      }, 0);
    });
    addEventListener = mockAddEventListener.mockImplementation(
      (_type: string, handler: (event: MessageEvent) => void) => {
        messageHandler = handler;
      },
    );
    removeEventListener = mockRemoveEventListener.mockImplementation(() => {
      messageHandler = null;
    });
    terminate = mockTerminate;

    constructor() {
      workerConstructCount++;
    }
  },
);

const singleHunkDiff: DiffFile = {
  path: 'src/foo.ts',
  changeType: 'modified',
  language: 'typescript',
  hunks: [
    {
      header: '@@ -1,3 +1,4 @@',
      oldStart: 1,
      oldCount: 3,
      newStart: 1,
      newCount: 4,
      lines: [
        { lineType: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'const a = 1;' },
        { lineType: 'added', oldLineNumber: null, newLineNumber: 2, content: 'const b = 2;' },
      ],
    },
  ],
};

describe('useSyntaxHighlighting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    messageHandler = null;
    workerConstructCount = 0;
    resetWorkerForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetWorkerForTesting();
  });

  it('returns null token map initially', () => {
    const { result } = renderHook(() => useSyntaxHighlighting(singleHunkDiff, 'catppuccin-mocha'));
    expect(result.current).toBeNull();
  });

  it('returns null when diff is null', () => {
    const { result } = renderHook(() => useSyntaxHighlighting(null, 'catppuccin-mocha'));
    expect(result.current).toBeNull();
  });

  it('updates token map when worker responds', async () => {
    const { result } = renderHook(() => useSyntaxHighlighting(singleHunkDiff, 'catppuccin-mocha'));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current).not.toBeNull();
    expect(result.current?.get('context:1:1')).toEqual([
      { content: 'const a = 1;', color: '#f00' },
    ]);
  });

  it('posts highlight request to worker', () => {
    renderHook(() => useSyntaxHighlighting(singleHunkDiff, 'catppuccin-mocha'));

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'highlight',
        filePath: 'src/foo.ts',
        language: 'typescript',
        theme: 'catppuccin-mocha',
      }),
    );
  });

  it('reuses the same worker across renders', () => {
    const { rerender } = renderHook(
      ({ diff }) => useSyntaxHighlighting(diff, 'catppuccin-mocha'),
      { initialProps: { diff: singleHunkDiff as DiffFile | null } },
    );

    rerender({ diff: { ...singleHunkDiff, path: 'src/bar.ts' } });

    expect(workerConstructCount).toBe(1);
  });
});
