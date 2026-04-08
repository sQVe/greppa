// @vitest-environment happy-dom
import { createRef } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { StackedDiffViewerHandle } from '../components/StackedDiffViewer/StackedDiffViewer';
import type { DiffFile } from '../fixtures/types';
import { useHashScroll } from './useHashScroll';

const fileA: DiffFile = {
  path: 'src/App.tsx',
  changeType: 'modified',
  language: 'typescript',
  hunks: [],
};

describe('useHashScroll', () => {
  it('calls scrollToFile when hash contains a file path and diffs are present', () => {
    window.location.hash = '#src/App.tsx';
    const ref = createRef<StackedDiffViewerHandle>() as { current: StackedDiffViewerHandle };
    ref.current = { scrollToFile: vi.fn(), scrollToLine: vi.fn() };

    renderHook(() =>{  useHashScroll(ref, [fileA]); });

    expect(ref.current.scrollToFile).toHaveBeenCalledWith('src/App.tsx');
    window.location.hash = '';
  });

  it('calls scrollToLine when hash contains a line anchor', () => {
    window.location.hash = '#src/App.tsx:L42';
    const ref = createRef<StackedDiffViewerHandle>() as { current: StackedDiffViewerHandle };
    ref.current = { scrollToFile: vi.fn(), scrollToLine: vi.fn() };

    renderHook(() =>{  useHashScroll(ref, [fileA]); });

    expect(ref.current.scrollToLine).toHaveBeenCalledWith('src/App.tsx', 42);
    window.location.hash = '';
  });

  it('does not scroll when diffs are empty', () => {
    window.location.hash = '#src/App.tsx';
    const ref = createRef<StackedDiffViewerHandle>() as { current: StackedDiffViewerHandle };
    ref.current = { scrollToFile: vi.fn(), scrollToLine: vi.fn() };

    renderHook(() =>{  useHashScroll(ref, []); });

    expect(ref.current.scrollToFile).not.toHaveBeenCalled();
    window.location.hash = '';
  });

  it('scrolls only once even when diffs change', () => {
    window.location.hash = '#src/App.tsx';
    const ref = createRef<StackedDiffViewerHandle>() as { current: StackedDiffViewerHandle };
    ref.current = { scrollToFile: vi.fn(), scrollToLine: vi.fn() };

    const { rerender } = renderHook(
      ({ diffs }) =>{  useHashScroll(ref, diffs); },
      { initialProps: { diffs: [fileA] } },
    );

    const fileB: DiffFile = { path: 'src/B.tsx', changeType: 'added', language: 'typescript', hunks: [] };
    rerender({ diffs: [fileA, fileB] });

    expect(ref.current.scrollToFile).toHaveBeenCalledTimes(1);
    window.location.hash = '';
  });
});
