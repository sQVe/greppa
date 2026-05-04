// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCommits, useCommitList } from './useCommitList';

const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

describe('useCommitList', () => {
  describe('fetchCommits', () => {
    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch from /api/commits with query params', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      await fetchCommits('main', 'HEAD');

      expect(fetch).toHaveBeenCalledWith('/api/commits?oldRef=main&newRef=HEAD');
    });

    it('should return parsed commit entries', async () => {
      const expected = [
        {
          sha: 'abc123',
          abbrevSha: 'abc',
          subject: 'feat: thing',
          author: 'Alice',
          date: '2026-04-03T10:00:00+00:00',
        },
      ];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(expected),
      } as Response);

      const result = await fetchCommits('main', 'HEAD');

      expect(result).toEqual(expected);
    });

    it('should throw on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchCommits('main', 'HEAD')).rejects.toThrow('Failed to fetch commits: 500');
    });
  });

  describe('select transform', () => {
    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("reorders each commit's files into tree-DFS layout", async () => {
      const serverCommits = [
        {
          sha: 'abc123',
          abbrevSha: 'abc',
          subject: 'feat: thing',
          author: 'Alice',
          date: '2026-04-03T10:00:00+00:00',
          files: [
            'beads.jsonl',
            'packages/web/src/App.tsx',
            'packages/web/src/components/CommitList/CommitList.tsx',
          ],
        },
      ];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(serverCommits),
      } as Response);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      const { result } = renderHook(() => useCommitList('main', 'HEAD'), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.commits).toHaveLength(1);
      });
      expect(result.current.commits[0]?.files).toEqual([
        'packages/web/src/components/CommitList/CommitList.tsx',
        'packages/web/src/App.tsx',
        'beads.jsonl',
      ]);
    });

    it('does not mutate the original server response', async () => {
      const firstCommit = {
        sha: 'abc123',
        abbrevSha: 'abc',
        subject: 'feat: thing',
        author: 'Alice',
        date: '2026-04-03T10:00:00+00:00',
        files: ['beads.jsonl', 'packages/web/src/App.tsx'],
      };
      const serverCommits = [firstCommit];
      const originalFiles = [...firstCommit.files];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(serverCommits),
      } as Response);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      const { result } = renderHook(() => useCommitList('main', 'HEAD'), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.commits).toHaveLength(1);
      });
      expect(serverCommits[0]?.files).toEqual(originalFiles);
    });
  });
});
