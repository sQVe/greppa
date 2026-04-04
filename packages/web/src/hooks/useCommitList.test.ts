import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCommits } from './useCommitList';

describe('useCommitList', () => {
  describe('fetchCommits', () => {
    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(vi.fn());
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches from /api/commits with query params', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      await fetchCommits('main', 'HEAD');

      expect(fetch).toHaveBeenCalledWith('/api/commits?oldRef=main&newRef=HEAD');
    });

    it('returns parsed commit entries', async () => {
      const expected = [
        { sha: 'abc123', abbrevSha: 'abc', subject: 'feat: thing', author: 'Alice', date: '2026-04-03T10:00:00+00:00' },
      ];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(expected),
      } as Response);

      const result = await fetchCommits('main', 'HEAD');

      expect(result).toEqual(expected);
    });

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchCommits('main', 'HEAD')).rejects.toThrow('Failed to fetch commits: 500');
    });
  });
});
