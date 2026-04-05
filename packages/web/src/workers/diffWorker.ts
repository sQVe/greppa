import type { DiffWorkerRequest, DiffWorkerResponse } from './diffProtocol';
import { handleDiffRequest } from './diffEngine';

globalThis.addEventListener('message', (event: MessageEvent<DiffWorkerRequest>) => {
  try {
    const response = handleDiffRequest(event.data);
    response.requestId = event.data.requestId;
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
