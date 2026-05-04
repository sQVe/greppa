import type { ChangeType, FileNode } from '../fixtures/types';

export interface ExtensionCount {
  extension: string;
  count: number;
}

export interface StatusCounts {
  reviewed: number;
  unreviewed: number;
}

const CHANGE_TYPES: ReadonlySet<ChangeType> = new Set([
  'added',
  'modified',
  'deleted',
  'renamed',
]);

const getExtension = (name: string): string => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot + 1).toLowerCase();
};

const walkFiles = (nodes: FileNode[], visit: (file: FileNode) => void) => {
  for (const node of nodes) {
    if (node.type === 'file') {
      visit(node);
    } else if (node.children != null) {
      walkFiles(node.children, visit);
    }
  }
};

export const collectExtensionCounts = (files: FileNode[]): ExtensionCount[] => {
  const counts = new Map<string, number>();
  walkFiles(files, (file) => {
    const extension = getExtension(file.name);
    if (extension === '') return;
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([extension, count]) => ({ extension, count }))
    .toSorted((a, b) => b.count - a.count || a.extension.localeCompare(b.extension));
};

export const collectChangeTypeCounts = (files: FileNode[]): Record<ChangeType, number> => {
  const counts: Record<ChangeType, number> = { added: 0, modified: 0, deleted: 0, renamed: 0 };
  walkFiles(files, (file) => {
    if (file.changeType != null && CHANGE_TYPES.has(file.changeType)) {
      counts[file.changeType] += 1;
    }
  });
  return counts;
};

export const collectStatusCounts = (
  files: FileNode[],
  reviewedPaths: ReadonlySet<string>,
): StatusCounts => {
  let reviewed = 0;
  let unreviewed = 0;
  walkFiles(files, (file) => {
    if (reviewedPaths.has(file.path)) {
      reviewed += 1;
    } else {
      unreviewed += 1;
    }
  });
  return { reviewed, unreviewed };
};
