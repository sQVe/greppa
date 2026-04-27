import { useQueries } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { CommitFileEntry } from '../commitFileKey';
import { encodeCommitFileKey } from '../commitFileKey';
import type { DiffFile } from '../fixtures/types';
import { fetchAndComputeDiff } from './useComputedDiffs';

export interface CommitFileDiffsResult {
  diffs: DiffFile[];
  failedPaths: string[];
}

export const useCommitFileDiffs = (
  entries: readonly CommitFileEntry[],
): CommitFileDiffsResult => {
  // Root commits (no parent) fail here and land in failedPaths — `^1` is an
  // explicit first-parent form; it makes intent clearer but does not resolve
  // for initial commits. Non-blocking for typical ref-to-ref ranges.
  const combine = useCallback(
    (results: UseQueryResult<DiffFile | null>[]) => {
      const diffs: DiffFile[] = [];
      const failedPaths: string[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result == null) {
          continue;
        }
        const entry = entries[i];
        if (result.data != null) {
          diffs.push(entry != null ? { ...result.data, sha: entry.sha } : result.data);
        } else if (result.isError) {
          if (entry != null) {
            failedPaths.push(encodeCommitFileKey(entry));
          }
        }
      }

      return { diffs, failedPaths };
    },
    [entries],
  );

  return useQueries({
    queries: entries.map((entry) => ({
      queryKey: ['computed-diff', 'commit-file', entry.sha, entry.path],
      queryFn: () => fetchAndComputeDiff(entry.path, 'committed', `${entry.sha}^1`, entry.sha),
      retry: false,
      staleTime: Infinity,
    })),
    combine,
  });
};
