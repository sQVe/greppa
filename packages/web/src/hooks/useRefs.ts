import type { RefsResponse } from '@greppa/core';
import { useQuery } from '@tanstack/react-query';

export const fetchRefs = async (): Promise<RefsResponse> => {
  const response = await fetch('/api/refs');
  if (!response.ok) {
    throw new Error(`Failed to fetch refs: ${response.status}`);
  }

  // oxlint-disable-next-line no-unsafe-type-assertion -- JSON response matches API schema
  return response.json() as Promise<RefsResponse>;
};

export const useRefs = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['refs'],
    queryFn: fetchRefs,
    retry: false,
    staleTime: Infinity,
  });

  return {
    oldRef: data?.oldRef ?? null,
    newRef: data?.newRef ?? null,
    isLoading,
  };
};
