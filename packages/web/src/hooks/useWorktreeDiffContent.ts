import type { DiffResponse } from '@greppa/core';
import { useQuery } from '@tanstack/react-query';

export const fetchWorktreeDiffContent = async (path: string): Promise<DiffResponse> => {
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const response = await fetch(`/api/worktree/diff/${encodedPath}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch working tree diff: ${response.status}`);
  }

  // oxlint-disable-next-line no-unsafe-type-assertion -- JSON response matches API schema
  return response.json() as Promise<DiffResponse>;
};

export const useWorktreeDiffContent = (path: string | null) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['worktree-diff', path],
    queryFn: () => {
      if (path == null) {
        throw new Error('path is required');
      }
      return fetchWorktreeDiffContent(path);
    },
    enabled: path != null,
    retry: false,
    staleTime: 0,
  });

  return { diff: data ?? null, isLoading, isError };
};
