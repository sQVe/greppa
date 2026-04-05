import type { DiffFile } from '../../fixtures/types';

import styles from './FileMinimap.module.css';

interface FileMinimapProps {
  diffs: DiffFile[];
  activeFilePath: string | null;
  onSegmentClick: (path: string) => void;
}

export const FileMinimap = ({ diffs, activeFilePath, onSegmentClick }: FileMinimapProps) => {
  if (diffs.length <= 1) {
    return null;
  }

  return (
    <div className={styles.container}>
      {diffs.map((diff) => (
        <div
          key={diff.path}
          className={`${styles.segment} ${activeFilePath === diff.path ? styles.active : ''}`}
          style={{ flex: Math.max(diff.hunks.length, 1) }}
          data-testid="minimap-segment"
          data-active={activeFilePath === diff.path}
          onClick={() => { onSegmentClick(diff.path); }}
        />
      ))}
    </div>
  );
};
