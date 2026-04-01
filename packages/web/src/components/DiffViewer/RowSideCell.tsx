import type { LineType } from '../../fixtures/types';
import type { HighlightToken } from '../../workers/highlightProtocol';
import type { RowSide } from './buildRows';
import { TokenSpans } from './TokenSpans';

import styles from './DiffViewer.module.css';

interface RowSideCellProps {
  data: RowSide | null;
  side: 'left' | 'right';
  tokenMap: Map<string, HighlightToken[]> | null;
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

export const RowSideCell = ({ data, side, tokenMap }: RowSideCellProps) => {
  const cellClass = data != null ? lineClass(data.type) : styles.lineEmpty;

  return (
    <div className={`${styles.rowSide} ${cellClass}`} data-side={side}>
      <div className={styles.gutter}>{data?.lineNumber}</div>
      <div className={styles.content}>
        {data != null ? (
          <TokenSpans
            content={data.content}
            tokens={tokenMap?.get(data.tokenMapKey) ?? null}
            charRanges={data.charRanges}
            lineType={data.type}
          />
        ) : null}
      </div>
    </div>
  );
};
