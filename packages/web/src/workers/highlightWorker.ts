import { handleHighlightRequest } from './highlightEngine';
import type { WorkerRequest } from './highlightProtocol';

globalThis.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  void handleHighlightRequest(request)
    .then((response) => {
      // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage does not accept targetOrigin
      globalThis.postMessage(response);
    })
    .catch(() => {
      const fallback = {
        type: 'highlight-result' as const,
        requestId: request.requestId,
        filePath: request.filePath,
        tokens: {},
      };
      // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage does not accept targetOrigin
      globalThis.postMessage(fallback);
    });
});
