import { useEffect, useRef, useState } from 'react';

import type { DiffMapping, DiffRequest, DiffWorkerResponse } from '../workers/diffProtocol';

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
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (filePath == null || oldContent == null || newContent == null) {
      setChanges(null);
      setError(null);
      return;
    }

    const currentId = ++requestIdRef.current;
    const worker = getOrCreateWorker();
    setError(null);

    const request: DiffRequest = {
      type: 'diff',
      filePath,
      oldContent,
      newContent,
    };

    const handleMessage = (event: MessageEvent<DiffWorkerResponse>) => {
      if (currentId !== requestIdRef.current || event.data.filePath !== filePath) {
        return;
      }

      setChanges(event.data.changes);
    };

    const handleError = (event: ErrorEvent) => {
      if (currentId !== requestIdRef.current) {
        return;
      }
      setError(event.message);
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

  return { changes, error };
};

export const resetDiffWorkerForTesting = () => {
  sharedWorker?.terminate();
  sharedWorker = null;
};
