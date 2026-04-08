import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

import type { StackedDiffViewerHandle } from '../components/StackedDiffViewer/StackedDiffViewer';
import type { DiffFile } from '../fixtures/types';
import { parseHash } from './parseHash';

export const useHashScroll = (
  viewerRef: RefObject<StackedDiffViewerHandle | null>,
  diffs: DiffFile[],
  hash: string,
) => {
  const lastScrolledHash = useRef<string | null>(null);

  useEffect(() => {
    if (diffs.length === 0) {
      return;
    }

    const target = parseHash(hash);
    if (target == null) {
      return;
    }

    if (lastScrolledHash.current === hash) {
      return;
    }

    const viewer = viewerRef.current;
    if (viewer == null) {
      return;
    }

    lastScrolledHash.current = hash;

    if (target.line != null) {
      viewer.scrollToLine(target.path, target.line);
    } else {
      viewer.scrollToFile(target.path);
    }
  }, [diffs, viewerRef, hash]);
};
