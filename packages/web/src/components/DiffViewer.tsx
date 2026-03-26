import { useEffect, useMemo, useState } from 'react';
import type { BundledLanguage, Highlighter, ThemedToken } from 'shiki';
import { createHighlighter } from 'shiki';

import type { DiffFile, DiffHunk, DiffLine, LineType } from '../fixtures/types';
import { useTheme } from '../hooks/useTheme';

import styles from './DiffViewer.module.css';

interface RowSide {
  lineNumber: number | null;
  tokenMapKey: string;
  content: string;
  type: LineType;
}

const diffLineKey = (line: DiffLine) =>
  `${line.lineType}:${line.oldLineNumber ?? ''}:${line.newLineNumber ?? ''}`;

interface DiffRow {
  left: RowSide | null;
  right: RowSide | null;
}

let highlighterPromise: Promise<Highlighter> | null = null;

const getOrCreateHighlighter = () => {
  highlighterPromise ??= createHighlighter({
    themes: ['catppuccin-mocha', 'catppuccin-latte'],
    langs: ['typescript'],
  });

  return highlighterPromise;
};

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
            ? {
                lineNumber: removed.oldLineNumber,
                tokenMapKey: diffLineKey(removed),
                content: removed.content,
                type: 'removed',
              }
            : null,
        right:
          added != null
            ? {
                lineNumber: added.newLineNumber,
                tokenMapKey: diffLineKey(added),
                content: added.content,
                type: 'added',
              }
            : null,
      });
    }
    pendingRemoved = [];
    pendingAdded = [];
  };

  for (const line of hunk.lines) {
    if (line.lineType === 'context') {
      flush();
      const key = diffLineKey(line);
      rows.push({
        left: {
          lineNumber: line.oldLineNumber,
          tokenMapKey: key,
          content: line.content,
          type: 'context',
        },
        right: {
          lineNumber: line.newLineNumber,
          tokenMapKey: key,
          content: line.content,
          type: 'context',
        },
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

interface TokenEntry {
  key: string;
  content: string;
}

const buildTokenEntries = (diff: DiffFile) => {
  const oldEntries: TokenEntry[] = [];
  const newEntries: TokenEntry[] = [];

  for (const [i, hunk] of diff.hunks.entries()) {
    if (i > 0) {
      oldEntries.push({ key: '', content: '' });
      newEntries.push({ key: '', content: '' });
    }

    for (const line of hunk.lines) {
      const key = diffLineKey(line);
      if (line.lineType !== 'added') {
        oldEntries.push({ key, content: line.content });
      }
      if (line.lineType !== 'removed') {
        newEntries.push({ key, content: line.content });
      }
    }
  }

  return { oldEntries, newEntries };
};

const useTokenMap = (diff: DiffFile | null, highlighter: Highlighter | null, theme: string) =>
  useMemo(() => {
    if (highlighter == null || diff == null) {
      return null;
    }

    const { oldEntries, newEntries } = buildTokenEntries(diff);
    // oxlint-disable-next-line no-unsafe-type-assertion -- fixture language strings are valid Shiki language IDs
    const lang = diff.language as BundledLanguage;
    const oldTokenLines = highlighter.codeToTokens(
      oldEntries.map((e) => e.content).join('\n') || ' ',
      { lang, theme },
    ).tokens;
    const newTokenLines = highlighter.codeToTokens(
      newEntries.map((e) => e.content).join('\n') || ' ',
      { lang, theme },
    ).tokens;

    const map = new Map<string, ThemedToken[]>();

    for (const [i, entry] of oldEntries.entries()) {
      const tokens = oldTokenLines[i];
      if (entry.key !== '' && tokens != null) {
        map.set(entry.key, tokens);
      }
    }

    for (const [i, entry] of newEntries.entries()) {
      const tokens = newTokenLines[i];
      if (entry.key !== '' && !map.has(entry.key) && tokens != null) {
        map.set(entry.key, tokens);
      }
    }

    return map;
  }, [diff, highlighter, theme]);

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
