import { useQueries } from '@tanstack/react-query';

import type { DiffFile } from '../fixtures/types';
import type { CommitFileEntry } from './useCommitFileSelection';
import { fetchAndComputeDiff } from './useComputedDiffs';

export interface CommitFileDiffsResult {
  diffs: DiffFile[];
  failedPaths: string[];
}

export const useCommitFileDiffs = (
  entries: readonly CommitFileEntry[],
): CommitFileDiffsResult => {
  return useQueries({
    queries: entries.map((entry) => ({
      queryKey: ['computed-diff', 'commit-file', entry.sha, entry.path],
      queryFn: () => fetchAndComputeDiff(entry.path, 'committed', `${entry.sha}^`, entry.sha),
      retry: false,
      staleTime: Infinity,
    })),
    combine: (results) => {
      const diffs: DiffFile[] = [];
      const failedPaths: string[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result == null) {
          continue;
        }
        if (result.data != null) {
          diffs.push(result.data);
        } else if (result.isError) {
          const entry = entries[i];
          failedPaths.push(entry != null ? `${entry.sha}:${entry.path}` : '');
        }
      }

      return { diffs, failedPaths };
    },
  });
};
