import type { WorkerRequest } from './highlightProtocol';
import { handleHighlightRequest } from './highlightEngine';

globalThis.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  void handleHighlightRequest(request)
    .then((response) => {
      // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage does not accept targetOrigin
      globalThis.postMessage(response);
    })
    .catch(() => {
      const fallback = { type: 'highlight-result' as const, filePath: request.filePath, tokens: {} };
      // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage does not accept targetOrigin
      globalThis.postMessage(fallback);
    });
});
