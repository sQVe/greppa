import type { FileEntry } from '@greppa/core';
import { useQuery } from '@tanstack/react-query';

import { buildFileTree } from './useFileList';

export const fetchWorktreeFiles = async (): Promise<FileEntry[]> => {
  const response = await fetch('/api/worktree/files');
  if (!response.ok) {
    throw new Error(`Failed to fetch working tree files: ${response.status}`);
  }

  // oxlint-disable-next-line no-unsafe-type-assertion -- JSON response matches API schema
  return response.json() as Promise<FileEntry[]>;
};

export const useWorktreeFiles = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['worktree-files'],
    queryFn: fetchWorktreeFiles,
    retry: false,
    staleTime: 5_000,
    refetchInterval: 5_000,
    select: buildFileTree,
  });

  return {
    files: data ?? null,
    isLoading,
    isError,
  };
};
