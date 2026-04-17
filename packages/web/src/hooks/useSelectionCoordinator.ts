import { useMemo } from 'react';

import type { FileNode } from '../fixtures/types';
import { collectFiles } from '../useFileSelection';
import { useCommitFileDiffs } from './useCommitFileDiffs';
import { useCommitFileSelection } from './useCommitFileSelection';
import { useCommitList } from './useCommitList';
import { useCommitSelection } from './useCommitSelection';
import { useComputedDiffs } from './useComputedDiffs';
import { useFileList } from './useFileList';
import { useFileSelectionHandlers } from './useFileSelectionHandlers';
import { useMultiSelect } from './useMultiSelect';
import { usePrefetchNeighbors } from './usePrefetchNeighbors';

interface SelectionCoordinatorOptions {
  files: FileNode[];
  worktreeFiles: FileNode[];
  oldRef: string;
  newRef: string;
}

const PREFETCH_DEPTH = 2;

const primarySelectedPath = (selectedPaths: Set<string>, orderedPaths: string[]): string | null => {
  if (selectedPaths.size === 0) {
    return null;
  }
  return orderedPaths.find((path) => selectedPaths.has(path)) ?? null;
};

export const useSelectionCoordinator = ({
  files,
  worktreeFiles,
  oldRef,
  newRef,
}: SelectionCoordinatorOptions) => {
  const committedOrderedFiles = useMemo(() => collectFiles(files), [files]);
  const committedFilePaths = useMemo(
    () => committedOrderedFiles.map((file) => file.path),
    [committedOrderedFiles],
  );
  const worktreeFilePaths = useMemo(
    () => collectFiles(worktreeFiles).map((file) => file.path),
    [worktreeFiles],
  );

  const multiSelect = useMultiSelect({ committedFilePaths, worktreeFilePaths });

  const committedSelectedPath =
    multiSelect.activeSource === 'committed'
      ? primarySelectedPath(multiSelect.selectedPaths, committedFilePaths)
      : null;

  // Worktree prefetch is intentionally not wired: usePrefetchNeighbors reuses
  // useDiffContent's committed query key shape, which does not address the
  // worktree diff endpoint. A second hook variant is needed before worktree
  // navigation can benefit from Layer 2 prefetching.
  usePrefetchNeighbors({
    orderedFiles: committedOrderedFiles,
    selectedPath: committedSelectedPath,
    oldRef,
    newRef,
    depth: PREFETCH_DEPTH,
  });
  const { commits } = useCommitList(oldRef, newRef);
  const commitSelection = useCommitSelection(commits);

  const handleSelectCommit = commitSelection.selectCommit;

  const {
    handleSelectCommittedFile,
    handleSelectWorktreeFile,
    handleSelectCommittedDirectory,
    handleSelectWorktreeDirectory,
  } = useFileSelectionHandlers({
    files,
    worktreeFiles,
    multiSelect,
  });

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

  const commitFileSelection = useCommitFileSelection();
  const commitFileDiffs = useCommitFileDiffs(commitFileSelection.entries);

  const selectedCommitFileKeys = useMemo(
    () => new Set(commitFileSelection.entries.map((e) => `${e.sha}:${e.path}`)),
    [commitFileSelection.entries],
  );

  const handleSelectCommitFile = commitFileSelection.selectCommitFile;

  return {
    multiSelect,
    commits,
    commitSelection,
    commitDiffs,
    commitFileSelection,
    commitFileDiffs,
    selectedCommitFileKeys,
    committedFilePaths,
    worktreeFilePaths,
    handleSelectCommit,
    handleSelectCommittedFile,
    handleSelectWorktreeFile,
    handleSelectCommittedDirectory,
    handleSelectWorktreeDirectory,
    handleSelectCommitFile,
  };
};
