// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useMultiSelect } from './useMultiSelect';

afterEach(() => {
  cleanup();
});

describe('useMultiSelect', () => {
  describe('initial state', () => {
    it('has empty selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      expect(result.current.selectedPaths).toEqual(new Set());
    });

    it('has no active source', () => {
      const { result } = renderHook(() => useMultiSelect());
      expect(result.current.activeSource).toBeNull();
    });

    it('reports not multi-selecting', () => {
      const { result } = renderHook(() => useMultiSelect());
      expect(result.current.isMultiSelect).toBe(false);
    });
  });

  describe('select', () => {
    it('replaces selection with a single path', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['a.ts']));
    });

    it('clears previous selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.select('b.ts', 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['b.ts']));
    });

    it('sets active source', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'worktree'); });
      expect(result.current.activeSource).toBe('worktree');
    });

    it('reports not multi-selecting for single selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      expect(result.current.isMultiSelect).toBe(false);
    });
  });

  describe('toggle', () => {
    it('adds a path to the selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.toggle('b.ts', 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['a.ts', 'b.ts']));
    });

    it('removes a path already in the selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.toggle('b.ts', 'committed'); });
      act(() => { result.current.toggle('a.ts', 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['b.ts']));
    });

    it('reports multi-selecting when more than one selected', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.toggle('b.ts', 'committed'); });
      expect(result.current.isMultiSelect).toBe(true);
    });

    it('resets selection when toggling from a different source', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.toggle('b.ts', 'worktree'); });
      expect(result.current.selectedPaths).toEqual(new Set(['b.ts']));
      expect(result.current.activeSource).toBe('worktree');
    });
  });

  describe('selectAll', () => {
    it('replaces selection with all given paths', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.selectAll(['a.ts', 'b.ts', 'c.ts'], 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['a.ts', 'b.ts', 'c.ts']));
    });

    it('sets active source', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.selectAll(['a.ts'], 'worktree'); });
      expect(result.current.activeSource).toBe('worktree');
    });

    it('reports multi-selecting when given multiple paths', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.selectAll(['a.ts', 'b.ts'], 'committed'); });
      expect(result.current.isMultiSelect).toBe(true);
    });
  });

  describe('toggleAll', () => {
    it('adds all given paths to existing selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.toggleAll(['b.ts', 'c.ts'], 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['a.ts', 'b.ts', 'c.ts']));
    });

    it('removes paths that are all already selected', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.selectAll(['a.ts', 'b.ts', 'c.ts'], 'committed'); });
      act(() => { result.current.toggleAll(['a.ts', 'b.ts'], 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['c.ts']));
    });

    it('adds paths when not all are already selected', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.selectAll(['a.ts', 'b.ts'], 'committed'); });
      act(() => { result.current.toggleAll(['b.ts', 'c.ts'], 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['a.ts', 'b.ts', 'c.ts']));
    });

    it('resets selection when toggling from a different source', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.toggleAll(['b.ts', 'c.ts'], 'worktree'); });
      expect(result.current.selectedPaths).toEqual(new Set(['b.ts', 'c.ts']));
      expect(result.current.activeSource).toBe('worktree');
    });
  });

  describe('selectRange', () => {
    it('selects all paths between anchor and target inclusive', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('b.ts', 'committed'); });
      act(() => { result.current.selectRange('d.ts', ordered, 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['b.ts', 'c.ts', 'd.ts']));
    });

    it('selects range in reverse direction', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('d.ts', 'committed'); });
      act(() => { result.current.selectRange('b.ts', ordered, 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['b.ts', 'c.ts', 'd.ts']));
    });

    it('selects only target when no anchor exists', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.selectRange('b.ts', ordered, 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['b.ts']));
    });

    it('preserves anchor for subsequent range selections', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('b.ts', 'committed'); });
      act(() => { result.current.selectRange('d.ts', ordered, 'committed'); });
      act(() => { result.current.selectRange('e.ts', ordered, 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['b.ts', 'c.ts', 'd.ts', 'e.ts']));
    });

    it('resets selection when source changes', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.selectRange('c.ts', ordered, 'worktree'); });
      expect(result.current.selectedPaths).toEqual(new Set(['c.ts']));
      expect(result.current.activeSource).toBe('worktree');
    });
  });

  describe('anchor tracking', () => {
    it('sets anchor on select', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.selectRange('c.ts', ordered, 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['a.ts', 'b.ts', 'c.ts']));
    });

    it('sets anchor on toggle', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.toggle('c.ts', 'committed'); });
      act(() => { result.current.selectRange('d.ts', ordered, 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['c.ts', 'd.ts']));
    });

    it('clears anchor on clear', () => {
      const ordered = ['a.ts', 'b.ts', 'c.ts'];
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.clear(); });
      act(() => { result.current.selectRange('c.ts', ordered, 'committed'); });
      expect(result.current.selectedPaths).toEqual(new Set(['c.ts']));
    });
  });

  describe('clear', () => {
    it('empties the selection', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.selectAll(['a.ts', 'b.ts'], 'committed'); });
      act(() => { result.current.clear(); });
      expect(result.current.selectedPaths).toEqual(new Set());
    });

    it('resets active source', () => {
      const { result } = renderHook(() => useMultiSelect());
      act(() => { result.current.select('a.ts', 'committed'); });
      act(() => { result.current.clear(); });
      expect(result.current.activeSource).toBeNull();
    });
  });
});
