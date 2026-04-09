import type { FileNode } from '../fixtures/types';

export const nextFilesToPrefetch = (
  orderedFiles: FileNode[],
  selectedPath: string | null,
  depth: number,
): FileNode[] => {
  if (selectedPath == null) {
    return [];
  }
  const index = orderedFiles.findIndex((node) => node.path === selectedPath);
  if (index === -1) {
    return [];
  }

  const result: FileNode[] = [];
  for (const node of orderedFiles.slice(index + 1)) {
    if (result.length >= depth) {
      break;
    }
    if (node.sizeTier === 'large') {
      continue;
    }
    result.push(node);
  }
  return result;
};
