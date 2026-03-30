import type { DiffHunk, DiffLine, LineType } from '../../fixtures/types';

export const diffLineKey = (line: DiffLine) =>
  `${line.lineType}:${line.oldLineNumber ?? ''}:${line.newLineNumber ?? ''}`;

export interface RowSide {
  lineNumber: number | null;
  tokenMapKey: string;
  content: string;
  type: LineType;
}

export interface DiffRow {
  left: RowSide | null;
  right: RowSide | null;
}

export const buildRows = (hunk: DiffHunk) => {
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
