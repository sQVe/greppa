import { useEffect, useMemo, useState } from 'react';
import type { BundledLanguage, Highlighter, ThemedToken } from 'shiki';
import { createHighlighter } from 'shiki';

import type { DiffFile, DiffHunk, DiffLine, LineType } from '../fixtures/types';
import { useTheme } from '../hooks/useTheme';

import styles from './DiffViewer.module.css';

let highlighterPromise: Promise<Highlighter> | null = null;

const getOrCreateHighlighter = () => {
  highlighterPromise ??= createHighlighter({
    themes: ['catppuccin-mocha', 'catppuccin-latte'],
    langs: ['typescript'],
  });
  return highlighterPromise;
};

interface RowSide {
  lineNumber: number | null;
  content: string;
  type: LineType;
}

interface DiffRow {
  left: RowSide | null;
  right: RowSide | null;
}

export const buildRows = (hunk: DiffHunk): DiffRow[] => {
  const rows: DiffRow[] = [];
  let pendingRemoved: DiffLine[] = [];
  let pendingAdded: DiffLine[] = [];

  const flush = () => {
    const count = Math.max(pendingRemoved.length, pendingAdded.length);
    for (let i = 0; i < count; i++) {
      const removed = pendingRemoved[i];
      const added = pendingAdded[i];
      rows.push({
        left:
          removed != null
            ? { lineNumber: removed.oldLineNumber, content: removed.content, type: 'removed' }
            : null,
        right:
          added != null
            ? { lineNumber: added.newLineNumber, content: added.content, type: 'added' }
            : null,
      });
    }
    pendingRemoved = [];
    pendingAdded = [];
  };

  for (const line of hunk.lines) {
    if (line.lineType === 'context') {
      flush();
      rows.push({
        left: { lineNumber: line.oldLineNumber, content: line.content, type: 'context' },
        right: { lineNumber: line.newLineNumber, content: line.content, type: 'context' },
      });
    } else if (line.lineType === 'removed') {
      pendingRemoved.push(line);
    } else {
      pendingAdded.push(line);
    }
  }
  flush();

  return rows;
};

const CHANGE_LABELS: Record<string, { label: string; className: string }> = {
  added: { label: 'Added', className: styles.badgeAdded ?? '' },
  deleted: { label: 'Deleted', className: styles.badgeDeleted ?? '' },
  modified: { label: 'Modified', className: styles.badgeModified ?? '' },
  renamed: { label: 'Renamed', className: styles.badgeRenamed ?? '' },
};

const lineClass = (type: LineType) => {
  if (type === 'removed') {
    return styles.lineRemoved;
  }
  if (type === 'added') {
    return styles.lineAdded;
  }
  return '';
};

interface TokenSpansProps {
  content: string;
  tokens: ThemedToken[] | null;
}

const TokenSpans = ({ content, tokens }: TokenSpansProps) => {
  if (tokens == null) {
    return content;
  }
  return tokens.map((token, i) => (
    // Shiki tokens have no stable identity; index keys are safe here since the list is static per render
    // oxlint-disable-next-line react/no-array-index-key
    <span key={i} style={{ color: token.color }}>
      {token.content}
    </span>
  ));
};

const useHighlighter = () => {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    void getOrCreateHighlighter().then(setHighlighter);
  }, []);

  return highlighter;
};

const useTokenMap = (diff: DiffFile | null, highlighter: Highlighter | null, theme: string) =>
  useMemo(() => {
    if (highlighter == null || diff == null) {
      return null;
    }

    const map = new Map<string, ThemedToken[]>();
    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        const key = `${line.lineType}:${line.oldLineNumber ?? ''}:${line.newLineNumber ?? ''}`;
        if (!map.has(key)) {
          const result = highlighter.codeToTokens(line.content || ' ', {
            // oxlint-disable-next-line no-unsafe-type-assertion -- fixture language strings are valid Shiki language IDs
            lang: diff.language as BundledLanguage,
            theme,
          });
          const tokens = result.tokens[0];
          if (tokens != null) {
            map.set(key, tokens);
          }
        }
      }
    }
    return map;
  }, [diff, highlighter, theme]);

const tokenKey = (side: RowSide) =>
  `${side.type}:${side.type !== 'added' ? (side.lineNumber ?? '') : ''}:${side.type !== 'removed' ? (side.lineNumber ?? '') : ''}`;

interface DiffViewerProps {
  diff: DiffFile | null;
}

export const DiffViewer = ({ diff }: DiffViewerProps) => {
  const { theme } = useTheme();
  const highlighter = useHighlighter();
  const tokenMap = useTokenMap(diff, highlighter, theme);

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

interface HunkRowsProps {
  hunk: DiffHunk;
  tokenMap: Map<string, ThemedToken[]> | null;
}

const HunkRows = ({ hunk, tokenMap }: HunkRowsProps) => {
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
                  tokens={tokenMap?.get(tokenKey(row.left)) ?? null}
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
                  tokens={tokenMap?.get(tokenKey(row.right)) ?? null}
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
