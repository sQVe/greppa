import type { DiffFile } from '../../fixtures/types';
import type { DiffRow } from './buildRows';
import { buildRows } from './buildRows';

interface FileHeaderItem {
  kind: 'file-header';
  diff: DiffFile;
}

interface HunkHeaderItem {
  kind: 'hunk-header';
  header: string;
}

interface DiffRowItem {
  kind: 'diff-row';
  row: DiffRow;
}

interface FileSeparatorItem {
  kind: 'file-separator';
}

export type FlatVirtualItem = FileHeaderItem | HunkHeaderItem | DiffRowItem | FileSeparatorItem;

export const buildFlatItems = (diffs: DiffFile[]): FlatVirtualItem[] => {
  const items: FlatVirtualItem[] = [];

  for (const [i, diff] of diffs.entries()) {
    if (i > 0) {
      items.push({ kind: 'file-separator' });
    }

    items.push({ kind: 'file-header', diff });

    for (const hunk of diff.hunks) {
      items.push({ kind: 'hunk-header', header: hunk.header });
      for (const row of buildRows(hunk)) {
        items.push({ kind: 'diff-row', row });
      }
    }
  }

  return items;
};
