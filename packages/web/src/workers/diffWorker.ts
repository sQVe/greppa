import type { DiffWorkerRequest, DiffWorkerResponse } from './diffProtocol';
import { handleDiffRequest } from './diffEngine';

globalThis.addEventListener('message', (event: MessageEvent<DiffWorkerRequest>) => {
  try {
    const response = handleDiffRequest(event.data);
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage does not accept targetOrigin
    globalThis.postMessage(response);
  } catch (error) {
    const errorResponse: DiffWorkerResponse = {
      type: 'diff-result',
      filePath: event.data.filePath,
      changes: [],
      hitTimeout: false,
    };
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage does not accept targetOrigin
    globalThis.postMessage(errorResponse);
    console.error('[diffWorker]', error);
  }
});
