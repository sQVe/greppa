import { useCallback, useMemo } from 'react';

import type { FileNode } from '../fixtures/types';
import { collectFiles } from '../useFileSelection';
import { useCommitList } from './useCommitList';
import { useCommitSelection } from './useCommitSelection';
import { useComputedDiffs } from './useComputedDiffs';
import { useFileList } from './useFileList';
import { useFileSelectionHandlers } from './useFileSelectionHandlers';
import { useMultiSelect } from './useMultiSelect';

interface SelectionCoordinatorOptions {
  files: FileNode[];
  worktreeFiles: FileNode[];
  oldRef: string;
  newRef: string;
  selectCommittedFile: (path: string) => void;
  selectWorktreeFile: (path: string) => void;
}

export const useSelectionCoordinator = ({
  files,
  worktreeFiles,
  oldRef,
  newRef,
  selectCommittedFile,
  selectWorktreeFile,
}: SelectionCoordinatorOptions) => {
  const multiSelect = useMultiSelect();
  const { commits } = useCommitList(oldRef, newRef);
  const commitSelection = useCommitSelection(commits);

  const handleSelectCommit = useCallback(
    (sha: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => {
      multiSelect.clear();
      commitSelection.selectCommit(sha, modifiers);
    },
    [multiSelect, commitSelection],
  );

  const {
    committedFilePaths,
    worktreeFilePaths,
    handleSelectCommittedFile: rawSelectCommittedFile,
    handleSelectWorktreeFile: rawSelectWorktreeFile,
    handleSelectCommittedDirectory: rawSelectCommittedDirectory,
    handleSelectWorktreeDirectory: rawSelectWorktreeDirectory,
  } = useFileSelectionHandlers({
    files,
    worktreeFiles,
    multiSelect,
    selectCommittedFile,
    selectWorktreeFile,
  });

  const handleSelectCommittedFile = useCallback(
    (...args: Parameters<typeof rawSelectCommittedFile>) => {
      commitSelection.clear();
      rawSelectCommittedFile(...args);
    },
    [commitSelection, rawSelectCommittedFile],
  );

  const handleSelectWorktreeFile = useCallback(
    (...args: Parameters<typeof rawSelectWorktreeFile>) => {
      commitSelection.clear();
      rawSelectWorktreeFile(...args);
    },
    [commitSelection, rawSelectWorktreeFile],
  );

  const handleSelectCommittedDirectory = useCallback(
    (path: string) => {
      commitSelection.clear();
      rawSelectCommittedDirectory(path);
    },
    [commitSelection, rawSelectCommittedDirectory],
  );

  const handleSelectWorktreeDirectory = useCallback(
    (path: string) => {
      commitSelection.clear();
      rawSelectWorktreeDirectory(path);
    },
    [commitSelection, rawSelectWorktreeDirectory],
  );

  const commitDiffRange = commitSelection.diffRange;
  const commitFilePaths = useFileList(commitDiffRange?.oldRef ?? '', commitDiffRange?.newRef ?? '');
  const commitFilePathsList = useMemo(
    () => (commitFilePaths.files != null ? collectFiles(commitFilePaths.files).map((f) => f.path) : []),
    [commitFilePaths.files],
  );
  const commitDiffs = useComputedDiffs(
    commitSelection.isActive ? commitFilePathsList : [],
    'committed',
    commitDiffRange?.oldRef ?? '',
    commitDiffRange?.newRef ?? '',
  );

  return {
    multiSelect,
    commits,
    commitSelection,
    commitDiffs,
    committedFilePaths,
    worktreeFilePaths,
    handleSelectCommit,
    handleSelectCommittedFile,
    handleSelectWorktreeFile,
    handleSelectCommittedDirectory,
    handleSelectWorktreeDirectory,
  };
};
