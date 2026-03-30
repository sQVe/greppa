import { EmptyState } from '@greppa/ui';

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
  key: string;
  rows: DiffRow[];
}

const SIDES = ['left', 'right'] as const;

export type { HunkData };

export const DiffViewer = ({ diff }: DiffViewerProps) => {
  const { theme } = useTheme();
  const tokenMap = useSyntaxHighlighting(diff, theme);

  if (diff == null) {
    return <EmptyState>Select a file to view diff</EmptyState>;
  }

  const hunks: HunkData[] = diff.hunks.map((hunk, index) => ({
    header: hunk.header,
    key: `${index}-${hunk.header}`,
    rows: buildRows(hunk),
  }));
  const totalRows = hunks.reduce((sum, h) => sum + 1 + h.rows.length, 0);

  return (
    <div className={styles.viewer}>
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
                key={hunk.key}
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
