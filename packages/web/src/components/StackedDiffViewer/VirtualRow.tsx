import { memo } from 'react';

import type { HighlightToken } from '../../workers/highlightProtocol';
import type { FlatVirtualItem } from '../DiffViewer/buildFlatItems';
import { RowSideCell } from '../DiffViewer/RowSideCell';
import { FileHeader } from './FileHeader';

import diffStyles from '../DiffViewer/DiffViewer.module.css';

interface VirtualRowProps {
  item: FlatVirtualItem;
  tokenMap: Map<string, HighlightToken[]> | null;
  reviewedPaths?: Set<string>;
  onToggleReviewed?: (path: string) => void;
}

export const VirtualRow = memo(({ item, tokenMap, reviewedPaths, onToggleReviewed }: VirtualRowProps) => {
  switch (item.kind) {
    case 'file-header': {
      return (
        <FileHeader
          diff={item.diff}
          reviewedPaths={reviewedPaths}
          onToggleReviewed={onToggleReviewed}
        />
      );
    }
    case 'hunk-header': {
      return (
        <div data-testid="hunk-header">
          <div className={diffStyles.hunkHeader}>{item.header}</div>
        </div>
      );
    }
    case 'diff-row': {
      return (
        <div className={diffStyles.row} data-testid="diff-row">
          <RowSideCell data={item.row.left} side="left" tokenMap={tokenMap} />
          <RowSideCell data={item.row.right} side="right" tokenMap={tokenMap} />
        </div>
      );
    }
  }
});
