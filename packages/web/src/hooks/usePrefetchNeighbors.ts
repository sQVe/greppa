import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { FileNode } from '../fixtures/types';
import { fetchDiffContent } from './useDiffContent';
import { nextFilesToPrefetch } from './nextFilesToPrefetch';

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
  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (oldRef === '' || newRef === '') {
      return;
    }

    const neighbors = nextFilesToPrefetch(orderedFiles, selectedPath, depth);
    const signature = [
      selectedPath ?? '',
      oldRef,
      newRef,
      neighbors.map((n) => n.path).join('\u0001'),
    ].join('\u0000');
    if (lastSignatureRef.current === signature) {
      return;
    }
    lastSignatureRef.current = signature;

    for (const neighbor of neighbors) {
      void queryClient.prefetchQuery({
        queryKey: ['diff', oldRef, newRef, neighbor.path],
        queryFn: () => fetchDiffContent(oldRef, newRef, neighbor.path),
      });
    }
  }, [queryClient, orderedFiles, selectedPath, oldRef, newRef, depth]);
};
