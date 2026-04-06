import type { CommitEntry } from '@greppa/core';
import { useQuery } from '@tanstack/react-query';

export const fetchCommits = async (oldRef: string, newRef: string): Promise<CommitEntry[]> => {
  const params = new URLSearchParams({ oldRef, newRef });
  const response = await fetch(`/api/commits?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch commits: ${response.status}`);
  }

  // oxlint-disable-next-line no-unsafe-type-assertion -- JSON response matches API schema
  return response.json() as Promise<CommitEntry[]>;
};

export const useCommitList = (oldRef: string, newRef: string) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['commits', oldRef, newRef],
    queryFn: () => fetchCommits(oldRef, newRef),
    enabled: oldRef !== '' && newRef !== '',
    retry: false,
    staleTime: Infinity,
  });

  return {
    commits: data ?? [],
    isLoading,
    isError,
  };
};
