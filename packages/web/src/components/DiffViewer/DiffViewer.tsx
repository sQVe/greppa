import { Badge, EmptyState } from '@greppa/ui';

import type { ChangeType, DiffFile } from '../../fixtures/types';
import { useTheme } from '../../hooks/useTheme';
import type { DiffRow } from './buildRows';
import { buildRows } from './buildRows';
import { HunkRows } from './HunkRows';
import { useSyntaxHighlighting } from './useSyntaxHighlighting';

import styles from './DiffViewer.module.css';

interface DiffViewerProps {
  diff: DiffFile | null;
}

interface HunkData {
  header: string;
  rows: DiffRow[];
}

const CHANGE_LABELS: Record<ChangeType, string> = {
  added: 'Added',
  deleted: 'Deleted',
  modified: 'Modified',
  renamed: 'Renamed',
};

const SIDES = ['left', 'right'] as const;

export type { HunkData };

export const DiffViewer = ({ diff }: DiffViewerProps) => {
  const { theme } = useTheme();
  const tokenMap = useSyntaxHighlighting(diff, theme);

  if (diff == null) {
    return <EmptyState>Select a file to view diff</EmptyState>;
  }

  const label = CHANGE_LABELS[diff.changeType];
  const hunks: HunkData[] = diff.hunks.map((hunk) => ({
    header: hunk.header,
    rows: buildRows(hunk),
  }));
  const totalRows = hunks.reduce((sum, h) => sum + 1 + h.rows.length, 0);

  return (
    <div className={styles.viewer}>
      <div className={styles.fileHeader}>
        {label != null ? (
          <Badge variant={diff.changeType}>{label}</Badge>
        ) : null}
        <span>{diff.path}</span>
        {diff.oldPath != null ? <span>← {diff.oldPath}</span> : null}
      </div>
      <div
        className={styles.splitContainer}
        style={{ gridTemplateRows: `repeat(${totalRows}, auto)` }}
      >
        {SIDES.map((side) => (
          <div
            key={side}
            className={styles.side}
            style={{ gridRow: `1 / span ${totalRows}` }}
            data-side={side}
          >
            {hunks.map((hunk) => (
              <HunkRows
                key={hunk.header}
                header={hunk.header}
                rows={hunk.rows}
                tokenMap={tokenMap}
                side={side}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
