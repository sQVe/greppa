import { useEffect, useRef, useState } from 'react';

import type { DiffFile } from '../../fixtures/types';
import type {
  HighlightRequest,
  HighlightResponse,
  HighlightToken,
} from '../../workers/highlightProtocol';
import { diffLineKey } from './buildRows';

let sharedWorker: Worker | null = null;

const getOrCreateWorker = () => {
  sharedWorker ??= new Worker(new URL('../../workers/highlightWorker.ts', import.meta.url), {
    type: 'module',
  });

  return sharedWorker;
};

const buildHighlightRequest = (diff: DiffFile, theme: string): HighlightRequest => {
  const lines: HighlightRequest['lines'] = [];

  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      lines.push({ key: diffLineKey(line), content: line.content });
    }
  }

  return {
    type: 'highlight',
    filePath: diff.path,
    language: diff.language,
    theme,
    lines,
  };
};

export const useSyntaxHighlighting = (diff: DiffFile | null, theme: string) => {
  const [tokenMap, setTokenMap] = useState<Map<string, HighlightToken[]> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (diff == null) {
      setTokenMap(null);
      return;
    }

    const currentId = ++requestIdRef.current;
    const worker = getOrCreateWorker();
    const request = buildHighlightRequest(diff, theme);

    const handleMessage = (event: MessageEvent<HighlightResponse>) => {
      if (currentId !== requestIdRef.current || event.data.filePath !== diff.path) {
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

export const resetWorkerForTesting = () => {
  sharedWorker?.terminate();
  sharedWorker = null;
};
