import type { ChangeType, DiffFile } from '../../fixtures/types';
import type { DiffRow } from './buildRows';
import { buildRows } from './buildRows';

interface FileHeaderItem {
  kind: 'file-header';
  diff: DiffFile;
}

interface HunkHeaderItem {
  kind: 'hunk-header';
  header: string;
  changeType: ChangeType;
}

interface DiffRowItem {
  kind: 'diff-row';
  row: DiffRow;
  changeType: ChangeType;
}

export type FlatVirtualItem = FileHeaderItem | HunkHeaderItem | DiffRowItem;

export const buildFlatItems = (diffs: DiffFile[]): FlatVirtualItem[] => {
  const items: FlatVirtualItem[] = [];

  for (const diff of diffs) {
    items.push({ kind: 'file-header', diff });

    for (const hunk of diff.hunks) {
      items.push({ kind: 'hunk-header', header: hunk.header, changeType: diff.changeType });
      for (const row of buildRows(hunk)) {
        items.push({ kind: 'diff-row', row, changeType: diff.changeType });
      }
    }
  }

  return items;
};
