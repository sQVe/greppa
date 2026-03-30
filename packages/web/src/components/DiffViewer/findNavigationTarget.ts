import type { VirtualItem } from './buildVirtualItems';

export type NavigationAction = 'nextHunk' | 'prevHunk' | 'nextChange' | 'prevChange';

const isChangedRow = (item: VirtualItem) => {
  if (item.kind !== 'diff-row') {
    return false;
  }

  const leftType = item.row.left?.type;
  const rightType = item.row.right?.type;

  return leftType === 'removed' || leftType === 'added' || rightType === 'removed' || rightType === 'added';
};

export const findNavigationTarget = (
  items: VirtualItem[],
  currentIndex: number,
  action: NavigationAction,
): number | null => {
  if (action === 'nextHunk') {
    for (let i = currentIndex + 1; i < items.length; i++) {
      if (items[i]?.kind === 'hunk-header') {
        return i;
      }
    }

    return null;
  }

  if (action === 'prevHunk') {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (items[i]?.kind === 'hunk-header') {
        return i;
      }
    }

    return null;
  }

  if (action === 'nextChange') {
    for (let i = currentIndex + 1; i < items.length; i++) {
      const item = items[i];
      if (item != null && isChangedRow(item)) {
        return i;
      }
    }

    return null;
  }

  for (let i = currentIndex - 1; i >= 0; i--) {
    const item = items[i];
    if (item != null && isChangedRow(item)) {
      return i;
    }
  }

  return null;
};
