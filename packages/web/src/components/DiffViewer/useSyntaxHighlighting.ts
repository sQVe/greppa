import { useEffect, useRef, useState } from 'react';

import type { DiffFile } from '../../fixtures/types';
import type {
  HighlightRequest,
  HighlightResponse,
  HighlightToken,
} from '../../workers/highlightProtocol';
import { diffLineKey } from './buildRows';
import { clearTokenStyles } from './tokenStylesheet';

let sharedWorker: Worker | null = null;

const getOrCreateWorker = () => {
  sharedWorker ??= new Worker(new URL('../../workers/highlightWorker.ts', import.meta.url), {
    type: 'module',
  });

  return sharedWorker;
};

const buildHighlightRequest = (
  diff: DiffFile,
  theme: string,
  requestId: number,
): HighlightRequest => {
  const lines: HighlightRequest['lines'] = [];

  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      lines.push({ key: diffLineKey(line), content: line.content });
    }
  }

  return {
    type: 'highlight',
    requestId,
    filePath: diff.path,
    language: diff.language,
    theme,
    lines,
    ...(diff.oldContent != null ? { oldContent: diff.oldContent } : {}),
    ...(diff.newContent != null ? { newContent: diff.newContent } : {}),
  };
};

export const useSyntaxHighlighting = (diff: DiffFile | null, theme: string) => {
  const [tokenMap, setTokenMap] = useState<Map<string, HighlightToken[]> | null>(null);
  const requestIdRef = useRef(0);
  const prevThemeRef = useRef(theme);

  useEffect(() => {
    if (prevThemeRef.current !== theme) {
      clearTokenStyles();
      setTokenMap(null);
      prevThemeRef.current = theme;
    }

    if (diff == null) {
      setTokenMap(null);
      return;
    }

    const currentId = ++requestIdRef.current;
    const worker = getOrCreateWorker();
    const request = buildHighlightRequest(diff, theme, currentId);

    const handleMessage = (event: MessageEvent<HighlightResponse>) => {
      if (event.data.requestId !== currentId || event.data.filePath !== diff.path) {
        return;
      }

      const map = new Map<string, HighlightToken[]>();
      for (const [key, tokens] of Object.entries(event.data.tokens)) {
        map.set(key, tokens);
      }
      setTokenMap(map);
    };

    const handleError = (event: ErrorEvent) => {
      // eslint-disable-next-line no-console -- surface worker script-load failures during development
      console.error('Highlight worker error:', event.message);
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- Worker.postMessage does not accept targetOrigin
    worker.postMessage(request);

    return () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };
  }, [diff, theme]);

  return tokenMap;
};

export const useMultiSyntaxHighlighting = (diffs: DiffFile[], theme: string) => {
  const [tokenMaps, setTokenMaps] = useState<Map<string, Map<string, HighlightToken[]>>>(new Map());
  const requestIdRef = useRef(0);
  const prevThemeRef = useRef(theme);

  useEffect(() => {
    if (prevThemeRef.current !== theme) {
      clearTokenStyles();
      setTokenMaps(new Map());
      prevThemeRef.current = theme;
    }

    const currentId = ++requestIdRef.current;

    if (diffs.length === 0) {
      return;
    }

    const worker = getOrCreateWorker();
    const accumulated = new Map<string, Map<string, HighlightToken[]>>();
    let flushScheduled = false;
    let rafId = 0;

    const handleMessage = (event: MessageEvent<HighlightResponse>) => {
      if (event.data.requestId !== currentId) {
        return;
      }

      const map = new Map<string, HighlightToken[]>();
      for (const [key, tokens] of Object.entries(event.data.tokens)) {
        map.set(key, tokens);
      }
      accumulated.set(event.data.filePath, map);

      if (!flushScheduled) {
        flushScheduled = true;
        rafId = requestAnimationFrame(() => {
          flushScheduled = false;
          if (currentId === requestIdRef.current) {
            setTokenMaps((prev) => {
              const merged = new Map(prev);
              for (const [filePath, tokenMap] of accumulated) {
                merged.set(filePath, tokenMap);
              }
              return merged;
            });
          }
        });
      }
    };

    const handleError = (event: ErrorEvent) => {
      // eslint-disable-next-line no-console -- surface worker script-load failures during development
      console.error('Highlight worker error:', event.message);
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    for (const diff of diffs) {
      // eslint-disable-next-line unicorn/require-post-message-target-origin -- Worker.postMessage does not accept targetOrigin
      worker.postMessage(buildHighlightRequest(diff, theme, currentId));
    }

    return () => {
      cancelAnimationFrame(rafId);
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };
  }, [diffs, theme]);

  return tokenMaps;
};

export const resetWorkerForTesting = () => {
  sharedWorker?.terminate();
  sharedWorker = null;
};
