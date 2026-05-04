// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { useSectionFilter } from './useSectionFilter';

const files: FileNode[] = [
  { path: 'src/a.ts', name: 'a.ts', type: 'file', changeType: 'modified' },
  { path: 'src/b.tsx', name: 'b.tsx', type: 'file', changeType: 'added' },
];

describe('useSectionFilter', () => {
  it('returns the unfiltered file list when no filter is active', () => {
    const { result } = renderHook(() =>
      useSectionFilter('section-empty', files, new Set()),
    );

    expect(result.current.filtered.files).toEqual(files);
    expect(result.current.filtered.visibleCount).toBe(2);
    expect(result.current.filtered.totalCount).toBe(2);
    expect(result.current.predicate).toBeNull();
  });

  it('narrows the filtered list when query is applied', () => {
    const { result } = renderHook(() =>
      useSectionFilter('section-query', files, new Set()),
    );

    act(() => {
      result.current.filter.setQuery('b');
    });

    expect(result.current.filtered.visibleCount).toBe(1);
    expect(result.current.filtered.files[0]?.path).toBe('src/b.tsx');
  });

  it('toggles facets via toggles helpers', () => {
    const { result } = renderHook(() =>
      useSectionFilter('section-toggle', files, new Set()),
    );

    act(() => {
      result.current.toggles.toggleExtension('ts');
    });

    expect(result.current.selectedSets.extensions.has('ts')).toBe(true);

    act(() => {
      result.current.toggles.toggleExtension('ts');
    });

    expect(result.current.selectedSets.extensions.has('ts')).toBe(false);
  });

  it('exposes facet rows derived from input files', () => {
    const { result } = renderHook(() =>
      useSectionFilter('section-rows', files, new Set(['src/a.ts'])),
    );

    expect(result.current.rows.extensions.map((r) => r.extension)).toEqual(
      expect.arrayContaining(['ts', 'tsx']),
    );
    const reviewed = result.current.rows.statuses.find((s) => s.status === 'reviewed');
    expect(reviewed?.count).toBe(1);
  });
});
