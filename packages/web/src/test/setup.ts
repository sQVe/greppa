import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url === '/api/state') {
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
});
