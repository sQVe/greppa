import { Badge, EmptyState } from '@greppa/ui';

import type { ChangeType, DiffFile } from '../../fixtures/types';
import { DiffViewer } from '../DiffViewer/DiffViewer';

import styles from './StackedDiffViewer.module.css';

interface StackedDiffViewerProps {
  diffs: DiffFile[];
}

const CHANGE_LABELS: Record<ChangeType, string> = {
  added: 'Added',
  deleted: 'Deleted',
  modified: 'Modified',
  renamed: 'Renamed',
};

export const StackedDiffViewer = ({ diffs }: StackedDiffViewerProps) => {
  if (diffs.length === 0) {
    return <EmptyState>Select a file to view diff</EmptyState>;
  }

  return (
    <div className={styles.container} data-testid="stacked-diff-viewer">
      {diffs.map((diff, index) => (
        <div key={diff.path}>
          <div className={styles.fileHeader} data-testid="file-header">
            <Badge variant={diff.changeType}>{CHANGE_LABELS[diff.changeType]}</Badge>
            <span className={styles.filePath}>{diff.path}</span>
            <button type="button" className={styles.reviewButton}>
              Mark reviewed
            </button>
          </div>
          <DiffViewer diff={diff} />
          {index < diffs.length - 1 ? (
            <div className={styles.separator} data-testid="file-separator" />
          ) : null}
        </div>
      ))}
    </div>
  );
};
