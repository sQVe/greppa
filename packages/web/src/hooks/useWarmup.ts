import { useEffect } from 'react';

import type { DiffResponse } from '@greppa/core';

import type { FileNode } from '../fixtures/types';
import { getDiff, setDiff } from './diffCache';

export const useWarmup = (
  oldRef: string | null,
  newRef: string | null,
  files: readonly FileNode[] | null,
): void => {
  useEffect(() => {
    if (oldRef == null || newRef == null || files == null || oldRef === '' || newRef === '') {
      return;
    }

    const url = `/api/warmup/${encodeURIComponent(oldRef)}/${encodeURIComponent(newRef)}`;
    const eventSource = new EventSource(url);

    const onMessage = (event: MessageEvent<string>) => {
      // oxlint-disable-next-line no-unsafe-type-assertion -- SSE payload matches DiffResponse schema
      const diff = JSON.parse(event.data) as DiffResponse;
      const key = { oldRef, newRef, path: diff.path };
      // Guard against redundant writes when the client navigates back to a warmed file.
      void getDiff(key)
        .then((existing) => {
          if (existing != null) {
            return;
          }
          // Swallows quota/Safari-private-mode errors — next session simply refetches.
          return setDiff(key, diff);
        })
        .catch(() => undefined);
    };

    eventSource.addEventListener('message', onMessage);

    return () => {
      eventSource.removeEventListener('message', onMessage);
      eventSource.close();
    };
  }, [oldRef, newRef, files]);
};
