import { useEffect } from 'react';

import type { DiffResponse } from '@greppa/core';

import type { FileNode } from '../fixtures/types';
import { getDiff, setDiff } from './diffCache';

export const useWarmup = (
  oldRef: string | null,
  newRef: string | null,
  files: readonly FileNode[] | null,
): void => {
  const hasFiles = files != null;

  useEffect(() => {
    if (oldRef == null || newRef == null || !hasFiles || oldRef === '' || newRef === '') {
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

    // The server emits a terminal `done` event after the final diff. Without this
    // explicit close, the browser treats the normal response close as a disconnect
    // and auto-reconnects, re-running the full warmup stream forever.
    const onDone = () => {
      eventSource.close();
    };

    // EventSource.onerror fires on any transport error; default behavior is to
    // reconnect. We always want to surrender — a mid-stream failure would otherwise
    // trigger the same reconnect loop as a normal close.
    const onError = () => {
      eventSource.close();
    };

    eventSource.addEventListener('message', onMessage);
    eventSource.addEventListener('done', onDone);
    eventSource.addEventListener('error', onError);

    return () => {
      eventSource.removeEventListener('message', onMessage);
      eventSource.removeEventListener('done', onDone);
      eventSource.removeEventListener('error', onError);
      eventSource.close();
    };
  }, [oldRef, newRef, hasFiles]);
};
