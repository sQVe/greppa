import { useVirtualizer } from '@tanstack/react-virtual';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { EmptyState } from '@greppa/ui';

import type { DiffFile } from '../../fixtures/types';
import { buildFlatItems } from '../DiffViewer/buildFlatItems';
import type { FlatVirtualItem } from '../DiffViewer/buildFlatItems';
import { usePreferences } from '../../hooks/usePreferences';
import { useMultiSyntaxHighlighting } from '../DiffViewer/useSyntaxHighlighting';
import { FileHeader } from './FileHeader';
import { VirtualRow } from './VirtualRow';

import styles from './StackedDiffViewer.module.css';

interface StackedDiffViewerProps {
  diffs: DiffFile[];
  reviewedPaths?: Set<string>;
  onToggleReviewed?: (path: string) => void;
  onActiveFileChange?: (path: string) => void;
}

export interface StackedDiffViewerHandle {
  scrollToFile: (path: string) => void;
}

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const SEPARATOR_HEIGHT = 24;

const estimateItemSize = (item: FlatVirtualItem) => {
  switch (item.kind) {
    case 'file-header': {
      return HEADER_HEIGHT;
    }
    case 'hunk-header': {
      return ROW_HEIGHT;
    }
    case 'diff-row': {
      return ROW_HEIGHT;
    }
    case 'file-separator': {
      return SEPARATOR_HEIGHT;
    }
  }
};

export const StackedDiffViewer = memo(forwardRef<StackedDiffViewerHandle, StackedDiffViewerProps>(
  ({ diffs, reviewedPaths, onToggleReviewed, onActiveFileChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { state: { theme } } = usePreferences();

    const flatItems = useMemo(() => buildFlatItems(diffs), [diffs]);

    const fileHeaderIndices = useMemo(
      () => flatItems.reduce<number[]>((acc, item, i) => {
        if (item.kind === 'file-header') {
          acc.push(i);
        }
        return acc;
      }, []),
      [flatItems],
    );

    const filePathByIndex = useMemo(() => {
      const paths: string[] = [];
      let currentPath = '';
      for (const item of flatItems) {
        if (item.kind === 'file-header') {
          currentPath = item.diff.path;
        }
        paths.push(currentPath);
      }
      return paths;
    }, [flatItems]);

    const virtualizer = useVirtualizer({
      count: flatItems.length,
      getScrollElement: () => containerRef.current,
      estimateSize: (index) => {
        const item = flatItems[index];
        return item != null ? estimateItemSize(item) : ROW_HEIGHT;
      },
      overscan: 10,
      scrollPaddingStart: HEADER_HEIGHT,
    });

    const virtualizerRef = useRef(virtualizer);
    virtualizerRef.current = virtualizer;

    const virtualItems = virtualizer.getVirtualItems();

    const visibleDiffs = useMemo(() => {
      const visiblePaths = new Set<string>();
      for (const item of virtualItems) {
        const path = filePathByIndex[item.index];
        if (path != null) {
          visiblePaths.add(path);
        }
      }
      return diffs.filter((diff) => visiblePaths.has(diff.path));
    }, [virtualItems, diffs, filePathByIndex]);

    const tokenMaps = useMultiSyntaxHighlighting(visibleDiffs, theme);

    useImperativeHandle(ref, () => ({
      scrollToFile: (path: string) => {
        const headerIdx = flatItems.findIndex(
          (item) => item.kind === 'file-header' && item.diff.path === path,
        );
        if (headerIdx !== -1) {
          virtualizerRef.current.scrollToIndex(headerIdx, { align: 'start' });
        }
      },
    }), [flatItems]);

    const [activeFileIndex, setActiveFileIndex] = useState(0);

    const updateActiveFile = useCallback(() => {
      const items = virtualizerRef.current.getVirtualItems();
      const firstHeaderIdx = fileHeaderIndices[0];
      const scrollTop = containerRef.current?.scrollTop ?? 0;
      if (items.length === 0 || firstHeaderIdx == null) {
        return;
      }
      const firstVisibleIndex = items.find((item) => item.end > scrollTop)?.index ?? 0;
      let headerIdx = firstHeaderIdx;
      for (const idx of fileHeaderIndices) {
        if (idx <= firstVisibleIndex) {
          headerIdx = idx;
        } else {
          break;
        }
      }
      setActiveFileIndex((prev) => prev === headerIdx ? prev : headerIdx);
    }, [fileHeaderIndices]);

    useEffect(() => {
      updateActiveFile();
    }, [updateActiveFile]);

    const activeDiff = useMemo(() => {
      const item = flatItems[activeFileIndex];
      return item?.kind === 'file-header' ? item.diff : null;
    }, [flatItems, activeFileIndex]);

    useEffect(() => {
      if (activeDiff != null && onActiveFileChange != null) {
        onActiveFileChange(activeDiff.path);
      }
    }, [activeDiff, onActiveFileChange]);

    if (diffs.length === 0) {
      return <EmptyState>Select a file to view diff</EmptyState>;
    }

    const paddingTop = virtualItems[0]?.start ?? 0;
    const lastItem = virtualItems[virtualItems.length - 1];
    const paddingBottom = lastItem != null
      ? virtualizer.getTotalSize() - lastItem.end
      : 0;

    return (
      <div ref={containerRef} className={styles.container} data-testid="stacked-diff-viewer" onScroll={updateActiveFile}>
        {activeDiff != null && (
          <div className={styles.stickyOverlay} style={{ marginBottom: -HEADER_HEIGHT }} data-testid="sticky-file-header">
            <FileHeader
              diff={activeDiff}
              reviewedPaths={reviewedPaths}
              onToggleReviewed={onToggleReviewed}
            />
          </div>
        )}
        <div
          className={styles.virtualList}
          style={{ paddingTop, paddingBottom, minHeight: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((virtualItem) => {
            const item = flatItems[virtualItem.index];
            if (item == null) {
              return null;
            }

            return (
              <div
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
              >
                <VirtualRow
                  item={item}
                  tokenMap={tokenMaps.get(filePathByIndex[virtualItem.index] ?? '') ?? null}
                  reviewedPaths={reviewedPaths}
                  onToggleReviewed={onToggleReviewed}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  },
));
