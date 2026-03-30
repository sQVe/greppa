import { useMatch, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CommentThread, DiffFile, FileInfo, FileNode } from './fixtures/types';

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

  const [reviewedPaths, setReviewedPaths] = useState<Set<string>>(
    () => new Set(allFiles.filter((file) => file.status === 'reviewed').map((file) => file.path)),
  );

  useEffect(() => {
    if (selectedFilePath == null) {
      return;
    }

    setReviewedPaths((prev) => (prev.has(selectedFilePath) ? prev : new Set([...prev, selectedFilePath])));
  }, [selectedFilePath]);

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
