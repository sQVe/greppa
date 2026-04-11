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
  for (let i = index + 1; i < orderedFiles.length && result.length < depth; i++) {
    const node = orderedFiles[i];
    if (node?.type !== 'file' || node.sizeTier === 'large') {
      continue;
    }
    result.push(node);
  }
  return result;
};
