import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWorktreeDiffContent } from './useWorktreeDiffContent';

describe('useWorktreeDiffContent', () => {
  describe('fetchWorktreeDiffContent', () => {
    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch from correct URL', async () => {
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

      await fetchWorktreeDiffContent('src/index.ts');

      expect(fetch).toHaveBeenCalledWith('/api/worktree/diff/src/index.ts');
    });

    it('should encode path segments', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            path: 'src/my file.ts',
            changeType: 'modified',
            oldContent: '',
            newContent: '',
          }),
      } as Response);

      await fetchWorktreeDiffContent('src/my file.ts');

      expect(fetch).toHaveBeenCalledWith('/api/worktree/diff/src/my%20file.ts');
    });

    it('should return parsed response', async () => {
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

      const result = await fetchWorktreeDiffContent('src/index.ts');

      expect(result).toEqual(expected);
    });

    it('should throw on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchWorktreeDiffContent('src/index.ts')).rejects.toThrow(
        'Failed to fetch working tree diff: 500',
      );
    });
  });
});
