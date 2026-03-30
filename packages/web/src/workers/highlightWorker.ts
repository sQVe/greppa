import type { WorkerRequest } from './highlightProtocol';
import { handleHighlightRequest } from './highlightEngine';

globalThis.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void handleHighlightRequest(event.data).then((response) => {
    globalThis.postMessage(response, globalThis.location.origin);
  });
});
