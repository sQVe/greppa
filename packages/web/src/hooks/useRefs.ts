import type { RefsResponse } from '@greppa/core';
import { useQuery } from '@tanstack/react-query';

export const fetchRefs = async (): Promise<RefsResponse> => {
  const response = await fetch('/api/refs');
  if (!response.ok) {
    throw new Error(`Failed to fetch refs: ${response.status}`);
  }

  const json: unknown = await response.json();
  if (
    json == null ||
    typeof json !== 'object' ||
    !('oldRef' in json) ||
    typeof json.oldRef !== 'string' ||
    !('newRef' in json) ||
    typeof json.newRef !== 'string' ||
    !('mergeBaseRef' in json) ||
    typeof json.mergeBaseRef !== 'string'
  ) {
    throw new Error('Invalid refs response payload');
  }

  return { oldRef: json.oldRef, newRef: json.newRef, mergeBaseRef: json.mergeBaseRef };
};

export const useRefs = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['refs'],
    queryFn: fetchRefs,
    retry: false,
    staleTime: Infinity,
  });

  return {
    oldRef: data?.oldRef ?? null,
    newRef: data?.newRef ?? null,
    mergeBaseRef: data?.mergeBaseRef ?? null,
    isLoading,
    isError,
  };
};
