import type { FileNode } from '../fixtures/types';

export type FilterPredicate = (file: FileNode) => boolean;

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

const filterFile = (node: FileNode, predicate: FilterPredicate): FilterFrame | null =>
  predicate(node) ? { kept: [node], visible: 1 } : null;

const filterDirectory = (
  node: FileNode,
  predicate: FilterPredicate,
  autoExpand: Set<string>,
): FilterFrame | null => {
  const childResult = filterNodes(node.children ?? [], predicate, autoExpand);
  if (childResult.visible === 0) return null;
  autoExpand.add(node.path);
  return {
    kept: [{ ...node, children: childResult.kept }],
    visible: childResult.visible,
  };
};

const filterNode = (
  node: FileNode,
  predicate: FilterPredicate,
  autoExpand: Set<string>,
): FilterFrame | null =>
  node.type === 'file' ? filterFile(node, predicate) : filterDirectory(node, predicate, autoExpand);

const mergeFrame = (acc: FilterFrame, frame: FilterFrame | null): FilterFrame =>
  frame == null
    ? acc
    : { kept: [...acc.kept, ...frame.kept], visible: acc.visible + frame.visible };

const filterNodes = (
  nodes: FileNode[],
  predicate: FilterPredicate,
  autoExpand: Set<string>,
): FilterFrame =>
  nodes.reduce<FilterFrame>(
    (acc, node) => mergeFrame(acc, filterNode(node, predicate, autoExpand)),
    { kept: [], visible: 0 },
  );

export const applyFilter = (
  files: FileNode[],
  predicate: FilterPredicate | null,
): ApplyFilterResult => {
  if (predicate == null) {
    const total = countFiles(files);
    return {
      files,
      autoExpand: EMPTY_AUTO_EXPAND,
      visibleCount: total,
      totalCount: total,
    };
  }

  const autoExpand = new Set<string>();
  const { kept, visible } = filterNodes(files, predicate, autoExpand);
  const total = countFiles(files);

  return {
    files: kept,
    autoExpand,
    visibleCount: visible,
    totalCount: total,
  };
};
