import type { DiffRow } from './buildRows';

export interface HunkData {
  header: string;
  key: string;
  rows: DiffRow[];
}

interface HunkHeaderItem {
  kind: 'hunk-header';
  header: string;
}

interface DiffRowItem {
  kind: 'diff-row';
  row: DiffRow;
}

export type VirtualItem = HunkHeaderItem | DiffRowItem;

export const buildVirtualItems = (hunks: HunkData[]): VirtualItem[] => {
  const items: VirtualItem[] = [];

  for (const hunk of hunks) {
    items.push({ kind: 'hunk-header', header: hunk.header });
    for (const row of hunk.rows) {
      items.push({ kind: 'diff-row', row });
    }
  }

  return items;
};
