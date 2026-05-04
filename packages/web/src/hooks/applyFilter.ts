import type { FileNode } from '../fixtures/types';

export interface ApplyFilterResult {
  files: FileNode[];
  autoExpand: ReadonlySet<string>;
  visibleCount: number;
  totalCount: number;
}

interface FilterFrame {
  kept: FileNode[];
  visible: number;
}

const EMPTY_AUTO_EXPAND: ReadonlySet<string> = new Set();

const countFiles = (nodes: FileNode[]): number => {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file') {
      count += 1;
    } else if (node.children != null) {
      count += countFiles(node.children);
    }
  }
  return count;
};

const matchesNeedle = (node: FileNode, needle: string): boolean =>
  node.name.toLowerCase().includes(needle);

const filterFile = (node: FileNode, needle: string): FilterFrame | null =>
  matchesNeedle(node, needle) ? { kept: [node], visible: 1 } : null;

const filterDirectory = (
  node: FileNode,
  needle: string,
  autoExpand: Set<string>,
): FilterFrame | null => {
  const childResult = filterNodes(node.children ?? [], needle, autoExpand);
  if (childResult.visible === 0) return null;
  autoExpand.add(node.path);
  return {
    kept: [{ ...node, children: childResult.kept }],
    visible: childResult.visible,
  };
};

const filterNode = (
  node: FileNode,
  needle: string,
  autoExpand: Set<string>,
): FilterFrame | null =>
  node.type === 'file' ? filterFile(node, needle) : filterDirectory(node, needle, autoExpand);

const mergeFrame = (acc: FilterFrame, frame: FilterFrame | null): FilterFrame =>
  frame == null
    ? acc
    : { kept: [...acc.kept, ...frame.kept], visible: acc.visible + frame.visible };

const filterNodes = (nodes: FileNode[], needle: string, autoExpand: Set<string>): FilterFrame =>
  nodes.reduce<FilterFrame>(
    (acc, node) => mergeFrame(acc, filterNode(node, needle, autoExpand)),
    { kept: [], visible: 0 },
  );

export const applyFilter = (files: FileNode[], query: string): ApplyFilterResult => {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    const total = countFiles(files);
    return {
      files,
      autoExpand: EMPTY_AUTO_EXPAND,
      visibleCount: total,
      totalCount: total,
    };
  }

  const needle = trimmed.toLowerCase();
  const autoExpand = new Set<string>();
  const { kept, visible } = filterNodes(files, needle, autoExpand);
  const total = countFiles(files);

  return {
    files: kept,
    autoExpand,
    visibleCount: visible,
    totalCount: total,
  };
};
