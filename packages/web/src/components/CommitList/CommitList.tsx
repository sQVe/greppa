import { FileIcon, Tree } from '@greppa/ui';
import { useMemo, useRef, useState } from 'react';
import type { CommitEntry } from '@greppa/core';

import styles from './CommitList.module.css';

interface CommitListProps {
  commits: CommitEntry[];
  selectedShas: Set<string>;
  selectedCommitFiles?: ReadonlySet<string>;
  onSelectCommit: (sha: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => void;
  onSelectCommitFile?: (
    sha: string,
    path: string,
    orderedFileEntries: readonly { sha: string; path: string }[],
    modifiers: { shiftKey: boolean; metaKey: boolean },
  ) => void;
  onSelectAllFilesInCommit?: (
    sha: string,
    filesInCommit: readonly string[],
    modifiers: { shiftKey: boolean; metaKey: boolean },
  ) => void;
}

const formatRelativeTime = (iso: string): string => {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  const years = Math.floor(days / 365);
  return `${years}y`;
};

export const CommitList = ({
  commits,
  selectedShas,
  selectedCommitFiles,
  onSelectCommit,
  onSelectCommitFile,
  onSelectAllFilesInCommit,
}: CommitListProps) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string | number>>(new Set());
  const expandedKeysRef = useRef(expandedKeys);
  expandedKeysRef.current = expandedKeys;

  const selectedKeys = useMemo(() => {
    const result = new Set<string>();

    const filesPerSha = new Map<string, Set<string>>();
    if (selectedCommitFiles != null) {
      for (const key of selectedCommitFiles) {
        result.add(key);
        const idx = key.indexOf(':');
        if (idx > 0) {
          const sha = key.slice(0, idx);
          const path = key.slice(idx + 1);
          const paths = filesPerSha.get(sha) ?? new Set<string>();
          paths.add(path);
          filesPerSha.set(sha, paths);
        }
      }
    }

    const hasFileSelection = (selectedCommitFiles?.size ?? 0) > 0;

    for (const commit of commits) {
      const selectedFiles = filesPerSha.get(commit.sha);
      const allFilesSelected =
        selectedFiles != null &&
        commit.files.length > 0 &&
        commit.files.every((path) => selectedFiles.has(path));

      // A commit is implicitly selected when every file under it is selected,
      // or when it sits in selectedShas with no file-level selection active
      // anywhere to demote it.
      const isSelected =
        allFilesSelected || (selectedShas.has(commit.sha) && !hasFileSelection);

      if (!isSelected) continue;

      if (expandedKeys.has(commit.sha)) {
        // Expanded commit rows are never highlighted; highlight all files
        // under the commit instead.
        for (const path of commit.files) {
          result.add(`${commit.sha}:${path}`);
        }
      } else {
        result.add(commit.sha);
      }
    }

    return result;
  }, [commits, selectedShas, selectedCommitFiles, expandedKeys]);

  const commitsRef = useRef(commits);
  commitsRef.current = commits;

  // All commit files, ordered by commit then by file — shift-range slices this
  // list, so collapsed commits between the endpoints still contribute their
  // files to the selection.
  const computeOrderedFileEntries = (): { sha: string; path: string }[] => {
    const entries: { sha: string; path: string }[] = [];
    for (const c of commitsRef.current) {
      for (const p of c.files) {
        entries.push({ sha: c.sha, path: p });
      }
    }
    return entries;
  };

  return (
    <Tree.Root
      aria-label="Commits"
      selectionMode="multiple"
      selectedKeys={selectedKeys}
      expandedKeys={expandedKeys}
      onExpandedChange={setExpandedKeys}
      onSelectionChange={() => { /* managed via onPointerDown */ }}
    >
      <Tree.Collection items={commits}>
        {(commit: CommitEntry) => (
          <Tree.Item
            key={commit.sha}
            id={commit.sha}
            textValue={commit.subject}
            onPointerDown={(event) => {
              const target = event.target;
              if (target instanceof Element && target.closest('[slot="chevron"]') != null) {
                return;
              }
              const modifiers = {
                shiftKey: event.shiftKey,
                metaKey: event.metaKey || event.ctrlKey,
              };
              const isExpanded = expandedKeysRef.current.has(commit.sha);
              if (isExpanded && onSelectAllFilesInCommit != null) {
                onSelectAllFilesInCommit(commit.sha, commit.files, modifiers);
                return;
              }
              onSelectCommit(commit.sha, modifiers);
            }}
          >
            <Tree.ItemContent>
              <Tree.Chevron />
              <span className={styles.subject}>{commit.subject}</span>
              <span className={styles.meta}>{formatRelativeTime(commit.date)}</span>
            </Tree.ItemContent>
            <Tree.Collection items={commit.files.map((path) => ({ id: `${commit.sha}:${path}`, path }))}>
              {(child: { id: string; path: string }) => (
                <Tree.Item
                  key={child.id}
                  id={child.id}
                  textValue={child.path}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelectCommitFile?.(commit.sha, child.path, computeOrderedFileEntries(), {
                      shiftKey: event.shiftKey,
                      metaKey: event.metaKey || event.ctrlKey,
                    });
                  }}
                >
                  <Tree.ItemContent>
                    <Tree.Indent />
                    <FileIcon
                      name={child.path.split('/').pop() ?? child.path}
                      baseUrl="/material-icons"
                    />
                    <Tree.Label>{child.path}</Tree.Label>
                  </Tree.ItemContent>
                </Tree.Item>
              )}
            </Tree.Collection>
          </Tree.Item>
        )}
      </Tree.Collection>
    </Tree.Root>
  );
};
