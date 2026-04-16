import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import { getOrCreateStateId } from '../stateCache';
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
  file: toStringArray(s.location.search.file),
  wt: toStringArray(s.location.search.wt),
  commits: toStringArray(s.location.search.commits),
  commitFile: toStringArray(s.location.search.commitFile),
});

export const useCommitFileSelection = () => {
  const { file, wt, commits, commitFile } = useRouterState({ select: selectParams });
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
      if (file.length === 0 && wt.length === 0 && commits.length === 0) {
        void navigate({
          to: '/commits',
          search: { s: '', commits: [], commitFile: next },
          replace: true,
        });
        return;
      }
      const id = getOrCreateStateId({ file, wt, commits, commitFile: next });
      void navigate({
        to: '/commits',
        search: { s: id, commits, commitFile: next },
        replace: true,
      });
    },
    [file, wt, commits, commitFile, navigate],
  );

  return { entries, isSelected, toggle };
};
