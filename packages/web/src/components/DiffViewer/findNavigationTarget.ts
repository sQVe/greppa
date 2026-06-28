import type { VirtualItem } from './buildVirtualItems';

export type NavigationAction = 'nextHunk' | 'prevHunk' | 'nextChange' | 'prevChange';

interface FindNavigationTargetOptions {
  items: VirtualItem[];
  currentIndex: number;
  action: NavigationAction;
}

const isChangedRow = (item: VirtualItem) => {
  if (item.kind !== 'diff-row') {
    return false;
  }

  const leftType = item.row.left?.type;
  const rightType = item.row.right?.type;

  return (
    leftType === 'removed' ||
    leftType === 'added' ||
    rightType === 'removed' ||
    rightType === 'added'
  );
};

const findNextHunk = (items: VirtualItem[], currentIndex: number): number | null => {
  for (let i = currentIndex + 1; i < items.length; i++) {
    if (items[i]?.kind === 'hunk-header') {
      return i;
    }
  }

  return null;
};

const findPrevHunk = (items: VirtualItem[], currentIndex: number): number | null => {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (items[i]?.kind === 'hunk-header') {
      return i;
    }
  }

  return null;
};

const findNextChange = (items: VirtualItem[], currentIndex: number): number | null => {
  for (let i = currentIndex + 1; i < items.length; i++) {
    const item = items[i];
    if (item != null && isChangedRow(item)) {
      return i;
    }
  }

  return null;
};

const findPrevChange = (items: VirtualItem[], currentIndex: number): number | null => {
  for (let i = currentIndex - 1; i >= 0; i--) {
    const item = items[i];
    if (item != null && isChangedRow(item)) {
      return i;
    }
  }

  return null;
};

export const findNavigationTarget = ({
  items,
  currentIndex,
  action,
}: FindNavigationTargetOptions): number | null => {
  switch (action) {
    case 'nextHunk':
      return findNextHunk(items, currentIndex);
    case 'prevHunk':
      return findPrevHunk(items, currentIndex);
    case 'nextChange':
      return findNextChange(items, currentIndex);
    case 'prevChange':
      return findPrevChange(items, currentIndex);
  }
};
