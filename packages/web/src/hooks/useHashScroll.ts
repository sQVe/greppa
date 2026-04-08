import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

import type { StackedDiffViewerHandle } from '../components/StackedDiffViewer/StackedDiffViewer';
import type { DiffFile } from '../fixtures/types';
import { parseHash } from './parseHash';

export const useHashScroll = (
  viewerRef: RefObject<StackedDiffViewerHandle | null>,
  diffs: DiffFile[],
) => {
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (hasScrolled.current || diffs.length === 0) {
      return;
    }

    const target = parseHash(window.location.hash);
    if (target == null) {
      return;
    }

    const viewer = viewerRef.current;
    if (viewer == null) {
      return;
    }

    hasScrolled.current = true;

    if (target.line != null) {
      viewer.scrollToLine(target.path, target.line);
    } else {
      viewer.scrollToFile(target.path);
    }
  }, [diffs, viewerRef]);
};
