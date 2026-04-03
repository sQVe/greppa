import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';

import { Badge, EmptyState } from '@greppa/ui';

import type { ChangeType, DiffFile } from '../../fixtures/types';
import { DiffViewer } from '../DiffViewer/DiffViewer';

import styles from './StackedDiffViewer.module.css';

interface StackedDiffViewerProps {
  diffs: DiffFile[];
}

const CHANGE_LABELS: Record<ChangeType, string> = {
  added: 'Added',
  deleted: 'Deleted',
  modified: 'Modified',
  renamed: 'Renamed',
};

export const StackedDiffViewer = ({ diffs }: StackedDiffViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const setHeaderRef = useCallback((index: number, element: HTMLDivElement | null) => {
    if (element != null) {
      headerRefs.current.set(index, element);
    } else {
      headerRefs.current.delete(index);
    }
  }, []);

  const scrollToFile = useCallback((index: number) => {
    const header = headerRefs.current.get(index);
    if (header != null) {
      header.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentFileIndex(index);
    }
  }, []);

  const handlePrevious = useCallback(() => {
    if (currentFileIndex > 0) {
      scrollToFile(currentFileIndex - 1);
    }
  }, [currentFileIndex, scrollToFile]);

  const handleNext = useCallback(() => {
    if (currentFileIndex < diffs.length - 1) {
      scrollToFile(currentFileIndex + 1);
    }
  }, [currentFileIndex, diffs.length, scrollToFile]);

  if (diffs.length === 0) {
    return <EmptyState>Select a file to view diff</EmptyState>;
  }

  if (diffs.length === 1) {
    const diff = diffs[0];
    if (diff == null) {
      return null;
    }
    return <DiffViewer diff={diff} />;
  }

  return (
    <div ref={containerRef} className={styles.container} data-testid="stacked-diff-viewer">
      <div className={styles.fileNav} data-testid="file-nav">
        <span>File {currentFileIndex + 1} of {diffs.length}</span>
        <div className={styles.fileNavArrows}>
          <button
            type="button"
            className={styles.fileNavButton}
            aria-label="Previous file"
            onClick={handlePrevious}
          >
            <IconChevronUp size={12} />
          </button>
          <button
            type="button"
            className={styles.fileNavButton}
            aria-label="Next file"
            onClick={handleNext}
          >
            <IconChevronDown size={12} />
          </button>
        </div>
      </div>
      {diffs.map((diff, index) => (
        <div key={diff.path}>
          <div
            ref={(element) =>{  setHeaderRef(index, element); }}
            className={styles.fileHeader}
            data-testid="file-header"
          >
            <Badge variant={diff.changeType}>{CHANGE_LABELS[diff.changeType]}</Badge>
            <span className={styles.filePath}>{diff.path}</span>
            <button type="button" className={styles.reviewButton}>
              Mark reviewed
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
};
