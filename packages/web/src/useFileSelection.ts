import { useCallback, useMemo, useState } from 'react';

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

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [reviewedPaths, setReviewedPaths] = useState<Set<string>>(
    () => new Set(allFiles.filter((f) => f.status === 'reviewed').map((f) => f.path)),
  );

  const selectFile = useCallback((path: string) => {
    setSelectedFilePath(path);
    setReviewedPaths((prev) => (prev.has(path) ? prev : new Set([...prev, path])));
  }, []);

  const selectedDiff = selectedFilePath != null ? (diffs.get(selectedFilePath) ?? null) : null;

  const selectedThreads =
    selectedFilePath != null ? comments.filter((t) => t.filePath === selectedFilePath) : [];

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
