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
    const ref = createRef<StackedDiffViewerHandle>() as { current: StackedDiffViewerHandle };
    ref.current = { scrollToFile: vi.fn(), scrollToLine: vi.fn() };

    renderHook(() => { useHashScroll(ref, [fileA], '#src/App.tsx'); });

    expect(ref.current.scrollToFile).toHaveBeenCalledWith('src/App.tsx');
  });

  it('calls scrollToLine when hash contains a line anchor', () => {
    const ref = createRef<StackedDiffViewerHandle>() as { current: StackedDiffViewerHandle };
    ref.current = { scrollToFile: vi.fn(), scrollToLine: vi.fn() };

    renderHook(() => { useHashScroll(ref, [fileA], '#src/App.tsx:L42'); });

    expect(ref.current.scrollToLine).toHaveBeenCalledWith('src/App.tsx', 42);
  });

  it('does not scroll when diffs are empty', () => {
    const ref = createRef<StackedDiffViewerHandle>() as { current: StackedDiffViewerHandle };
    ref.current = { scrollToFile: vi.fn(), scrollToLine: vi.fn() };

    renderHook(() => { useHashScroll(ref, [], '#src/App.tsx'); });

    expect(ref.current.scrollToFile).not.toHaveBeenCalled();
  });

  it('does not re-scroll when diffs change but hash stays the same', () => {
    const ref = createRef<StackedDiffViewerHandle>() as { current: StackedDiffViewerHandle };
    ref.current = { scrollToFile: vi.fn(), scrollToLine: vi.fn() };

    const { rerender } = renderHook(
      ({ diffs, hash }) => { useHashScroll(ref, diffs, hash); },
      { initialProps: { diffs: [fileA], hash: '#src/App.tsx' } },
    );

    const fileB: DiffFile = { path: 'src/B.tsx', changeType: 'added', language: 'typescript', hunks: [] };
    rerender({ diffs: [fileA, fileB], hash: '#src/App.tsx' });

    expect(ref.current.scrollToFile).toHaveBeenCalledTimes(1);
  });

  it('scrolls again when hash changes', () => {
    const ref = createRef<StackedDiffViewerHandle>() as { current: StackedDiffViewerHandle };
    ref.current = { scrollToFile: vi.fn(), scrollToLine: vi.fn() };

    const { rerender } = renderHook(
      ({ diffs, hash }) => { useHashScroll(ref, diffs, hash); },
      { initialProps: { diffs: [fileA], hash: '#src/App.tsx' } },
    );

    rerender({ diffs: [fileA], hash: '#src/B.tsx' });

    expect(ref.current.scrollToFile).toHaveBeenCalledTimes(2);
    expect(ref.current.scrollToFile).toHaveBeenLastCalledWith('src/B.tsx');
  });
});
