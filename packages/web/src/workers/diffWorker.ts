import { handleDiffRequest } from './diffEngine';
import type { DiffWorkerRequest, DiffWorkerResponse } from './diffProtocol';

globalThis.addEventListener('message', (event: MessageEvent<DiffWorkerRequest>) => {
  try {
    const response = handleDiffRequest(event.data);
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage does not accept targetOrigin
    globalThis.postMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorResponse: DiffWorkerResponse = {
      type: 'diff-result',
      requestId: event.data.requestId,
      filePath: event.data.filePath,
      changes: [],
      hitTimeout: false,
      error: message,
    };
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage does not accept targetOrigin
    globalThis.postMessage(errorResponse);
  }
});
