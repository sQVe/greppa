import { useMatch, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo } from 'react';

import type { CommentThread, DiffFile, FileInfo, FileNode } from './fixtures/types';
import { useReviewState } from './hooks/useReviewState';

export type FileSource = 'committed' | 'worktree';

export const collectFiles = (nodes: FileNode[]): FileNode[] =>
  nodes.flatMap((node) => (node.type === 'file' ? [node] : collectFiles(node.children ?? [])));

export const collectDescendantFilePaths = (nodes: FileNode[], directoryPath: string): string[] => {
  for (const node of nodes) {
    if (node.path === directoryPath && node.type === 'directory') {
      return collectFiles(node.children ?? []).map((file) => file.path);
    }
    if (node.children != null) {
      const result = collectDescendantFilePaths(node.children, directoryPath);
      if (result.length > 0) {
        return result;
      }
    }
  }
  return [];
};

// eslint-disable-next-line max-params -- hook coordinates file selection across committed and worktree sources
export const useFileSelection = (
  files: FileNode[],
  worktreeFiles: FileNode[],
  diffs: Map<string, DiffFile>,
  comments: CommentThread[],
  fileInfoMap: Map<string, FileInfo>,
) => {
  const allCommittedFiles = useMemo(() => collectFiles(files), [files]);
  const allWorktreeFiles = useMemo(() => collectFiles(worktreeFiles), [worktreeFiles]);
  const committedPaths = useMemo(
    () => new Set(allCommittedFiles.map((file) => file.path)),
    [allCommittedFiles],
  );
  const worktreePaths = useMemo(
    () => new Set(allWorktreeFiles.map((file) => file.path)),
    [allWorktreeFiles],
  );

  const fileMatch = useMatch({ from: '/file/$', shouldThrow: false });
  const wtMatch = useMatch({ from: '/wt/$', shouldThrow: false });
  const urlFile = fileMatch?.params._splat ?? null;
  const urlWtFile = wtMatch?.params._splat ?? null;
  const navigate = useNavigate();

  const selectedSource: FileSource | null = useMemo(() => {
    if (urlFile != null && committedPaths.has(urlFile)) {
      return 'committed';
    }
    if (urlWtFile != null && worktreePaths.has(urlWtFile)) {
      return 'worktree';
    }
    return null;
  }, [urlFile, urlWtFile, committedPaths, worktreePaths]);

  const selectedFilePath = useMemo(() => {
    if (selectedSource === 'committed') {
      return urlFile;
    }
    if (selectedSource === 'worktree') {
      return urlWtFile;
    }
    return null;
  }, [selectedSource, urlFile, urlWtFile]);

  const allFiles = useMemo(
    () => [...allCommittedFiles, ...allWorktreeFiles],
    [allCommittedFiles, allWorktreeFiles],
  );
  const validPaths = useMemo(
    () => new Set(allFiles.map((file) => file.path)),
    [allFiles],
  );

  const { state: reviewState, set: setReviewState, get: getReviewState } = useReviewState('default');
  const reviewedPaths = useMemo(
    () => new Set(reviewState.reviewedPaths.filter((path) => validPaths.has(path))),
    [reviewState.reviewedPaths, validPaths],
  );

  const initialReviewedPaths = useMemo(
    () => allFiles.filter((file) => file.status === 'reviewed').map((file) => file.path),
    [allFiles],
  );

  useEffect(() => {
    if (initialReviewedPaths.length === 0) {
      return;
    }
    const current = getReviewState();
    const existing = new Set(current.reviewedPaths);
    const missing = initialReviewedPaths.filter((path) => !existing.has(path));
    if (missing.length > 0) {
      setReviewState({ reviewedPaths: [...current.reviewedPaths, ...missing] });
    }
  }, [initialReviewedPaths, getReviewState, setReviewState]);

  useEffect(() => {
    if (selectedFilePath == null) {
      return;
    }
    const current = getReviewState();
    if (new Set(current.reviewedPaths).has(selectedFilePath)) {
      return;
    }
    setReviewState({ reviewedPaths: [...current.reviewedPaths, selectedFilePath] });
  }, [selectedFilePath, getReviewState, setReviewState]);

  const selectCommittedFile = useCallback(
    (path: string) => {
      void navigate({ to: '/file/$', params: { _splat: path } });
    },
    [navigate],
  );

  const selectWorktreeFile = useCallback(
    (path: string) => {
      void navigate({ to: '/wt/$', params: { _splat: path } });
    },
    [navigate],
  );

  const selectedDiff = selectedFilePath != null ? (diffs.get(selectedFilePath) ?? null) : null;

  const selectedThreads =
    selectedFilePath != null
      ? comments.filter((thread) => thread.filePath === selectedFilePath)
      : [];

  const selectedFileInfo =
    selectedFilePath != null ? (fileInfoMap.get(selectedFilePath) ?? null) : null;

  return {
    selectedFilePath,
    selectedSource,
    selectCommittedFile,
    selectWorktreeFile,
    reviewedCount: reviewedPaths.size,
    totalCount: allFiles.length,
    selectedDiff,
    selectedThreads,
    selectedFileInfo,
  };
};
