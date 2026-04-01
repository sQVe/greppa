// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import type { DiffMapping, DiffWorkerResponse } from '../workers/diffProtocol';
import { resetDiffWorkerForTesting, useDiffComputation } from './useDiffComputation';

let messageHandler: ((event: MessageEvent) => void) | null = null;

const mockPostMessage = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
const mockTerminate = vi.fn();

let workerConstructCount = 0;

const sampleChanges: DiffMapping[] = [
  {
    original: { startLineNumber: 2, endLineNumberExclusive: 3 },
    modified: { startLineNumber: 2, endLineNumberExclusive: 3 },
    innerChanges: [
      {
        originalRange: { startLineNumber: 2, startColumn: 11, endLineNumber: 2, endColumn: 12 },
        modifiedRange: { startLineNumber: 2, startColumn: 11, endLineNumber: 2, endColumn: 12 },
      },
    ],
  },
];

vi.stubGlobal(
  'Worker',
  class {
    postMessage = mockPostMessage.mockImplementation(() => {
      const response: DiffWorkerResponse = {
        type: 'diff-result',
        filePath: 'src/foo.ts',
        changes: sampleChanges,
        hitTimeout: false,
      };
      setTimeout(() => {
        messageHandler?.({ data: response } as MessageEvent);
      }, 0);
    });
    addEventListener = mockAddEventListener.mockImplementation(
      (type: string, handler: (event: MessageEvent) => void) => {
        if (type === 'message') {
          messageHandler = handler;
        }
      },
    );
    removeEventListener = mockRemoveEventListener.mockImplementation((type: string) => {
      if (type === 'message') {
        messageHandler = null;
      }
    });
    terminate = mockTerminate;

    constructor() {
      workerConstructCount++;
    }
  },
);

describe('useDiffComputation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    messageHandler = null;
    workerConstructCount = 0;
    resetDiffWorkerForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetDiffWorkerForTesting();
  });

  it('returns null initially', () => {
    const { result } = renderHook(() =>
      useDiffComputation('src/foo.ts', 'const a = 1;\n', 'const a = 2;\n'),
    );

    expect(result.current.changes).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns null when filePath is null', () => {
    const { result } = renderHook(() =>
      useDiffComputation(null, null, null),
    );

    expect(result.current.changes).toBeNull();
  });

  it('returns changes when worker responds', async () => {
    const { result } = renderHook(() =>
      useDiffComputation('src/foo.ts', 'const a = 1;\n', 'const a = 2;\n'),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.changes).toEqual(sampleChanges);
  });

  it('posts diff request to worker', () => {
    renderHook(() =>
      useDiffComputation('src/foo.ts', 'old content', 'new content'),
    );

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'diff',
      filePath: 'src/foo.ts',
      oldContent: 'old content',
      newContent: 'new content',
    });
  });

  it('reuses the same worker across renders', () => {
    const { rerender } = renderHook(
      ({ path }) => useDiffComputation(path, 'old', 'new'),
      { initialProps: { path: 'src/foo.ts' as string | null } },
    );

    rerender({ path: 'src/bar.ts' });

    expect(workerConstructCount).toBe(1);
  });

  it('ignores stale responses after filePath changes', async () => {
    const { result, rerender } = renderHook(
      ({ path }) => useDiffComputation(path, 'old', 'new'),
      { initialProps: { path: 'src/foo.ts' as string | null } },
    );

    rerender({ path: 'src/bar.ts' });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.changes).toBeNull();
  });
});
