import { useNavigate, useRouterState } from '@tanstack/react-router';
import { nanoid } from 'nanoid';
import { useCallback, useMemo, useRef } from 'react';

import type { CommitEntry } from '@greppa/core';

import type { StatePayload } from '../stateCache';
import { cacheState, findExistingId, postState } from '../stateCache';
import { toStringArray } from '../toStringArray';

const buildState = (shas: string[]): StatePayload => ({
  file: [],
  wt: [],
  commits: shas,
});

const selectCommitParams = (s: { location: { search: Record<string, unknown> } }) =>
  toStringArray(s.location.search.commits);

export const useCommitSelection = (commits: CommitEntry[]) => {
  const commitParams = useRouterState({ select: selectCommitParams });
  const navigate = useNavigate();
  const anchorRef = useRef<string | null>(null);

  const selectedShas = useMemo(
    () => new Set(commitParams),
    [commitParams],
  );

  const navigateWithState = useCallback(
    (state: StatePayload, replace?: boolean) => {
      const existing = findExistingId(state);
      const id = existing ?? nanoid(4);
      if (existing == null) {
        cacheState(id, state);
        postState(id, state);
      }
      void navigate({ to: '/commits', search: { s: id, commits: state.commits }, replace });
    },
    [navigate],
  );

  const selectCommit = useCallback(
    (sha: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => {
      if (modifiers.metaKey) {
        anchorRef.current = sha;
        const next = new Set(selectedShas);
        if (next.has(sha)) {
          next.delete(sha);
        } else {
          next.add(sha);
        }
        navigateWithState(buildState([...next]), true);
        return;
      }

      if (modifiers.shiftKey) {
        const anchor = anchorRef.current;
        if (anchor == null) {
          anchorRef.current = sha;
          navigateWithState(buildState([sha]), true);
          return;
        }

        const anchorIndex = commits.findIndex((commit) => commit.sha === anchor);
        const targetIndex = commits.findIndex((commit) => commit.sha === sha);
        if (anchorIndex === -1 || targetIndex === -1) {
          anchorRef.current = sha;
          navigateWithState(buildState([sha]), true);
          return;
        }

        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        const rangeShas = commits.slice(start, end + 1).map((commit) => commit.sha);
        navigateWithState(buildState(rangeShas), true);
        return;
      }

      anchorRef.current = sha;
      navigateWithState(buildState([sha]));
    },
    [commits, selectedShas, navigateWithState],
  );

  const clear = useCallback(() => {
    anchorRef.current = null;
    void navigate({ to: '/commits', search: { s: '', commits: [] }, replace: true });
  }, [navigate]);

  const diffRange = useMemo(() => {
    if (selectedShas.size === 0) {
      return null;
    }

    const selectedCommits = commits.filter((c) => selectedShas.has(c.sha));
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
  }, [commits, selectedShas]);

  return {
    selectedShas,
    selectCommit,
    clear,
    diffRange,
    isActive: selectedShas.size > 0,
  };
};
