// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CommitEntry } from '@greppa/core';

import { useCommitSelection } from './useCommitSelection';

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

describe('useCommitSelection', () => {
  it('starts with no selection', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    expect(result.current.selectedShas.size).toBe(0);
    expect(result.current.isActive).toBe(false);
    expect(result.current.diffRange).toBeNull();
  });

  it('selects a single commit on click without shift', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('bbb', { shiftKey: false, metaKey: false }); });

    expect(result.current.selectedShas).toEqual(new Set(['bbb']));
    expect(result.current.isActive).toBe(true);
  });

  it('replaces selection on click without shift', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('aaa', { shiftKey: false, metaKey: false }); });
    act(() => { result.current.selectCommit('ccc', { shiftKey: false, metaKey: false }); });

    expect(result.current.selectedShas).toEqual(new Set(['ccc']));
  });

  it('selects range on shift+click', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('aaa', { shiftKey: false, metaKey: false }); });
    act(() => { result.current.selectCommit('ccc', { shiftKey: true, metaKey: false }); });

    expect(result.current.selectedShas).toEqual(new Set(['aaa', 'bbb', 'ccc']));
  });

  it('selects range in reverse order on shift+click', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('ccc', { shiftKey: false, metaKey: false }); });
    act(() => { result.current.selectCommit('aaa', { shiftKey: true, metaKey: false }); });

    expect(result.current.selectedShas).toEqual(new Set(['aaa', 'bbb', 'ccc']));
  });

  it('computes diffRange for single commit', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('bbb', { shiftKey: false, metaKey: false }); });

    expect(result.current.diffRange).toEqual({
      oldRef: 'bbb~1',
      newRef: 'bbb',
    });
  });

  it('computes diffRange for commit range', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('aaa', { shiftKey: false, metaKey: false }); });
    act(() => { result.current.selectCommit('ccc', { shiftKey: true, metaKey: false }); });

    expect(result.current.diffRange).toEqual({
      oldRef: 'ccc~1',
      newRef: 'aaa',
    });
  });

  it('clears selection', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('aaa', { shiftKey: false, metaKey: false }); });
    act(() => { result.current.clear(); });

    expect(result.current.selectedShas.size).toBe(0);
    expect(result.current.isActive).toBe(false);
    expect(result.current.diffRange).toBeNull();
  });
});
