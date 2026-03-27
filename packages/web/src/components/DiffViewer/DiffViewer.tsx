import type { DiffFile } from '../../fixtures/types';
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

const CHANGE_LABELS: Record<string, { label: string; className: string }> = {
  added: { label: 'Added', className: styles.badgeAdded ?? '' },
  deleted: { label: 'Deleted', className: styles.badgeDeleted ?? '' },
  modified: { label: 'Modified', className: styles.badgeModified ?? '' },
  renamed: { label: 'Renamed', className: styles.badgeRenamed ?? '' },
};

const SIDES = ['left', 'right'] as const;

export type { HunkData };

export const DiffViewer = ({ diff }: DiffViewerProps) => {
  const { theme } = useTheme();
  const tokenMap = useSyntaxHighlighting(diff, theme);

  if (diff == null) {
    return <div className={styles.empty}>Select a file to view diff</div>;
  }

  const badge = CHANGE_LABELS[diff.changeType];
  const hunks: HunkData[] = diff.hunks.map((hunk) => ({
    header: hunk.header,
    rows: buildRows(hunk),
  }));
  const totalRows = hunks.reduce((sum, h) => sum + 1 + h.rows.length, 0);

  return (
    <div className={styles.viewer}>
      <div className={styles.fileHeader}>
        {badge != null ? (
          <span className={`${styles.changeBadge} ${badge.className}`}>{badge.label}</span>
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
            {hunks.map((hunk, index) => (
              <HunkRows
                key={index}
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
