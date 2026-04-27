// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useReviewState } from './useReviewState';

const defaults = { collapsedPaths: [], reviewedPaths: [], reviewedCommitFiles: [] };

describe('useReviewState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns defaults when localStorage key is missing', () => {
    const { result } = renderHook(() => useReviewState('session-1'));
    expect(result.current.state).toEqual(defaults);
  });

  it('returns defaults when localStorage data fails Schema validation', () => {
    localStorage.setItem(
      'gr-review:session-1',
      JSON.stringify({ collapsedPaths: 'not-an-array', reviewedPaths: 123 }),
    );

    const { result } = renderHook(() => useReviewState('session-1'));
    expect(result.current.state).toEqual(defaults);
  });

  it('returns valid stored data when localStorage contains conforming JSON', () => {
    const stored = {
      collapsedPaths: ['src/utils'],
      reviewedPaths: ['src/index.ts'],
      reviewedCommitFiles: ['abc:src/index.ts'],
    };
    localStorage.setItem('gr-review:session-1', JSON.stringify(stored));

    const { result } = renderHook(() => useReviewState('session-1'));
    expect(result.current.state).toEqual(stored);
  });

  it('set() merges partial updates and persists to localStorage', () => {
    const { result } = renderHook(() => useReviewState('session-1'));

    act(() => {
      result.current.set({ reviewedPaths: ['file-a.ts'] });
    });

    expect(result.current.state).toEqual({
      collapsedPaths: [],
      reviewedPaths: ['file-a.ts'],
      reviewedCommitFiles: [],
    });

    const stored = JSON.parse(localStorage.getItem('gr-review:session-1')!);
    expect(stored.reviewedPaths).toEqual(['file-a.ts']);
    expect(stored.collapsedPaths).toEqual([]);
  });

  it('different session IDs produce isolated state', () => {
    const { result: result1 } = renderHook(() => useReviewState('session-1'));
    const { result: result2 } = renderHook(() => useReviewState('session-2'));

    act(() => {
      result1.current.set({ reviewedPaths: ['a.ts'] });
    });

    expect(result1.current.state.reviewedPaths).toEqual(['a.ts']);
    expect(result2.current.state.reviewedPaths).toEqual([]);
  });

  it('persists reviewedCommitFiles entries to localStorage independently of reviewedPaths', () => {
    const { result } = renderHook(() => useReviewState('committed'));

    act(() => {
      result.current.set({ reviewedCommitFiles: ['abc123:src/foo.ts'] });
    });

    expect(result.current.state).toEqual({
      collapsedPaths: [],
      reviewedPaths: [],
      reviewedCommitFiles: ['abc123:src/foo.ts'],
    });

    const stored = JSON.parse(localStorage.getItem('gr-review:committed')!);
    expect(stored.reviewedCommitFiles).toEqual(['abc123:src/foo.ts']);
    expect(stored.reviewedPaths).toEqual([]);
  });

  it('same session ID from multiple components shares state', () => {
    const { result: result1 } = renderHook(() => useReviewState('session-1'));
    const { result: result2 } = renderHook(() => useReviewState('session-1'));

    act(() => {
      result1.current.set({ collapsedPaths: ['src/lib'] });
    });

    expect(result2.current.state.collapsedPaths).toEqual(['src/lib']);
  });
});
