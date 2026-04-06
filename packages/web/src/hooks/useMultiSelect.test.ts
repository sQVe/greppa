// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useMultiSelect } from './useMultiSelect';

afterEach(() => {
  cleanup();
});

describe('useMultiSelect', () => {
  describe('initial state', () => {
    it('should have empty selection', () => {
      const { result } = renderHook(() => useMultiSelect());

      expect(result.current.selectedPaths).toEqual(new Set());
    });

    it('should have no active source', () => {
      const { result } = renderHook(() => useMultiSelect());

      expect(result.current.activeSource).toBeNull();
    });

    it('should report not multi-selecting', () => {
      const { result } = renderHook(() => useMultiSelect());

      expect(result.current.isMultiSelect).toBe(false);
    });
  });

  describe('select', () => {
    it('should replace selection with a single path', () => {
      const { result } = renderHook(() => useMultiSelect());

      act(() => { result.current.select('a.ts', 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['a.ts']));
    });

    it('should clear previous selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });

      act(() => { result.current.select('b.ts', 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['b.ts']));
    });

    it('should set active source', () => {
      const { result } = renderHook(() => useMultiSelect());

      act(() => { result.current.select('a.ts', 'worktree'); });

      expect(result.current.activeSource).toBe('worktree');
    });

    it('should report not multi-selecting for single selection', () => {
      const { result } = renderHook(() => useMultiSelect());

      act(() => { result.current.select('a.ts', 'committed'); });

      expect(result.current.isMultiSelect).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should add a path to the selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });

      act(() => { result.current.toggle('b.ts', 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['a.ts', 'b.ts']));
    });

    it('should remove a path already in the selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.toggle('b.ts', 'committed'); });

      act(() => { result.current.toggle('a.ts', 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['b.ts']));
    });

    it('should report multi-selecting when more than one selected', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });

      act(() => { result.current.toggle('b.ts', 'committed'); });

      expect(result.current.isMultiSelect).toBe(true);
    });

    it('should reset selection when toggling from a different source', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });

      act(() => { result.current.toggle('b.ts', 'worktree'); });

      expect(result.current.selectedPaths).toEqual(new Set(['b.ts']));
      expect(result.current.activeSource).toBe('worktree');
    });
  });

  describe('selectAll', () => {
    it('should replace selection with all given paths', () => {
      const { result } = renderHook(() => useMultiSelect());

      act(() => { result.current.selectAll(['a.ts', 'b.ts', 'c.ts'], 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['a.ts', 'b.ts', 'c.ts']));
    });

    it('should set active source', () => {
      const { result } = renderHook(() => useMultiSelect());

      act(() => { result.current.selectAll(['a.ts'], 'worktree'); });

      expect(result.current.activeSource).toBe('worktree');
    });

    it('should report multi-selecting when given multiple paths', () => {
      const { result } = renderHook(() => useMultiSelect());

      act(() => { result.current.selectAll(['a.ts', 'b.ts'], 'committed'); });

      expect(result.current.isMultiSelect).toBe(true);
    });
  });

  describe('toggleAll', () => {
    it('should add all given paths to existing selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });

      act(() => { result.current.toggleAll(['b.ts', 'c.ts'], 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['a.ts', 'b.ts', 'c.ts']));
    });

    it('should remove paths that are all already selected', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.selectAll(['a.ts', 'b.ts', 'c.ts'], 'committed'); });

      act(() => { result.current.toggleAll(['a.ts', 'b.ts'], 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['c.ts']));
    });

    it('should add paths when not all are already selected', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.selectAll(['a.ts', 'b.ts'], 'committed'); });

      act(() => { result.current.toggleAll(['b.ts', 'c.ts'], 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['a.ts', 'b.ts', 'c.ts']));
    });

    it('should reset selection when toggling from a different source', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });

      act(() => { result.current.toggleAll(['b.ts', 'c.ts'], 'worktree'); });

      expect(result.current.selectedPaths).toEqual(new Set(['b.ts', 'c.ts']));
      expect(result.current.activeSource).toBe('worktree');
    });
  });

  describe('selectRange', () => {
    it('should select all paths between anchor and target inclusive', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('b.ts', 'committed'); });

      act(() => { result.current.selectRange('d.ts', ordered, 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['b.ts', 'c.ts', 'd.ts']));
    });

    it('should select range in reverse direction', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('d.ts', 'committed'); });

      act(() => { result.current.selectRange('b.ts', ordered, 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['b.ts', 'c.ts', 'd.ts']));
    });

    it('should select only target when no anchor exists', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts'];
      const { result } = renderHook(() => useMultiSelect());

      act(() => { result.current.selectRange('b.ts', ordered, 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['b.ts']));
    });

    it('should preserve anchor for subsequent range selections', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('b.ts', 'committed'); });
      act(() => { result.current.selectRange('d.ts', ordered, 'committed'); });

      act(() => { result.current.selectRange('e.ts', ordered, 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['b.ts', 'c.ts', 'd.ts', 'e.ts']));
    });

    it('should reset selection when source changes', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });

      act(() => { result.current.selectRange('c.ts', ordered, 'worktree'); });

      expect(result.current.selectedPaths).toEqual(new Set(['c.ts']));
      expect(result.current.activeSource).toBe('worktree');
    });
  });

  describe('anchor tracking', () => {
    it('should set anchor on select', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });

      act(() => { result.current.selectRange('c.ts', ordered, 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['a.ts', 'b.ts', 'c.ts']));
    });

    it('should set anchor on toggle', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.toggle('c.ts', 'committed'); });

      act(() => { result.current.selectRange('d.ts', ordered, 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['c.ts', 'd.ts']));
    });

    it('should clear anchor on clear', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.clear(); });

      act(() => { result.current.selectRange('c.ts', ordered, 'committed'); });

      expect(result.current.selectedPaths).toEqual(new Set(['c.ts']));
    });
  });

  describe('clear', () => {
    it('should empty the selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.selectAll(['a.ts', 'b.ts'], 'committed'); });

      act(() => { result.current.clear(); });

      expect(result.current.selectedPaths).toEqual(new Set());
    });

    it('should reset active source', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });

      act(() => { result.current.clear(); });

      expect(result.current.activeSource).toBeNull();
    });
  });
});
