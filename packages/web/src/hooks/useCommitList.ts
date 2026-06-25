import type { CommitEntry } from '@greppa/core';
import { useQuery } from '@tanstack/react-query';

import { sortPathsTreeOrder } from './useFileList';

export const fetchCommits = async (oldRef: string, newRef: string): Promise<CommitEntry[]> => {
  const params = new URLSearchParams({ oldRef, newRef });
  const response = await fetch(`/api/commits?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch commits: ${response.status}`);
  }

  // oxlint-disable-next-line no-unsafe-type-assertion -- JSON response matches API schema
  return response.json() as Promise<CommitEntry[]>;
};

// Server returns each commit's files in `git log --name-only` order; reorder to
// the same tree-DFS layout the file tree uses so visual lists and selection
// ranges stay consistent across views.
const sortCommitFiles = (commits: CommitEntry[]): CommitEntry[] =>
  commits.map((commit) => ({ ...commit, files: sortPathsTreeOrder(commit.files) }));

export const useCommitList = (oldRef: string, newRef: string) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['commits', oldRef, newRef],
    queryFn: () => fetchCommits(oldRef, newRef),
    enabled: oldRef !== '' && newRef !== '',
    retry: false,
    staleTime: Infinity,
    select: sortCommitFiles,
  });

  return {
    commits: data ?? [],
    isLoading,
    isError,
  };
};
