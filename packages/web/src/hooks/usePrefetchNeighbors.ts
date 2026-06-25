import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { FileNode } from '../fixtures/types';
import { nextFilesToPrefetch } from './nextFilesToPrefetch';
import { fetchDiffContent } from './useDiffContent';

interface UsePrefetchNeighborsOptions {
  orderedFiles: FileNode[];
  selectedPath: string | null;
  oldRef: string;
  newRef: string;
  depth: number;
}

export const usePrefetchNeighbors = ({
  orderedFiles,
  selectedPath,
  oldRef,
  newRef,
  depth,
}: UsePrefetchNeighborsOptions): void => {
  const queryClient = useQueryClient();
  const neighborsRef = useRef<FileNode[]>([]);
  neighborsRef.current = nextFilesToPrefetch(orderedFiles, selectedPath, depth);

  // Key off a value-stable signature instead of orderedFiles identity — a
  // query refetch or parent re-render with a fresh array but identical path
  // set would otherwise re-trigger prefetch on every render.
  const signature = `${selectedPath ?? ''}\u0000${oldRef}\u0000${newRef}\u0000${neighborsRef.current.map((n) => n.path).join('\u0001')}`;

  useEffect(() => {
    if (oldRef === '' || newRef === '') {
      return;
    }
    for (const neighbor of neighborsRef.current) {
      // Match useDiffContent's query options so the prefetched entry is
      // reused on selection and a speculative prefetch doesn't retry on
      // transient errors.
      void queryClient.prefetchQuery({
        queryKey: ['diff', oldRef, newRef, neighbor.path],
        queryFn: () => fetchDiffContent(oldRef, newRef, neighbor.path),
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      });
    }
  }, [queryClient, oldRef, newRef, signature]);
};
