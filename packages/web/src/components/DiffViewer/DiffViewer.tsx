import type { DiffFile } from '../../fixtures/types';
import { useTheme } from '../../hooks/useTheme';
import { HunkRows } from './HunkRows';
import { useSyntaxHighlighting } from './useSyntaxHighlighting';

import styles from './DiffViewer.module.css';

interface DiffViewerProps {
  diff: DiffFile | null;
}

const CHANGE_LABELS: Record<string, { label: string; className: string }> = {
  added: { label: 'Added', className: styles.badgeAdded ?? '' },
  deleted: { label: 'Deleted', className: styles.badgeDeleted ?? '' },
  modified: { label: 'Modified', className: styles.badgeModified ?? '' },
  renamed: { label: 'Renamed', className: styles.badgeRenamed ?? '' },
};

export const DiffViewer = ({ diff }: DiffViewerProps) => {
  const { theme } = useTheme();
  const tokenMap = useSyntaxHighlighting(diff, theme);

  if (diff == null) {
    return <div className={styles.empty}>Select a file to view diff</div>;
  }

  const badge = CHANGE_LABELS[diff.changeType];

  return (
    <div className={styles.viewer}>
      <div className={styles.fileHeader}>
        {badge != null ? (
          <span className={`${styles.changeBadge} ${badge.className}`}>{badge.label}</span>
        ) : null}
        <span>{diff.path}</span>
        {diff.oldPath != null ? <span>← {diff.oldPath}</span> : null}
      </div>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: '3.5rem' }} />
          <col />
          <col style={{ width: '1px' }} />
          <col style={{ width: '3.5rem' }} />
          <col />
        </colgroup>
        <tbody>
          {diff.hunks.map((hunk) => (
            <HunkRows key={hunk.header} hunk={hunk} tokenMap={tokenMap} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
