import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchRefs } from './useRefs';

describe('useRefs', () => {
  describe('fetchRefs', () => {
    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(vi.fn());
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches from /api/refs', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ oldRef: 'main', newRef: 'HEAD' }),
      } as Response);

      await fetchRefs();

      expect(fetch).toHaveBeenCalledWith('/api/refs');
    });

    it('returns parsed response', async () => {
      const expected = { oldRef: 'main', newRef: 'feature-branch' };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(expected),
      } as Response);

      const result = await fetchRefs();

      expect(result).toEqual(expected);
    });

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchRefs()).rejects.toThrow('Failed to fetch refs: 500');
    });
  });
});
