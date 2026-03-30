import type { ThemedToken } from 'shiki';

import type { LineType } from '../../fixtures/types';
import type { RowSide } from './buildRows';
import { TokenSpans } from './TokenSpans';

import styles from './DiffViewer.module.css';

const lineClass = (type: LineType) => {
  if (type === 'removed') {
    return styles.lineRemoved;
  }
  if (type === 'added') {
    return styles.lineAdded;
  }

  return '';
};

export const RowSideCell = ({
  data,
  side,
  tokenMap,
}: {
  data: RowSide | null;
  side: 'left' | 'right';
  tokenMap: Map<string, ThemedToken[]> | null;
}) => {
  const cellClass = data != null ? lineClass(data.type) : styles.lineEmpty;

  return (
    <div className={`${styles.rowSide} ${cellClass}`} data-side={side}>
      <div className={styles.gutter}>{data?.lineNumber}</div>
      <div className={styles.content}>
        {data != null ? (
          <TokenSpans content={data.content} tokens={tokenMap?.get(data.tokenMapKey) ?? null} />
        ) : null}
      </div>
    </div>
  );
};
