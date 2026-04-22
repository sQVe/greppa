import { useCallback, useMemo, useRef } from 'react';

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
  const allCommittedFilePaths = useMemo(
    () => new Set(committedFilePaths),
    [committedFilePaths],
  );

  const allWorktreeFilePaths = useMemo(
    () => new Set(worktreeFilePaths),
    [worktreeFilePaths],
  );

  // Tree.Collection memoizes item render output by items reference, so the
  // onPointerDown handlers first bound to the DOM are never rebound. Keep
  // these handlers stable and read current state via refs at call time.
  const refs = useRef({
    files,
    worktreeFiles,
    committedFilePaths,
    worktreeFilePaths,
    allCommittedFilePaths,
    allWorktreeFilePaths,
    multiSelect,
  });
  refs.current = {
    files,
    worktreeFiles,
    committedFilePaths,
    worktreeFilePaths,
    allCommittedFilePaths,
    allWorktreeFilePaths,
    multiSelect,
  };

  const handleSelectAllCommitted = useCallback(() => {
    refs.current.multiSelect.selectAll(refs.current.committedFilePaths, 'committed');
  }, []);

  const handleSelectAllWorktree = useCallback(() => {
    refs.current.multiSelect.selectAll(refs.current.worktreeFilePaths, 'worktree');
  }, []);

  const handleSelectCommittedFile = useCallback(
    (path: string, modifiers: SelectModifiers) => {
      const current = refs.current;
      if (modifiers.shiftKey) {
        current.multiSelect.selectRange(path, current.committedFilePaths, 'committed', path);
        return;
      }

      if (modifiers.metaKey) {
        const isFile = current.allCommittedFilePaths.has(path);
        if (isFile) {
          current.multiSelect.toggle(path, 'committed', path);
        } else {
          const children = collectDescendantFilePaths(current.files, path);
          if (children.length > 0) {
            current.multiSelect.toggleAll(children, 'committed', children[0] ?? path);
          }
        }
        return;
      }

      current.multiSelect.select(path, 'committed', path);
    },
    [],
  );

  const handleSelectCommittedDirectory = useCallback(
    (path: string) => {
      const current = refs.current;
      const children = collectDescendantFilePaths(current.files, path);
      if (children.length > 0) {
        current.multiSelect.selectAll(children, 'committed');
      }
    },
    [],
  );

  const handleSelectWorktreeFile = useCallback(
    (path: string, modifiers: SelectModifiers) => {
      const current = refs.current;
      if (modifiers.shiftKey) {
        current.multiSelect.selectRange(path, current.worktreeFilePaths, 'worktree', path);
        return;
      }

      if (modifiers.metaKey) {
        const isFile = current.allWorktreeFilePaths.has(path);
        if (isFile) {
          current.multiSelect.toggle(path, 'worktree', path);
        } else {
          const children = collectDescendantFilePaths(current.worktreeFiles, path);
          if (children.length > 0) {
            current.multiSelect.toggleAll(children, 'worktree', children[0] ?? path);
          }
        }
        return;
      }

      current.multiSelect.select(path, 'worktree', path);
    },
    [],
  );

  const handleSelectWorktreeDirectory = useCallback(
    (path: string) => {
      const current = refs.current;
      const children = collectDescendantFilePaths(current.worktreeFiles, path);
      if (children.length > 0) {
        current.multiSelect.selectAll(children, 'worktree');
      }
    },
    [],
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
