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

const NO_MODIFIERS = { shiftKey: false, metaKey: false };
const SHIFT = { shiftKey: true, metaKey: false };
const META = { shiftKey: false, metaKey: true };

const setup = (files = committedFiles, wt = worktreeFiles) => {
  const selectCommittedFile = vi.fn();
  const selectWorktreeFile = vi.fn();
  const { result } = renderHook(() => {
    const multiSelect = useMultiSelect();
    const handlers = useFileSelectionHandlers({
      files,
      worktreeFiles: wt,
      multiSelect,
      selectCommittedFile,
      selectWorktreeFile,
    });
    return { multiSelect, handlers };
  });
  return { result, selectCommittedFile, selectWorktreeFile };
};

afterEach(() => {
  cleanup();
});

describe('useFileSelectionHandlers', () => {
  describe('handleSelectCommittedFile', () => {
    it('should select file and navigate on plain click', () => {
      const { result, selectCommittedFile } = setup();

      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', NO_MODIFIERS); });

      expect(result.current.multiSelect.selectedPaths).toEqual(new Set(['src/index.ts']));
      expect(result.current.multiSelect.activeSource).toBe('committed');
      expect(selectCommittedFile).toHaveBeenCalledWith('src/index.ts');
    });

    it('should toggle file on meta+click', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', NO_MODIFIERS); });

      act(() => { result.current.handlers.handleSelectCommittedFile('src/utils.ts', META); });

      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['src/index.ts', 'src/utils.ts']),
      );
    });

    it('should remove file on meta+click when already selected', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', NO_MODIFIERS); });
      act(() => { result.current.handlers.handleSelectCommittedFile('src/utils.ts', META); });

      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', META); });

      expect(result.current.multiSelect.selectedPaths).toEqual(new Set(['src/utils.ts']));
    });

    it('should range select on shift+click', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', NO_MODIFIERS); });

      act(() => { result.current.handlers.handleSelectCommittedFile('README.md', SHIFT); });

      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['src/index.ts', 'src/utils.ts', 'README.md']),
      );
    });

    it('should not navigate on shift+click', () => {
      const { result, selectCommittedFile } = setup();

      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', SHIFT); });

      expect(selectCommittedFile).not.toHaveBeenCalled();
    });

    it('should not navigate on meta+click', () => {
      const { result, selectCommittedFile } = setup();

      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', META); });

      expect(selectCommittedFile).not.toHaveBeenCalled();
    });

    it('should toggle all directory children on meta+click directory', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectCommittedFile('README.md', NO_MODIFIERS); });

      act(() => { result.current.handlers.handleSelectCommittedFile('src', META); });

      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['README.md', 'src/index.ts', 'src/utils.ts']),
      );
    });

    it('should remove all directory children on meta+click when all already selected', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectAllCommitted(); });

      act(() => { result.current.handlers.handleSelectCommittedFile('src', META); });

      expect(result.current.multiSelect.selectedPaths).toEqual(new Set(['README.md']));
    });
  });

  describe('handleSelectCommittedDirectory', () => {
    it('should select all descendant files', () => {
      const { result } = setup();

      act(() => { result.current.handlers.handleSelectCommittedDirectory('src'); });

      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['src/index.ts', 'src/utils.ts']),
      );
      expect(result.current.multiSelect.activeSource).toBe('committed');
    });

    it('should do nothing for empty directory', () => {
      const { result } = setup(emptyDirectory);

      act(() => { result.current.handlers.handleSelectCommittedDirectory('empty'); });

      expect(result.current.multiSelect.selectedPaths).toEqual(new Set());
    });
  });

  describe('handleSelectAllCommitted', () => {
    it('should select all committed files', () => {
      const { result } = setup();

      act(() => { result.current.handlers.handleSelectAllCommitted(); });

      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['src/index.ts', 'src/utils.ts', 'README.md']),
      );
    });
  });

  describe('handleSelectWorktreeFile', () => {
    it('should select file and navigate with worktree source', () => {
      const { result, selectWorktreeFile } = setup();

      act(() => { result.current.handlers.handleSelectWorktreeFile('config.ts', NO_MODIFIERS); });

      expect(result.current.multiSelect.selectedPaths).toEqual(new Set(['config.ts']));
      expect(result.current.multiSelect.activeSource).toBe('worktree');
      expect(selectWorktreeFile).toHaveBeenCalledWith('config.ts');
    });

    it('should toggle file on meta+click', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectWorktreeFile('config.ts', NO_MODIFIERS); });

      act(() => { result.current.handlers.handleSelectWorktreeFile('lib/helpers.ts', META); });

      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['config.ts', 'lib/helpers.ts']),
      );
    });

    it('should range select on shift+click', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectWorktreeFile('config.ts', NO_MODIFIERS); });

      act(() => { result.current.handlers.handleSelectWorktreeFile('lib/helpers.ts', SHIFT); });

      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['config.ts', 'lib/helpers.ts']),
      );
    });

    it('should toggle all directory children on meta+click directory', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectWorktreeFile('config.ts', NO_MODIFIERS); });

      act(() => { result.current.handlers.handleSelectWorktreeFile('lib', META); });

      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['config.ts', 'lib/helpers.ts']),
      );
    });
  });

  describe('handleSelectWorktreeDirectory', () => {
    it('should select all descendant files with worktree source', () => {
      const { result } = setup();

      act(() => { result.current.handlers.handleSelectWorktreeDirectory('lib'); });

      expect(result.current.multiSelect.selectedPaths).toEqual(new Set(['lib/helpers.ts']));
      expect(result.current.multiSelect.activeSource).toBe('worktree');
    });
  });

  describe('handleSelectAllWorktree', () => {
    it('should select all worktree files', () => {
      const { result } = setup();

      act(() => { result.current.handlers.handleSelectAllWorktree(); });

      expect(result.current.multiSelect.selectedPaths).toEqual(
        new Set(['config.ts', 'lib/helpers.ts']),
      );
    });
  });

  describe('cross-source behavior', () => {
    it('should reset selection when switching from committed to worktree', () => {
      const { result } = setup();
      act(() => { result.current.handlers.handleSelectCommittedFile('src/index.ts', NO_MODIFIERS); });

      act(() => { result.current.handlers.handleSelectWorktreeFile('config.ts', NO_MODIFIERS); });

      expect(result.current.multiSelect.selectedPaths).toEqual(new Set(['config.ts']));
      expect(result.current.multiSelect.activeSource).toBe('worktree');
    });
  });
});
