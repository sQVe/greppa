import { memo } from 'react';

import { Badge } from '@greppa/ui';

import type { ChangeType, DiffFile } from '../../fixtures/types';

import styles from './StackedDiffViewer.module.css';

interface FileHeaderProps {
  diff: DiffFile;
  reviewedPaths?: Set<string>;
  onToggleReviewed?: (path: string) => void;
}

const CHANGE_LABELS: Record<ChangeType, string> = {
  added: 'Added',
  deleted: 'Deleted',
  modified: 'Modified',
  renamed: 'Renamed',
};

export const FileHeader = memo(({ diff, reviewedPaths, onToggleReviewed }: FileHeaderProps) => (
  <div
    className={styles.fileHeader}
    data-testid="file-header"
    data-file-path={diff.path}
  >
    <Badge variant={diff.changeType}>{CHANGE_LABELS[diff.changeType]}</Badge>
    <span className={styles.filePath}>{diff.path}</span>
    <button
      type="button"
      aria-pressed={reviewedPaths?.has(diff.path) ?? false}
      className={`${styles.reviewButton} ${reviewedPaths?.has(diff.path) ? styles.reviewed : ''}`}
      onClick={() => onToggleReviewed?.(diff.path)}
    >
      {reviewedPaths?.has(diff.path) ? '\u2713 Reviewed' : 'Mark reviewed'}
    </button>
  </div>
));
