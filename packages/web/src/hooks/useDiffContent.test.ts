import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchDiffContent } from './useDiffContent';

describe('useDiffContent', () => {
  describe('fetchDiffContent', () => {
    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(vi.fn());
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
  });
});
