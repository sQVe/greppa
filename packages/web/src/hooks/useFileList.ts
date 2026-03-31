import type { FileEntry } from '@greppa/core';
import { useQuery } from '@tanstack/react-query';

import type { FileNode } from '../fixtures/types';

const sortNodes = (nodes: FileNode[]): FileNode[] =>
  nodes
    .map((node) => (node.children != null ? { ...node, children: sortNodes(node.children) } : node))
    .toSorted((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

export const buildFileTree = (entries: FileEntry[]): FileNode[] => {
  const root = new Map<string, FileNode>();

  const ensureDir = (segments: string[]): FileNode => {
    const path = segments.join('/');
    const existing = root.get(path);
    if (existing != null) {
      return existing;
    }

    const node: FileNode = {
      path,
      name: segments[segments.length - 1] ?? '',
      type: 'directory',
      children: [],
    };

    root.set(path, node);

    if (segments.length > 1) {
      const parent = ensureDir(segments.slice(0, -1));
      if (!parent.children?.some((c) => c.path === path)) {
        parent.children?.push(node);
      }
    }

    return node;
  };

  for (const entry of entries) {
    const segments = entry.path.split('/');
    const fileName = segments[segments.length - 1] ?? '';

    const fileNode: FileNode = {
      path: entry.path,
      name: fileName,
      type: 'file',
      changeType: entry.changeType,
      oldPath: entry.oldPath,
    };

    if (segments.length === 1) {
      root.set(entry.path, fileNode);
    } else {
      const parent = ensureDir(segments.slice(0, -1));
      parent.children?.push(fileNode);
    }
  }

  const topLevel = [...root.values()].filter((node) => {
    const segments = node.path.split('/');
    return segments.length === 1;
  });

  return sortNodes(topLevel);
};

const fetchFiles = async (oldRef: string, newRef: string): Promise<FileEntry[]> => {
  const params = new URLSearchParams({ oldRef, newRef });
  const response = await fetch(`/api/files?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch files: ${response.status}`);
  }

  // oxlint-disable-next-line no-unsafe-type-assertion -- JSON response matches API schema
  return response.json() as Promise<FileEntry[]>;
};

export const useFileList = (oldRef: string, newRef: string) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['files', oldRef, newRef],
    queryFn: () => fetchFiles(oldRef, newRef),
    retry: false,
    staleTime: Infinity,
    select: buildFileTree,
  });

  return {
    files: data ?? null,
    isLoading,
    isError,
  };
};
