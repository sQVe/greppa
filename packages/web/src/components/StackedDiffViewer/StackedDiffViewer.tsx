import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

import { Badge, EmptyState } from '@greppa/ui';

import type { ChangeType, DiffFile } from '../../fixtures/types';
import { DiffViewer } from '../DiffViewer/DiffViewer';

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

const CHANGE_LABELS: Record<ChangeType, string> = {
  added: 'Added',
  deleted: 'Deleted',
  modified: 'Modified',
  renamed: 'Renamed',
};

export const StackedDiffViewer = forwardRef<StackedDiffViewerHandle, StackedDiffViewerProps>(
  ({ diffs, reviewedPaths, onToggleReviewed, onActiveFileChange }, ref) => {
    const headerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);

    const setHeaderRef = useCallback((path: string, element: HTMLDivElement | null) => {
      if (element != null) {
        headerRefs.current.set(path, element);
      } else {
        headerRefs.current.delete(path);
      }
    }, []);

    useImperativeHandle(ref, () => ({
      scrollToFile: (path: string) => {
        const header = headerRefs.current.get(path);
        header?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }), []);

    useEffect(() => {
      if (onActiveFileChange == null || diffs.length <= 1) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const path = entry.target.getAttribute('data-file-path');
              if (path != null) {
                onActiveFileChange(path);
              }
            }
          }
        },
        { root: containerRef.current, rootMargin: '0px 0px -80% 0px', threshold: 0 },
      );

      for (const header of headerRefs.current.values()) {
        observer.observe(header);
      }

      return () => {
        observer.disconnect();
      };
    }, [diffs, onActiveFileChange]);

    if (diffs.length === 0) {
      return <EmptyState>Select a file to view diff</EmptyState>;
    }

    return (
      <div ref={containerRef} className={styles.container} data-testid="stacked-diff-viewer">
        {diffs.map((diff, index) => (
          <div key={diff.path}>
            <div
              ref={(element) =>{  setHeaderRef(diff.path, element); }}
              className={styles.fileHeader}
              data-testid="file-header"
              data-file-path={diff.path}
            >
              <Badge variant={diff.changeType}>{CHANGE_LABELS[diff.changeType]}</Badge>
              <span className={styles.filePath}>{diff.path}</span>
              <button
                type="button"
                className={`${styles.reviewButton} ${reviewedPaths?.has(diff.path) ? styles.reviewed : ''}`}
                onClick={() => onToggleReviewed?.(diff.path)}
              >
                {reviewedPaths?.has(diff.path) ? '\u2713 Reviewed' : 'Mark reviewed'}
              </button>
            </div>
            <DiffViewer diff={diff} />
            {index < diffs.length - 1 ? (
              <div className={styles.separator} data-testid="file-separator" />
            ) : null}
          </div>
        ))}
      </div>
    );
  },
);
