import type { CSSProperties } from 'react';
import type { ThemedToken } from 'shiki';

import type { DiffRow } from './buildRows';
import { RowSideCell } from './RowSideCell';

import styles from './DiffViewer.module.css';

interface DiffRowRendererProps {
  row: DiffRow;
  tokenMap: Map<string, ThemedToken[]> | null;
  measureRef: (node: Element | null) => void;
  style: CSSProperties;
  dataIndex: number;
}

export const DiffRowRenderer = ({
  row,
  tokenMap,
  measureRef,
  style,
  dataIndex,
}: DiffRowRendererProps) => (
  <div
    ref={measureRef}
    className={styles.virtualRow}
    style={style}
    data-index={dataIndex}
    data-testid="diff-row"
  >
    <div className={styles.row}>
      <RowSideCell data={row.left} side="left" tokenMap={tokenMap} />
      <RowSideCell data={row.right} side="right" tokenMap={tokenMap} />
    </div>
  </div>
);
