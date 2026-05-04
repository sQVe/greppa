import { useCallback, useMemo } from 'react';

import { collectDirectoryIds } from '../components/FileTree/FileTree';
import type { FileNode } from '../fixtures/types';
import { useReviewState } from './useReviewState';

export const useTreeState = (
  files: FileNode[],
  sessionId: string,
  forcedOpenKeys?: ReadonlySet<string>,
) => {
  const { state: reviewState, set: setReviewState } = useReviewState(sessionId);
  const allDirectoryIds = useMemo(() => collectDirectoryIds(files), [files]);
  const expandedKeys = useMemo(() => {
    const collapsed = new Set(reviewState.collapsedPaths);
    const base = allDirectoryIds.filter((id) => !collapsed.has(id));

    if (forcedOpenKeys == null || forcedOpenKeys.size === 0) {
      return new Set(base);
    }

    return new Set([...base, ...forcedOpenKeys]);
  }, [allDirectoryIds, reviewState.collapsedPaths, forcedOpenKeys]);

  const handleExpandedKeysChange = useCallback(
    (keys: Set<string | number>) => {
      const previouslyCollapsed = new Set(reviewState.collapsedPaths);
      const forcedAncestors = forcedOpenKeys == null ? [] : [...forcedOpenKeys].map((k) => `${k}/`);
      const isUnderForcedOpen = (id: string) =>
        forcedAncestors.some((prefix) => id.startsWith(prefix));

      const collapsed = allDirectoryIds.filter((id) => {
        if (forcedOpenKeys?.has(id) ?? false) return true;
        if (isUnderForcedOpen(id)) return previouslyCollapsed.has(id);
        return !keys.has(id);
      });

      setReviewState({ collapsedPaths: collapsed });
    },
    [allDirectoryIds, setReviewState, forcedOpenKeys, reviewState.collapsedPaths],
  );

  const reviewedPaths = useMemo(
    () => new Set(reviewState.reviewedPaths),
    [reviewState.reviewedPaths],
  );

  const reviewedCommitFiles = useMemo(
    () => new Set(reviewState.reviewedCommitFiles),
    [reviewState.reviewedCommitFiles],
  );

  const toggleReviewed = useCallback(
    (path: string) => {
      const current = reviewState.reviewedPaths;
      const next = current.includes(path) ? current.filter((p) => p !== path) : [...current, path];
      setReviewState({ reviewedPaths: next });
    },
    [reviewState.reviewedPaths, setReviewState],
  );

  const toggleReviewedCommitFile = useCallback(
    (key: string) => {
      const current = reviewState.reviewedCommitFiles;
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      setReviewState({ reviewedCommitFiles: next });
    },
    [reviewState.reviewedCommitFiles, setReviewState],
  );

  return {
    expandedKeys,
    handleExpandedKeysChange,
    reviewedCommitFiles,
    reviewedPaths,
    toggleReviewed,
    toggleReviewedCommitFile,
  };
};
