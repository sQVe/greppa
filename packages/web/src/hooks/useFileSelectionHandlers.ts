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
  selectCommittedFile: (path: string) => void;
  selectWorktreeFile: (path: string) => void;
}

export const useFileSelectionHandlers = ({
  files,
  worktreeFiles,
  multiSelect,
  selectCommittedFile,
  selectWorktreeFile,
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
        multiSelect.selectRange(path, committedFilePaths, 'committed');
        return;
      }

      if (modifiers.metaKey) {
        const isFile = allCommittedFilePaths.has(path);
        if (isFile) {
          multiSelect.toggle(path, 'committed');
        } else {
          const children = collectDescendantFilePaths(files, path);
          if (children.length > 0) {
            multiSelect.toggleAll(children, 'committed');
          }
        }
        return;
      }

      multiSelect.select(path, 'committed');
      selectCommittedFile(path);
    },
    [allCommittedFilePaths, committedFilePaths, files, multiSelect, selectCommittedFile],
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
        multiSelect.selectRange(path, worktreeFilePaths, 'worktree');
        return;
      }

      if (modifiers.metaKey) {
        const isFile = allWorktreeFilePaths.has(path);
        if (isFile) {
          multiSelect.toggle(path, 'worktree');
        } else {
          const children = collectDescendantFilePaths(worktreeFiles, path);
          if (children.length > 0) {
            multiSelect.toggleAll(children, 'worktree');
          }
        }
        return;
      }

      multiSelect.select(path, 'worktree');
      selectWorktreeFile(path);
    },
    [allWorktreeFilePaths, worktreeFilePaths, worktreeFiles, multiSelect, selectWorktreeFile],
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
