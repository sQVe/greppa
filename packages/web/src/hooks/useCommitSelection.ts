import { useCallback, useMemo, useState } from 'react';

import type { CommitEntry } from '@greppa/core';

interface CommitSelectionState {
  selectedShas: Set<string>;
  anchorSha: string | null;
}

const EMPTY: CommitSelectionState = { selectedShas: new Set(), anchorSha: null };

export const useCommitSelection = (commits: CommitEntry[]) => {
  const [state, setState] = useState<CommitSelectionState>(EMPTY);

  const selectCommit = useCallback(
    (sha: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => {
      if (modifiers.metaKey) {
        setState((prev) => {
          const next = new Set(prev.selectedShas);
          if (next.has(sha)) {
            next.delete(sha);
          } else {
            next.add(sha);
          }
          return { selectedShas: next, anchorSha: sha };
        });
        return;
      }

      if (modifiers.shiftKey) {
        setState((prev) => {
          const anchor = prev.anchorSha;
          if (anchor == null) {
            return { selectedShas: new Set([sha]), anchorSha: sha };
          }

          const anchorIndex = commits.findIndex((c) => c.sha === anchor);
          const targetIndex = commits.findIndex((c) => c.sha === sha);
          if (anchorIndex === -1 || targetIndex === -1) {
            return { selectedShas: new Set([sha]), anchorSha: sha };
          }

          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);
          const rangeShas = new Set(commits.slice(start, end + 1).map((c) => c.sha));

          return { selectedShas: rangeShas, anchorSha: anchor };
        });
        return;
      }

      setState({ selectedShas: new Set([sha]), anchorSha: sha });
    },
    [commits],
  );

  const clear = useCallback(() => {
    setState(EMPTY);
  }, []);

  const diffRange = useMemo(() => {
    if (state.selectedShas.size === 0) {
      return null;
    }

    const selectedCommits = commits.filter((c) => state.selectedShas.has(c.sha));
    if (selectedCommits.length === 0) {
      return null;
    }

    const lastCommit = selectedCommits[selectedCommits.length - 1];
    const firstCommit = selectedCommits[0];

    if (lastCommit == null || firstCommit == null) {
      return null;
    }

    const lastIndex = commits.indexOf(lastCommit);
    const parentCommit = commits[lastIndex + 1];
    const oldRef = parentCommit != null ? parentCommit.sha : `${lastCommit.sha}~1`;

    return {
      oldRef,
      newRef: firstCommit.sha,
    };
  }, [commits, state.selectedShas]);

  return {
    selectedShas: state.selectedShas,
    selectCommit,
    clear,
    diffRange,
    isActive: state.selectedShas.size > 0,
  };
};
