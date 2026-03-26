import type { ThemedToken } from 'shiki';

import type { LineType } from '../../fixtures/types';
import type { DiffRow } from './buildRows';
import { TokenSpans } from './TokenSpans';

import styles from './DiffViewer.module.css';

interface HunkRowsProps {
  header: string;
  rows: DiffRow[];
  tokenMap: Map<string, ThemedToken[]> | null;
  side: 'left' | 'right';
}

const lineClass = (type: LineType) => {
  if (type === 'removed') {
    return styles.lineRemoved;
  }
  if (type === 'added') {
    return styles.lineAdded;
  }

  return '';
};

export const HunkRows = ({ header, rows, tokenMap, side }: HunkRowsProps) => (
  <>
    <div className={styles.hunkHeader}>{header}</div>
    {rows.map((row) => {
      const data = row[side];
      const rowClass = data != null ? lineClass(data.type) : styles.lineEmpty;

      return (
        <div
          key={`${row.left?.lineNumber ?? ''}-${row.right?.lineNumber ?? ''}`}
          className={`${styles.row} ${rowClass}`}
        >
          <div className={styles.gutter}>{data?.lineNumber}</div>
          <div className={styles.content}>
            {data != null ? (
              <TokenSpans content={data.content} tokens={tokenMap?.get(data.tokenMapKey) ?? null} />
            ) : null}
          </div>
        </div>
      );
    })}
  </>
);
