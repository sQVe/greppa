import type { DiffResponse } from '@greppa/core';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { DiffFile } from '../fixtures/types';
import type { DiffMapping, DiffWorkerResponse } from '../workers/diffProtocol';
import type { FileSource } from '../useFileSelection';
import { buildDiffFile } from './buildDiffFile';
import { fetchDiffContent } from './useDiffContent';
import { getOrCreateWorker } from './useDiffComputation';
import { fetchWorktreeDiffContent } from './useWorktreeDiffContent';

const computeChangesViaWorker = (
  filePath: string,
  oldContent: string,
  newContent: string,
): Promise<DiffMapping[]> =>
  new Promise((resolve, reject) => {
    const worker = getOrCreateWorker();

    const handleMessage = (event: MessageEvent<DiffWorkerResponse>) => {
      if (event.data.filePath !== filePath) {
        return;
      }
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);

      if (event.data.error != null) {
        reject(new Error(event.data.error));
        return;
      }

      resolve(event.data.changes);
    };

    const handleError = (event: ErrorEvent) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      reject(new Error(event.message));
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- Worker.postMessage does not accept targetOrigin
    worker.postMessage({ type: 'diff', filePath, oldContent, newContent });
  });

const fetchAndComputeDiff = async (
  path: string,
  source: FileSource,
  oldRef: string,
  newRef: string,
): Promise<DiffFile | null> => {
  const response: DiffResponse =
    source === 'worktree'
      ? await fetchWorktreeDiffContent(path)
      : await fetchDiffContent(oldRef, newRef, path);

  const changes = await computeChangesViaWorker(
    response.path,
    response.oldContent,
    response.newContent,
  );

  return buildDiffFile({
    filePath: response.path,
    changeType: response.changeType,
    oldPath: response.oldPath ?? null,
    oldContent: response.oldContent,
    newContent: response.newContent,
    changes,
  });
};

export const useComputedDiffs = (
  paths: string[],
  source: FileSource | null,
  oldRef: string,
  newRef: string,
): DiffFile[] => {
  const results = useQueries({
    queries: paths.map((path) => ({
      queryKey:
        source === 'worktree'
          ? ['computed-diff', 'worktree', path]
          : ['computed-diff', oldRef, newRef, path],
      queryFn: () => fetchAndComputeDiff(path, source ?? 'committed', oldRef, newRef),
      enabled: source != null,
      retry: false,
      staleTime: source === 'worktree' ? 5_000 : Infinity,
    })),
  });

  return useMemo(
    () =>
      results
        .map((r) => r.data)
        .filter((d): d is DiffFile => d != null),
    [results],
  );
};
