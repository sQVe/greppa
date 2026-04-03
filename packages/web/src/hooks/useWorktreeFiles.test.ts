import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWorktreeFiles } from './useWorktreeFiles';

describe('useWorktreeFiles', () => {
  describe('fetchWorktreeFiles', () => {
    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(vi.fn());
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches from /api/worktree/files', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      await fetchWorktreeFiles();

      expect(fetch).toHaveBeenCalledWith('/api/worktree/files');
    });

    it('returns parsed response', async () => {
      const expected = [
        { path: 'src/index.ts', changeType: 'modified' },
        { path: 'README.md', changeType: 'added' },
      ];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(expected),
      } as Response);

      const result = await fetchWorktreeFiles();

      expect(result).toEqual(expected);
    });

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchWorktreeFiles()).rejects.toThrow(
        'Failed to fetch working tree files: 500',
      );
    });
  });
});
