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
    const shasWithFileSelection = new Set<string>();
    if (selectedCommitFiles != null) {
      for (const key of selectedCommitFiles) {
        const idx = key.indexOf(':');
        if (idx > 0) {
          shasWithFileSelection.add(key.slice(0, idx));
        }
      }
    }
    const visibleShas = [...selectedShas].filter((s) => !shasWithFileSelection.has(s));
    return new Set<string>([...visibleShas, ...(selectedCommitFiles ?? [])]);
  }, [selectedShas, selectedCommitFiles]);

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
              const hasModifier = event.shiftKey || event.metaKey || event.ctrlKey;
              const isExpanded = expandedKeysRef.current.has(commit.sha);
              if (isExpanded && hasModifier && onSelectAllFilesInCommit != null) {
                onSelectAllFilesInCommit(commit.sha, commit.files, {
                  shiftKey: event.shiftKey,
                  metaKey: event.metaKey || event.ctrlKey,
                });
                return;
              }
              onSelectCommit(commit.sha, {
                shiftKey: event.shiftKey,
                metaKey: event.metaKey || event.ctrlKey,
              });
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
