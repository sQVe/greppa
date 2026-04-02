import { useMatch, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo } from 'react';

import type { CommentThread, DiffFile, FileInfo, FileNode } from './fixtures/types';
import { useReviewState } from './hooks/useReviewState';

export const collectFiles = (nodes: FileNode[]): FileNode[] =>
  nodes.flatMap((node) => (node.type === 'file' ? [node] : collectFiles(node.children ?? [])));

export const useFileSelection = (
  files: FileNode[],
  diffs: Map<string, DiffFile>,
  comments: CommentThread[],
  fileInfoMap: Map<string, FileInfo>,
) => {
  const allFiles = useMemo(() => collectFiles(files), [files]);
  const validPaths = useMemo(() => new Set(allFiles.map((file) => file.path)), [allFiles]);

  const fileMatch = useMatch({ from: '/file/$', shouldThrow: false });
  const urlFile = fileMatch?.params._splat ?? null;
  const navigate = useNavigate();

  const selectedFilePath = urlFile != null && validPaths.has(urlFile) ? urlFile : null;

  const { state: reviewState, set: setReviewState } = useReviewState('default');
  const reviewedPaths = useMemo(
    () => new Set(reviewState.reviewedPaths),
    [reviewState.reviewedPaths],
  );

  const initialReviewedPaths = useMemo(
    () => allFiles.filter((file) => file.status === 'reviewed').map((file) => file.path),
    [allFiles],
  );

  useEffect(() => {
    let paths = reviewState.reviewedPaths;

    if (paths.length === 0 && initialReviewedPaths.length > 0) {
      paths = initialReviewedPaths;
    }

    if (selectedFilePath != null && !new Set(paths).has(selectedFilePath)) {
      paths = [...paths, selectedFilePath];
    }

    if (paths !== reviewState.reviewedPaths) {
      setReviewState({ reviewedPaths: paths });
    }
  }, [selectedFilePath, initialReviewedPaths, reviewState.reviewedPaths, setReviewState]);

  const selectFile = useCallback(
    (path: string) => {
      void navigate({ to: '/file/$', params: { _splat: path } });
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
    selectFile,
    reviewedCount: reviewedPaths.size,
    totalCount: allFiles.length,
    selectedDiff,
    selectedThreads,
    selectedFileInfo,
  };
};
