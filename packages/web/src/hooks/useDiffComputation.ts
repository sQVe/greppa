import { useEffect, useRef, useState } from 'react';

import type { DiffMapping, DiffRequest, DiffResponse } from '../workers/diffProtocol';

let sharedWorker: Worker | null = null;

const getOrCreateWorker = () => {
  sharedWorker ??= new Worker(new URL('../workers/diffWorker.ts', import.meta.url), {
    type: 'module',
  });

  return sharedWorker;
};

export const useDiffComputation = (
  filePath: string | null,
  oldContent: string | null,
  newContent: string | null,
) => {
  const [changes, setChanges] = useState<DiffMapping[] | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (filePath == null || oldContent == null || newContent == null) {
      setChanges(null);
      return;
    }

    const currentId = ++requestIdRef.current;
    const worker = getOrCreateWorker();

    const request: DiffRequest = {
      type: 'diff',
      filePath,
      oldContent,
      newContent,
    };

    const handleMessage = (event: MessageEvent<DiffResponse>) => {
      if (currentId !== requestIdRef.current || event.data.filePath !== filePath) {
        return;
      }

      setChanges(event.data.changes);
    };

    const handleError = (event: ErrorEvent) => {
      // eslint-disable-next-line no-console -- surface worker script-load failures during development
      console.error('Diff worker error:', event.message);
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- Worker.postMessage does not accept targetOrigin
    worker.postMessage(request);

    return () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };
  }, [filePath, oldContent, newContent]);

  return changes;
};

export const resetDiffWorkerForTesting = () => {
  sharedWorker?.terminate();
  sharedWorker = null;
};
