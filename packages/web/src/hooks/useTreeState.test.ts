// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { useTreeState } from './useTreeState';

const files: FileNode[] = [
  {
    path: 'src',
    name: 'src',
    type: 'directory',
    children: [
      { path: 'src/index.ts', name: 'index.ts', type: 'file', changeType: 'modified' },
      {
        path: 'src/utils',
        name: 'utils',
        type: 'directory',
        children: [{ path: 'src/utils/a.ts', name: 'a.ts', type: 'file', changeType: 'added' }],
      },
    ],
  },
];

describe('useTreeState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('expandedKeys includes overlay keys even when the same path is in collapsedPaths', () => {
    localStorage.setItem(
      'gr-review:committed',
      JSON.stringify({ collapsedPaths: ['src'], reviewedPaths: [], reviewedCommitFiles: [] }),
    );

    const overlay = new Set(['src']);
    const { result } = renderHook(() => useTreeState(files, 'committed', overlay));

    expect(result.current.expandedKeys.has('src')).toBe(true);
  });

  it('handleExpandedKeysChange strips overlay keys before persisting collapsedPaths', () => {
    localStorage.setItem(
      'gr-review:committed',
      JSON.stringify({ collapsedPaths: ['src'], reviewedPaths: [], reviewedCommitFiles: [] }),
    );

    const overlay = new Set(['src']);
    const { result } = renderHook(() => useTreeState(files, 'committed', overlay));

    act(() => {
      result.current.handleExpandedKeysChange(new Set<string | number>(['src', 'src/utils']));
    });

    const stored = JSON.parse(localStorage.getItem('gr-review:committed') ?? '{}');
    expect(stored.collapsedPaths).toEqual(['src']);
  });

  it('clearing the overlay restores prior expansion without mutating collapsedPaths', () => {
    localStorage.setItem(
      'gr-review:committed',
      JSON.stringify({ collapsedPaths: ['src'], reviewedPaths: [], reviewedCommitFiles: [] }),
    );

    const overlay = new Set(['src']);
    const { result, rerender } = renderHook(
      ({ forced }: { forced: ReadonlySet<string> | undefined }) =>
        useTreeState(files, 'committed', forced),
      { initialProps: { forced: overlay as ReadonlySet<string> | undefined } },
    );
    expect(result.current.expandedKeys.has('src')).toBe(true);

    rerender({ forced: undefined });

    expect(result.current.expandedKeys.has('src')).toBe(false);
    const stored = JSON.parse(localStorage.getItem('gr-review:committed') ?? '{}');
    expect(stored.collapsedPaths).toEqual(['src']);
  });

  it('without overlay, handleExpandedKeysChange persists exactly the inverted set', () => {
    const { result } = renderHook(() => useTreeState(files, 'committed'));

    act(() => {
      result.current.handleExpandedKeysChange(new Set<string | number>(['src']));
    });

    const stored = JSON.parse(localStorage.getItem('gr-review:committed') ?? '{}');
    expect(new Set(stored.collapsedPaths)).toEqual(new Set(['src/utils']));
  });
});
