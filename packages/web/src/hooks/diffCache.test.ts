import 'fake-indexeddb/auto';

import { describe, expect, it, vi } from 'vitest';

import type { DiffResponse } from '@greppa/core';

describe('diffCache', () => {
  it('returns null when nothing is cached for the triple', async () => {
    const { getDiff } = await import('./diffCache');
    const result = await getDiff({
      oldRef: 'HEAD~1',
      newRef: 'HEAD',
      path: 'src/miss.ts',
    });

    expect(result).toBeNull();
  });

  it('returns the stored value after setDiff for the same triple', async () => {
    const { getDiff, setDiff } = await import('./diffCache');
    const key = { oldRef: 'abc', newRef: 'def', path: 'src/round-trip.ts' };
    const value: DiffResponse = {
      path: 'src/round-trip.ts',
      changeType: 'modified',
      oldContent: 'before',
      newContent: 'after',
    };

    await setDiff(key, value);
    const result = await getDiff(key);

    expect(result).toEqual(value);
  });

  it('persists across a simulated module reload — fresh diffCache import reads prior writes', async () => {
    const key = { oldRef: 'v1', newRef: 'v2', path: 'src/persist.ts' };
    const value: DiffResponse = {
      path: 'src/persist.ts',
      changeType: 'added',
      oldContent: '',
      newContent: 'hello',
    };

    const session1 = await import('./diffCache');
    await session1.setDiff(key, value);

    // Simulate a page reload: drop the module cache and reimport, exercising
    // the public API against persistent IndexedDB state (not idb-keyval directly).
    vi.resetModules();
    const session2 = await import('./diffCache');
    const result = await session2.getDiff(key);

    expect(result).toEqual(value);
  });
});
