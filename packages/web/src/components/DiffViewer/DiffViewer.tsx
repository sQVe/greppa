import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState } from '@greppa/ui';

import type { DiffFile } from '../../fixtures/types';
import { useTheme } from '../../hooks/useTheme';
import { buildRows } from './buildRows';
import type { HunkData, VirtualItem } from './buildVirtualItems';
import { buildVirtualItems } from './buildVirtualItems';
import { DiffRowRenderer } from './DiffRowRenderer';
import { getFileSizeTier } from './getFileSizeTier';
import { useDiffKeyboardNavigation } from './useDiffKeyboardNavigation';
import { useSyntaxHighlighting } from './useSyntaxHighlighting';

import styles from './DiffViewer.module.css';

interface DiffViewerProps {
  diff: DiffFile | null;
}

const ROW_HEIGHT_ESTIMATE = 36;

const useDeferredDiff = (diff: DiffFile | null, shouldDefer: boolean) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);

    if (!shouldDefer) {
      return;
    }

    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(() =>{  setReady(true); });
      return () =>{  cancelIdleCallback(id); };
    }

    const id = setTimeout(() =>{  setReady(true); }, 0);
    return () =>{  clearTimeout(id); };
  }, [diff, shouldDefer]);

  if (!shouldDefer) {
    return diff;
  }

  return ready ? diff : null;
};

export const DiffViewer = ({ diff }: DiffViewerProps) => {
  const { theme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [forceExpanded, setForceExpanded] = useState(false);

  useEffect(() =>{  setForceExpanded(false); }, [diff]);

  const hunks: HunkData[] = useMemo(() => {
    if (diff == null) {
      return [];
    }

    return diff.hunks.map((hunk, index) => ({
      header: hunk.header,
      key: `${index}-${hunk.header}`,
      rows: buildRows(hunk),
    }));
  }, [diff]);

  const items: VirtualItem[] = useMemo(() => buildVirtualItems(hunks), [hunks]);
  const tier = getFileSizeTier(items.length);
  const isCollapsed = tier === 'huge' && !forceExpanded;
  const shouldDeferHighlighting = tier === 'large' || (tier === 'huge' && forceExpanded);

  const highlightDiff = useDeferredDiff(isCollapsed ? null : diff, shouldDeferHighlighting);
  const tokenMap = useSyntaxHighlighting(highlightDiff, theme);

  const virtualizer = useVirtualizer({
    count: isCollapsed ? 0 : items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    enabled: !isCollapsed,
  });

  useDiffKeyboardNavigation({ items, virtualizer, enabled: diff != null && !isCollapsed });

  if (diff == null) {
    return <EmptyState>Select a file to view diff</EmptyState>;
  }

  if (isCollapsed) {
    const totalLines = items.filter((i) => i.kind === 'diff-row').length;

    return (
      <div className={styles.collapsed} data-testid="diff-collapsed">
        <p>{totalLines.toLocaleString()} lines — diff is too large to render by default</p>
        <button type="button" className={styles.expandButton} onClick={() =>{  setForceExpanded(true); }}>
          Show diff
        </button>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={styles.viewer} data-testid="diff-viewer">
      <div className={styles.virtualList} style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          if (item == null) {
            return null;
          }

          if (item.kind === 'hunk-header') {
            return (
              <div
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                className={styles.virtualRow}
                style={{ transform: `translateY(${virtualItem.start}px)` }}
                data-index={virtualItem.index}
                data-testid="hunk-header"
              >
                <div className={styles.row}>
                  <div className={styles.hunkHeader}>{item.header}</div>
                  <div className={styles.hunkHeader}>{item.header}</div>
                </div>
              </div>
            );
          }

          return (
            <DiffRowRenderer
              key={virtualItem.key}
              row={item.row}
              tokenMap={tokenMap}
              measureRef={virtualizer.measureElement}
              style={{ transform: `translateY(${virtualItem.start}px)` }}
              dataIndex={virtualItem.index}
            />
          );
        })}
      </div>
    </div>
  );
};
