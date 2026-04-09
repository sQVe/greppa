import 'fake-indexeddb/auto';

import { clear, createStore } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as diffCache from './diffCache';
import { fetchDiffContent } from './useDiffContent';

describe('useDiffContent', () => {
  describe('fetchDiffContent', () => {
    beforeEach(async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(vi.fn());
      await clear(createStore('greppa-diff-cache', 'diffs'));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches from correct URL', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            path: 'src/index.ts',
            changeType: 'modified',
            oldContent: 'old',
            newContent: 'new',
          }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      await fetchDiffContent('HEAD~1', 'HEAD', 'src/index.ts');

      expect(fetch).toHaveBeenCalledWith('/api/diff/HEAD~1/HEAD/src/index.ts');
    });

    it('returns parsed response', async () => {
      const expected = {
        path: 'src/index.ts',
        changeType: 'modified',
        oldContent: 'old',
        newContent: 'new',
      };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(expected),
      } as Response);

      const result = await fetchDiffContent('HEAD~1', 'HEAD', 'src/index.ts');

      expect(result).toEqual(expected);
    });

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(
        fetchDiffContent('HEAD~1', 'HEAD', 'src/index.ts'),
      ).rejects.toThrow('Failed to fetch diff: 500');
    });

    it('returns the cached value without calling fetch when diffCache has a hit', async () => {
      const cached = {
        path: 'src/cached.ts',
        changeType: 'modified' as const,
        oldContent: 'old',
        newContent: 'new',
      };
      const fromServer = {
        path: 'src/cached.ts',
        changeType: 'modified' as const,
        oldContent: 'server-old',
        newContent: 'server-new',
      };
      vi.spyOn(diffCache, 'getDiff').mockResolvedValue(cached);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fromServer),
      } as Response);

      const result = await fetchDiffContent('HEAD~1', 'HEAD', 'src/cached.ts');

      expect(result).toEqual(cached);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('serves a previously cached triple entirely from IndexedDB with zero fetch calls', async () => {
      const triple = { oldRef: 'sessionA', newRef: 'sessionB', path: 'src/persisted.ts' };
      const seeded = {
        path: 'src/persisted.ts',
        changeType: 'modified' as const,
        oldContent: 'prior',
        newContent: 'session',
      };
      await diffCache.setDiff(triple, seeded);

      const result = await fetchDiffContent(triple.oldRef, triple.newRef, triple.path);

      expect(result).toEqual(seeded);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('fetches fresh from the server when oldRef changes even if the path was previously cached', async () => {
      const path = 'src/same-path.ts';
      const cachedForOldRefA = {
        path,
        changeType: 'modified' as const,
        oldContent: 'a-old',
        newContent: 'a-new',
      };
      await diffCache.setDiff({ oldRef: 'refA', newRef: 'refZ', path }, cachedForOldRefA);

      const serverResponse = {
        path,
        changeType: 'modified' as const,
        oldContent: 'b-old',
        newContent: 'b-new',
      };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(serverResponse),
      } as Response);

      const result = await fetchDiffContent('refB', 'refZ', path);

      expect(result).toEqual(serverResponse);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('writes the server response to diffCache after a successful fetch', async () => {
      const fromServer = {
        path: 'src/writeback.ts',
        changeType: 'added' as const,
        oldContent: '',
        newContent: 'fresh',
      };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fromServer),
      } as Response);
      const setSpy = vi.spyOn(diffCache, 'setDiff');

      await fetchDiffContent('refA', 'refB', 'src/writeback.ts');

      expect(setSpy).toHaveBeenCalledWith(
        { oldRef: 'refA', newRef: 'refB', path: 'src/writeback.ts' },
        fromServer,
      );
    });
  });
});
