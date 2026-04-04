import { useEffect, useRef, useState } from 'react';

import type { DiffFile } from '../../fixtures/types';
import { DiffViewer } from '../DiffViewer/DiffViewer';

const ROW_HEIGHT = 36;

const estimateHeight = (diff: DiffFile) => {
  const rowCount = diff.hunks.reduce((sum, hunk) => sum + hunk.lines.length, 0);
  return (rowCount + diff.hunks.length) * ROW_HEIGHT;
};

export const LazyDiffViewer = ({ diff }: { diff: DiffFile }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element == null) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );

    observer.observe(element);
    return () => { observer.disconnect(); };
  }, []);

  return (
    <div ref={ref}>
      {visible ? <DiffViewer diff={diff} /> : <div style={{ height: estimateHeight(diff) }} />}
    </div>
  );
};
