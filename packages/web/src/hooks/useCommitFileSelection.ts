import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useMemo, useRef } from 'react';

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

  const stateRef = useRef({ file, wt, commits, commitFile });
  stateRef.current = { file, wt, commits, commitFile };

  const anchorRef = useRef<CommitFileEntry | null>(null);

  const entries = useMemo<readonly CommitFileEntry[]>(
    () => commitFile.map(decode).filter((e): e is CommitFileEntry => e != null),
    [commitFile],
  );

  const isSelected = useCallback(
    (sha: string, path: string) =>
      entries.some((entry) => entry.sha === sha && entry.path === path),
    [entries],
  );

  const writeCommitFile = useCallback(
    (next: string[]) => {
      const current = stateRef.current;
      if (current.file.length === 0 && current.wt.length === 0 && current.commits.length === 0) {
        void navigate({
          to: '/commits',
          search: { s: '', commits: [], commitFile: next },
          replace: true,
        });
        return;
      }
      const id = getOrCreateStateId({
        file: current.file,
        wt: current.wt,
        commits: current.commits,
        commitFile: next,
      });
      void navigate({
        to: '/commits',
        search: { s: id, commits: current.commits, commitFile: next },
        replace: true,
      });
    },
    [navigate],
  );

  const toggle = useCallback(
    (sha: string, path: string) => {
      const current = stateRef.current;
      const key = encode({ sha, path });
      const next = current.commitFile.includes(key)
        ? current.commitFile.filter((v) => v !== key)
        : [...current.commitFile, key];
      writeCommitFile(next);
    },
    [writeCommitFile],
  );

  const selectCommitFile = useCallback(
    (
      sha: string,
      path: string,
      orderedFileEntries: readonly CommitFileEntry[],
      modifiers: { shiftKey: boolean; metaKey: boolean },
    ) => {
      if (modifiers.metaKey) {
        anchorRef.current = { sha, path };
        toggle(sha, path);
        return;
      }

      if (modifiers.shiftKey) {
        const anchor = anchorRef.current;
        const targetIndex = orderedFileEntries.findIndex(
          (e) => e.sha === sha && e.path === path,
        );
        const anchorIndex =
          anchor != null
            ? orderedFileEntries.findIndex(
                (e) => e.sha === anchor.sha && e.path === anchor.path,
              )
            : -1;
        if (anchorIndex === -1 || targetIndex === -1) {
          anchorRef.current = { sha, path };
          writeCommitFile([encode({ sha, path })]);
          return;
        }
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        const rangeKeys = orderedFileEntries
          .slice(start, end + 1)
          .map((e) => encode(e));
        writeCommitFile(rangeKeys);
        return;
      }

      anchorRef.current = { sha, path };
      writeCommitFile([encode({ sha, path })]);
    },
    [toggle, writeCommitFile],
  );

  const selectAllFilesInCommit = useCallback(
    (
      sha: string,
      filesInCommit: readonly string[],
      modifiers: { shiftKey: boolean; metaKey: boolean },
    ) => {
      if (filesInCommit.length === 0) {
        return;
      }
      const current = stateRef.current;
      const commitKeys = filesInCommit.map((p) => encode({ sha, path: p }));
      const last = filesInCommit.at(-1);
      if (last != null) {
        anchorRef.current = { sha, path: last };
      }

      if (modifiers.metaKey || modifiers.shiftKey) {
        const merged = [...current.commitFile];
        const existing = new Set(merged);
        for (const key of commitKeys) {
          if (!existing.has(key)) {
            merged.push(key);
            existing.add(key);
          }
        }
        writeCommitFile(merged);
        return;
      }
      writeCommitFile(commitKeys);
    },
    [writeCommitFile],
  );

  return { entries, isSelected, toggle, selectCommitFile, selectAllFilesInCommit };
};
