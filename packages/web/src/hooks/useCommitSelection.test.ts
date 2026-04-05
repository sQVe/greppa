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
  it('should start with no selection', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    expect(result.current.selectedShas.size).toBe(0);
    expect(result.current.isActive).toBe(false);
    expect(result.current.diffRange).toBeNull();
  });

  it('should select a single commit on click without shift', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('bbb', { shiftKey: false, metaKey: false }); });

    expect(result.current.selectedShas).toEqual(new Set(['bbb']));
    expect(result.current.isActive).toBe(true);
  });

  it('should replace selection on click without shift', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('aaa', { shiftKey: false, metaKey: false }); });
    act(() => { result.current.selectCommit('ccc', { shiftKey: false, metaKey: false }); });

    expect(result.current.selectedShas).toEqual(new Set(['ccc']));
  });

  it('should select range on shift+click', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('aaa', { shiftKey: false, metaKey: false }); });
    act(() => { result.current.selectCommit('ccc', { shiftKey: true, metaKey: false }); });

    expect(result.current.selectedShas).toEqual(new Set(['aaa', 'bbb', 'ccc']));
  });

  it('should select range in reverse order on shift+click', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('ccc', { shiftKey: false, metaKey: false }); });
    act(() => { result.current.selectCommit('aaa', { shiftKey: true, metaKey: false }); });

    expect(result.current.selectedShas).toEqual(new Set(['aaa', 'bbb', 'ccc']));
  });

  it('should compute diffRange for single commit using next commit as parent', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('bbb', { shiftKey: false, metaKey: false }); });

    expect(result.current.diffRange).toEqual({
      oldRef: 'ccc',
      newRef: 'bbb',
    });
  });

  it('should compute diffRange for commit range using next commit as parent', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('aaa', { shiftKey: false, metaKey: false }); });
    act(() => { result.current.selectCommit('ccc', { shiftKey: true, metaKey: false }); });

    expect(result.current.diffRange).toEqual({
      oldRef: 'ddd',
      newRef: 'aaa',
    });
  });

  it('should fall back to sha~1 when selecting the last commit in the list', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('ddd', { shiftKey: false, metaKey: false }); });

    expect(result.current.diffRange).toEqual({
      oldRef: 'ddd~1',
      newRef: 'ddd',
    });
  });

  it('should clear selection', () => {
    const { result } = renderHook(() => useCommitSelection(commits));

    act(() => { result.current.selectCommit('aaa', { shiftKey: false, metaKey: false }); });
    act(() => { result.current.clear(); });

    expect(result.current.selectedShas.size).toBe(0);
    expect(result.current.isActive).toBe(false);
    expect(result.current.diffRange).toBeNull();
  });
});
