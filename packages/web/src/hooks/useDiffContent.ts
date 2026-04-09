import type { DiffResponse } from '@greppa/core';
import { useQuery } from '@tanstack/react-query';

import { getDiff, setDiff } from './diffCache';

export const fetchDiffContent = async (
  oldRef: string,
  newRef: string,
  path: string,
): Promise<DiffResponse> => {
  const key = { oldRef, newRef, path };
  const cached = await getDiff(key).catch(() => null);
  if (cached != null) {
    return cached;
  }

  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const response = await fetch(
    `/api/diff/${encodeURIComponent(oldRef)}/${encodeURIComponent(newRef)}/${encodedPath}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch diff: ${response.status}`);
  }

  // oxlint-disable-next-line no-unsafe-type-assertion -- JSON response matches API schema
  const value = (await response.json()) as DiffResponse;
  // Fire-and-forget: cache write must not block or break the returned diff.
  // Swallows quota/Safari-private-mode errors — next session simply refetches.
  void setDiff(key, value).catch(() => {});
  return value;
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
    enabled: path != null && oldRef !== '' && newRef !== '',
    retry: false,
    staleTime: Infinity,
  });

  return { diff: data ?? null, isLoading, isError };
};
