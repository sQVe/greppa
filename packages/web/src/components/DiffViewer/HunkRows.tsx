import type { ThemedToken } from 'shiki';

import type { DiffHunk, LineType } from '../../fixtures/types';
import { buildRows } from './buildRows';
import { TokenSpans } from './TokenSpans';

import styles from './DiffViewer.module.css';

interface HunkRowsProps {
  hunk: DiffHunk;
  tokenMap: Map<string, ThemedToken[]> | null;
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

export const HunkRows = ({ hunk, tokenMap }: HunkRowsProps) => {
  const rows = buildRows(hunk);

  return (
    <>
      <tr>
        <td colSpan={5} className={styles.hunkHeader}>
          {hunk.header}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={`${row.left?.lineNumber ?? ''}-${row.right?.lineNumber ?? ''}`}>
          {row.left != null ? (
            <>
              <td className={`${styles.gutter} ${lineClass(row.left.type)}`}>
                {row.left.lineNumber}
              </td>
              <td className={`${styles.content} ${lineClass(row.left.type)}`}>
                <TokenSpans
                  content={row.left.content}
                  tokens={tokenMap?.get(row.left.tokenMapKey) ?? null}
                />
              </td>
            </>
          ) : (
            <>
              <td className={`${styles.gutter} ${styles.lineEmpty}`} />
              <td className={`${styles.content} ${styles.lineEmpty}`} />
            </>
          )}
          <td className={styles.divider} />
          {row.right != null ? (
            <>
              <td className={`${styles.gutter} ${lineClass(row.right.type)}`}>
                {row.right.lineNumber}
              </td>
              <td className={`${styles.content} ${lineClass(row.right.type)}`}>
                <TokenSpans
                  content={row.right.content}
                  tokens={tokenMap?.get(row.right.tokenMapKey) ?? null}
                />
              </td>
            </>
          ) : (
            <>
              <td className={`${styles.gutter} ${styles.lineEmpty}`} />
              <td className={`${styles.content} ${styles.lineEmpty}`} />
            </>
          )}
        </tr>
      ))}
    </>
  );
};
