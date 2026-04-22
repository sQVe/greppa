import { Tree } from '@greppa/ui';
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
    filesInCommit: readonly string[],
    modifiers: { shiftKey: boolean; metaKey: boolean },
  ) => void;
  onSelectAllFilesInCommit?: (
    sha: string,
    filesInCommit: readonly string[],
    modifiers: { shiftKey: boolean; metaKey: boolean },
  ) => void;
}

const formatRelativeTime = (iso: string): string => {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
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
              <span className={styles.meta}>
                <span className={styles.hash}>{commit.abbrevSha}</span>
                <span className={styles.time}>{formatRelativeTime(commit.date)}</span>
              </span>
            </Tree.ItemContent>
            <Tree.Collection items={commit.files.map((path) => ({ id: `${commit.sha}:${path}`, path }))}>
              {(child: { id: string; path: string }) => (
                <Tree.Item
                  key={child.id}
                  id={child.id}
                  textValue={child.path}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelectCommitFile?.(commit.sha, child.path, commit.files, {
                      shiftKey: event.shiftKey,
                      metaKey: event.metaKey || event.ctrlKey,
                    });
                  }}
                >
                  <Tree.ItemContent>
                    <Tree.Indent />
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
