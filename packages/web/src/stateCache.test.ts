import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearAllStateCaches, getOrCreateStateId } from './stateCache';

vi.mock('nanoid', () => {
  let counter = 0;
  return { nanoid: () => `t${++counter}` };
});

afterEach(() => {
  clearAllStateCaches();
});

describe('stateCache', () => {
  it('produces distinct ids for payloads that differ only in commitFile', () => {
    const a = getOrCreateStateId({ file: [], wt: [], commits: ['aaa'], commitFile: [] });
    const b = getOrCreateStateId({ file: [], wt: [], commits: ['aaa'], commitFile: ['aaa:src/a.ts'] });
    expect(a).not.toBe(b);
  });

  it('returns the same id for identical payloads', () => {
    const a = getOrCreateStateId({ file: [], wt: [], commits: ['aaa'], commitFile: ['aaa:src/a.ts'] });
    const b = getOrCreateStateId({ file: [], wt: [], commits: ['aaa'], commitFile: ['aaa:src/a.ts'] });
    expect(a).toBe(b);
  });
});
