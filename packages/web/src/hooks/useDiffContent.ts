import type { DiffResponse } from '@greppa/core';
import { useQuery } from '@tanstack/react-query';

export const fetchDiffContent = async (
  oldRef: string,
  newRef: string,
  path: string,
): Promise<DiffResponse> => {
  const response = await fetch(`/api/diff/${oldRef}/${newRef}/${path}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch diff: ${response.status}`);
  }

  // oxlint-disable-next-line no-unsafe-type-assertion -- JSON response matches API schema
  return response.json() as Promise<DiffResponse>;
};

export const useDiffContent = (oldRef: string, newRef: string, path: string | null) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['diff', oldRef, newRef, path],
    queryFn: () => {
      if (path == null) {
        throw new Error('path is required');
      }
      return fetchDiffContent(oldRef, newRef, path);
    },
    enabled: path != null,
    retry: false,
  });

  return { diff: data ?? null, isLoading, isError };
};
