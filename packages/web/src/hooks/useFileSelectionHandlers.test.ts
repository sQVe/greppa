// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { useFileSelectionHandlers } from './useFileSelectionHandlers';
import { useMultiSelect } from './useMultiSelect';

const committedFiles: FileNode[] = [
  {
    path: 'src',
    name: 'src',
    type: 'directory',
    children: [
      { path: 'src/index.ts', name: 'index.ts', type: 'file', changeType: 'modified' },
      { path: 'src/utils.ts', name: 'utils.ts', type: 'file', changeType: 'added' },
    ],
  },
  { path: 'README.md', name: 'README.md', type: 'file', changeType: 'modified' },
];

const worktreeFiles: FileNode[] = [
  { path: 'config.ts', name: 'config.ts', type: 'file', changeType: 'modified' },
  {
    path: 'lib',
    name: 'lib',
    type: 'directory',
    children: [
      { path: 'lib/helpers.ts', name: 'helpers.ts', type: 'file', changeType: 'added' },
    ],
  },
];

const emptyDirectory: FileNode[] = [
  { path: 'empty', name: 'empty', type: 'directory', children: [] },
];

const setup = (files = committedFiles, wt = worktreeFiles) => {
  const selectCommittedFile = vi.fn();
  const selectWorktreeFile = vi.fn();
  const { result } = renderHook(() => {
    const multiSelect = useMultiSelect();
    const handlers = useFileSelectionHandlers(
      files,
      wt,
      multiSelect,
      selectCommittedFile,
      selectWorktreeFile,
    );
    return { multiSelect, handlers };
  });
  return { result, selectCommittedFile, selectWorktreeFile };
};

afterEach(() => {
  cleanup();
});

describe('useFileSelectionHandlers', () => {
  describe('handleSelectCommittedFile', () => {
    it('selects file and navigates on plain click', () => {
      const { result, selectCommittedFile } = setup();
      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', false); });
      expect(result.current.multiSelect.selectedPaths).toEqual(new Set(['src/index.ts']));
      expect(result.current.multiSelect.activeSource).toBe('committed');
      expect(selectCommittedFile).toHaveBeenCalledWith('src/index.ts');
    });

    it('toggles file on shift+click', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', false); });
      act(() => { result.current.handlers.handleSelectCommittedFile('src/utils.ts', true); });
      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['src/index.ts', 'src/utils.ts']),
      );
    });

    it('toggles all directory children on shift+click directory', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectCommittedFile('README.md', false); });
      act(() => { result.current.handlers.handleSelectCommittedFile('src', true); });
      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['README.md', 'src/index.ts', 'src/utils.ts']),
      );
    });

    it('removes all directory children on shift+click when all already selected', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectAllCommitted(); });
      act(() => { result.current.handlers.handleSelectCommittedFile('src', true); });
      expect(result.current.multiSelect.selectedPaths).toEqual(new Set(['README.md']));
    });

    it('does not navigate on shift+click', () => {
      const { result, selectCommittedFile } = setup();
      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', true); });
      expect(selectCommittedFile).not.toHaveBeenCalled();
    });
  });

  describe('handleSelectCommittedDirectory', () => {
    it('selects all descendant files', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectCommittedDirectory('src'); });
      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['src/index.ts', 'src/utils.ts']),
      );
      expect(result.current.multiSelect.activeSource).toBe('committed');
    });

    it('does nothing for empty directory', () => {
      const { result } = setup(emptyDirectory);
      act(() => { result.current.handlers.handleSelectCommittedDirectory('empty'); });
      expect(result.current.multiSelect.selectedPaths).toEqual(new Set());
    });
  });

  describe('handleSelectAllCommitted', () => {
    it('selects all committed files', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectAllCommitted(); });
      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['src/index.ts', 'src/utils.ts', 'README.md']),
      );
    });
  });

  describe('handleSelectWorktreeFile', () => {
    it('selects file and navigates with worktree source', () => {
      const { result, selectWorktreeFile } = setup();
      act(() => { result.current.handlers.handleSelectWorktreeFile('config.ts', false); });
      expect(result.current.multiSelect.selectedPaths).toEqual(new Set(['config.ts']));
      expect(result.current.multiSelect.activeSource).toBe('worktree');
      expect(selectWorktreeFile).toHaveBeenCalledWith('config.ts');
    });

    it('toggles file on shift+click', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectWorktreeFile('config.ts', false); });
      act(() => { result.current.handlers.handleSelectWorktreeFile('lib/helpers.ts', true); });
      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['config.ts', 'lib/helpers.ts']),
      );
    });

    it('toggles all directory children on shift+click directory', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectWorktreeFile('config.ts', false); });
      act(() => { result.current.handlers.handleSelectWorktreeFile('lib', true); });
      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['config.ts', 'lib/helpers.ts']),
      );
    });
  });

  describe('handleSelectWorktreeDirectory', () => {
    it('selects all descendant files with worktree source', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectWorktreeDirectory('lib'); });
      expect(result.current.multiSelect.selectedPaths).toEqual(new Set(['lib/helpers.ts']));
      expect(result.current.multiSelect.activeSource).toBe('worktree');
    });
  });

  describe('handleSelectAllWorktree', () => {
    it('selects all worktree files', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectAllWorktree(); });
      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['config.ts', 'lib/helpers.ts']),
      );
    });
  });

  describe('cross-source behavior', () => {
    it('resets selection when switching from committed to worktree', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', false); });
      act(() => { result.current.handlers.handleSelectWorktreeFile('config.ts', false); });
      expect(result.current.multiSelect.selectedPaths).toEqual(new Set(['config.ts']));
      expect(result.current.multiSelect.activeSource).toBe('worktree');
    });
  });
});
