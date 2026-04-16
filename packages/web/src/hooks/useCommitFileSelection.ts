import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import { toStringArray } from '../toStringArray';

export interface CommitFileEntry {
  sha: string;
  path: string;
}

const SEP = ':';

const encode = (entry: CommitFileEntry) => `${entry.sha}${SEP}${entry.path}`;

const decode = (raw: string): CommitFileEntry | null => {
  const idx = raw.indexOf(SEP);
  if (idx <= 0 || idx === raw.length - 1) {
    return null;
  }
  return { sha: raw.slice(0, idx), path: raw.slice(idx + 1) };
};

const selectParams = (s: { location: { search: Record<string, unknown> } }) => ({
  commitFile: toStringArray(s.location.search.commitFile),
});

export const useCommitFileSelection = () => {
  const { commitFile } = useRouterState({ select: selectParams });
  const navigate = useNavigate();

  const entries = useMemo<readonly CommitFileEntry[]>(
    () => commitFile.map(decode).filter((e): e is CommitFileEntry => e != null),
    [commitFile],
  );

  const isSelected = useCallback(
    (sha: string, path: string) =>
      entries.some((entry) => entry.sha === sha && entry.path === path),
    [entries],
  );

  const toggle = useCallback(
    (sha: string, path: string) => {
      const key = encode({ sha, path });
      const next = commitFile.includes(key)
        ? commitFile.filter((v) => v !== key)
        : [...commitFile, key];
      void navigate({
        to: '/commits',
        search: (prev) => ({ ...prev, commitFile: next }),
        replace: true,
      });
    },
    [commitFile, navigate],
  );

  return { entries, isSelected, toggle };
};
