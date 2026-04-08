import { useCallback, useMemo } from 'react';

import type { FileNode } from '../fixtures/types';
import type { useMultiSelect } from './useMultiSelect';
import { collectDescendantFilePaths, collectFiles } from '../useFileSelection';

export interface SelectModifiers {
  shiftKey: boolean;
  metaKey: boolean;
}

interface FileSelectionHandlersOptions {
  files: FileNode[];
  worktreeFiles: FileNode[];
  multiSelect: ReturnType<typeof useMultiSelect>;
}

export const useFileSelectionHandlers = ({
  files,
  worktreeFiles,
  multiSelect,
}: FileSelectionHandlersOptions) => {
  const committedFilePaths = useMemo(
    () => collectFiles(files).map((file) => file.path),
    [files],
  );
  const worktreeFilePaths = useMemo(
    () => collectFiles(worktreeFiles).map((file) => file.path),
    [worktreeFiles],
  );
  const handleSelectAllCommitted = useCallback(() => {
    multiSelect.selectAll(committedFilePaths, 'committed');
  }, [committedFilePaths, multiSelect]);

  const handleSelectAllWorktree = useCallback(() => {
    multiSelect.selectAll(worktreeFilePaths, 'worktree');
  }, [worktreeFilePaths, multiSelect]);

  const allCommittedFilePaths = useMemo(
    () => new Set(committedFilePaths),
    [committedFilePaths],
  );

  const handleSelectCommittedFile = useCallback(
    (path: string, modifiers: SelectModifiers) => {
      if (modifiers.shiftKey) {
        multiSelect.selectRange(path, committedFilePaths, 'committed', path);
        return;
      }

      if (modifiers.metaKey) {
        const isFile = allCommittedFilePaths.has(path);
        if (isFile) {
          multiSelect.toggle(path, 'committed', path);
        } else {
          const children = collectDescendantFilePaths(files, path);
          if (children.length > 0) {
            multiSelect.toggleAll(children, 'committed', children[0] ?? path);
          }
        }
        return;
      }

      multiSelect.select(path, 'committed', path);
    },
    [allCommittedFilePaths, committedFilePaths, files, multiSelect],
  );

  const handleSelectCommittedDirectory = useCallback(
    (path: string) => {
      const children = collectDescendantFilePaths(files, path);
      if (children.length > 0) {
        multiSelect.selectAll(children, 'committed');
      }
    },
    [files, multiSelect],
  );

  const allWorktreeFilePaths = useMemo(
    () => new Set(worktreeFilePaths),
    [worktreeFilePaths],
  );

  const handleSelectWorktreeFile = useCallback(
    (path: string, modifiers: SelectModifiers) => {
      if (modifiers.shiftKey) {
        multiSelect.selectRange(path, worktreeFilePaths, 'worktree', path);
        return;
      }

      if (modifiers.metaKey) {
        const isFile = allWorktreeFilePaths.has(path);
        if (isFile) {
          multiSelect.toggle(path, 'worktree', path);
        } else {
          const children = collectDescendantFilePaths(worktreeFiles, path);
          if (children.length > 0) {
            multiSelect.toggleAll(children, 'worktree', children[0] ?? path);
          }
        }
        return;
      }

      multiSelect.select(path, 'worktree', path);
    },
    [allWorktreeFilePaths, worktreeFilePaths, worktreeFiles, multiSelect],
  );

  const handleSelectWorktreeDirectory = useCallback(
    (path: string) => {
      const children = collectDescendantFilePaths(worktreeFiles, path);
      if (children.length > 0) {
        multiSelect.selectAll(children, 'worktree');
      }
    },
    [worktreeFiles, multiSelect],
  );

  return {
    committedFilePaths,
    worktreeFilePaths,
    handleSelectAllCommitted,
    handleSelectAllWorktree,
    handleSelectCommittedFile,
    handleSelectWorktreeFile,
    handleSelectCommittedDirectory,
    handleSelectWorktreeDirectory,
  };
};
