import type { WorkerRequest } from './highlightProtocol';
import { handleHighlightRequest } from './highlightEngine';

globalThis.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void handleHighlightRequest(event.data).then((response) => {
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage does not accept targetOrigin
    globalThis.postMessage(response);
  });
});
