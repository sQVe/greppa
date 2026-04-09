import type { FileEntry } from '@greppa/core';
import { useQuery } from '@tanstack/react-query';

import type { ChangeType, FileNode } from '../fixtures/types';

const CHANGE_TYPE_PRIORITY: Record<ChangeType, number> = {
  added: 0,
  deleted: 1,
  modified: 2,
  renamed: 3,
};

const higherPriority = (a: ChangeType | undefined, b: ChangeType | undefined): ChangeType | undefined => {
  if (a == null) {
    return b;
  }
  if (b == null) {
    return a;
  }
  return CHANGE_TYPE_PRIORITY[a] <= CHANGE_TYPE_PRIORITY[b] ? a : b;
};

export const propagateChangeType = (nodes: FileNode[]): FileNode[] =>
  nodes.map((node) => {
    if (node.type !== 'directory' || node.children == null) {
      return node;
    }

    const updatedChildren = propagateChangeType(node.children);
    let changeType: ChangeType | undefined;
    for (const child of updatedChildren) {
      changeType = higherPriority(changeType, child.changeType);
    }

    return { ...node, children: updatedChildren, changeType };
  });

export const compactTree = (nodes: FileNode[]): FileNode[] =>
  nodes.map((node) => {
    if (node.type !== 'directory' || node.children == null) {
      return node;
    }

    let current = node;
    const segments = [current.name];

    let onlyChild = current.children?.length === 1 ? current.children[0] : undefined;
    while (onlyChild?.type === 'directory') {
      current = onlyChild;
      segments.push(current.name);
      onlyChild = current.children?.length === 1 ? current.children[0] : undefined;
    }

    const compactedChildren = compactTree(current.children ?? []);

    if (segments.length === 1) {
      return { ...node, children: compactedChildren };
    }

    return {
      ...current,
      displayName: segments.join('/'),
      children: compactedChildren,
    };
  });

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
  const dirs = new Map<string, FileNode>();
  const topFiles = new Map<string, FileNode>();

  const ensureDir = (segments: string[]): FileNode => {
    const path = segments.join('/');
    const existing = dirs.get(path);
    if (existing != null) {
      return existing;
    }

    const node: FileNode = {
      path,
      name: segments[segments.length - 1] ?? '',
      type: 'directory',
      children: [],
    };

    dirs.set(path, node);

    if (segments.length > 1) {
      const parent = ensureDir(segments.slice(0, -1));
      if (!parent.children?.some((child) => child.path === path)) {
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
      lineCount: entry.lineCount,
      sizeTier: entry.sizeTier,
    };

    if (segments.length === 1) {
      topFiles.set(entry.path, fileNode);
    } else {
      const parent = ensureDir(segments.slice(0, -1));
      parent.children?.push(fileNode);
    }
  }

  const topDirs = [...dirs.values()].filter((node) => !node.path.includes('/'));
  const topLevel = [...topDirs, ...topFiles.values()];

  return compactTree(propagateChangeType(sortNodes(topLevel)));
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
    enabled: oldRef !== '' && newRef !== '',
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
