import type { DiffWorkerRequest } from './diffProtocol';
import { handleDiffRequest } from './diffEngine';

globalThis.addEventListener('message', (event: MessageEvent<DiffWorkerRequest>) => {
  const response = handleDiffRequest(event.data);
  // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage does not accept targetOrigin
  globalThis.postMessage(response);
});
