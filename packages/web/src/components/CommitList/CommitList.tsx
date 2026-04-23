import { FileIcon, Tree } from '@greppa/ui';
import { useMemo, useRef, useState } from 'react';
import type { CommitEntry } from '@greppa/core';

import type { CommitFileEntry } from '../../commitFileKey';
import { decodeCommitFileKey, encodeCommitFileKey } from '../../commitFileKey';
import { formatRelativeTime } from '../../formatRelativeTime';
import styles from './CommitList.module.css';

interface CommitListProps {
  commits: CommitEntry[];
  selectedShas: Set<string>;
  selectedCommitFiles?: ReadonlySet<string>;
  onSelectCommit: (sha: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => void;
  onSelectCommitFile?: (
    sha: string,
    path: string,
    orderedFileEntries: readonly CommitFileEntry[],
    modifiers: { shiftKey: boolean; metaKey: boolean },
  ) => void;
  onSelectAllFilesInCommit?: (
    sha: string,
    filesInCommit: readonly string[],
    modifiers: { shiftKey: boolean; metaKey: boolean },
  ) => void;
}

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
        const decoded = decodeCommitFileKey(key);
        if (decoded != null) {
          const paths = filesPerSha.get(decoded.sha) ?? new Set<string>();
          paths.add(decoded.path);
          filesPerSha.set(decoded.sha, paths);
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

      if (!isSelected) {
        continue;
      }

      if (expandedKeys.has(commit.sha)) {
        // Expanded commit rows are never highlighted; highlight all files
        // under the commit instead.
        for (const path of commit.files) {
          result.add(encodeCommitFileKey({ sha: commit.sha, path }));
        }
      } else {
        result.add(commit.sha);
      }
    }

    return result;
  }, [commits, selectedShas, selectedCommitFiles, expandedKeys]);

  const commitsRef = useRef(commits);
  commitsRef.current = commits;

  const fileChildrenByCommit = useMemo(() => {
    const map = new Map<string, { id: string; path: string }[]>();
    for (const commit of commits) {
      map.set(
        commit.sha,
        commit.files.map((path) => ({ id: encodeCommitFileKey({ sha: commit.sha, path }), path })),
      );
    }
    return map;
  }, [commits]);

  // All commit files, ordered by commit then by file — shift-range slices this
  // list, so collapsed commits between the endpoints still contribute their
  // files to the selection.
  const orderedFileEntries = useMemo<CommitFileEntry[]>(() => {
    const entries: CommitFileEntry[] = [];
    for (const c of commits) {
      for (const p of c.files) {
        entries.push({ sha: c.sha, path: p });
      }
    }
    return entries;
  }, [commits]);

  // Pointer handlers invoke onPointerDown (with modifier support) and RAC then
  // fires onSelectionChange for the same interaction. We want onSelectionChange
  // only for keyboard-driven selection, so ignore it briefly after any pointer.
  const pointerTimestampRef = useRef(0);
  const POINTER_SUPPRESS_WINDOW_MS = 100;

  return (
    <Tree.Root
      aria-label="Commits"
      selectionMode="multiple"
      selectedKeys={selectedKeys}
      expandedKeys={expandedKeys}
      onExpandedChange={setExpandedKeys}
      onSelectionChange={(keys) => {
        if (performance.now() - pointerTimestampRef.current < POINTER_SUPPRESS_WINDOW_MS) {
          return;
        }
        const nextKeys = keys === 'all' ? new Set<string>() : new Set<string>([...keys].map(String));
        let toggled: string | null = null;
        for (const k of nextKeys) {
          if (!selectedKeys.has(k)) {
            toggled = k;
            break;
          }
        }
        if (toggled == null) {
          for (const k of selectedKeys) {
            if (!nextKeys.has(k)) {
              toggled = k;
              break;
            }
          }
        }
        if (toggled == null) {
          return;
        }
        const modifiers = { shiftKey: false, metaKey: false };
        const decoded = decodeCommitFileKey(toggled);
        if (decoded != null) {
          onSelectCommitFile?.(decoded.sha, decoded.path, orderedFileEntries, modifiers);
          return;
        }
        const isExpanded = expandedKeysRef.current.has(toggled);
        if (isExpanded && onSelectAllFilesInCommit != null) {
          const commit = commitsRef.current.find((c) => c.sha === toggled);
          if (commit != null) {
            onSelectAllFilesInCommit(toggled, commit.files, modifiers);
            return;
          }
        }
        onSelectCommit(toggled, modifiers);
      }}
    >
      <Tree.Collection items={commits}>
        {(commit: CommitEntry) => (
          <Tree.Item
            key={commit.sha}
            id={commit.sha}
            textValue={commit.subject}
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              const target = event.target;
              if (target instanceof Element && target.closest('[slot="chevron"]') != null) {
                return;
              }
              pointerTimestampRef.current = performance.now();
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
            <Tree.Collection items={fileChildrenByCommit.get(commit.sha) ?? []}>
              {(child: { id: string; path: string }) => (
                <Tree.Item
                  key={child.id}
                  id={child.id}
                  textValue={child.path}
                  onPointerDown={(event) => {
                    if (event.button !== 0) {
                      return;
                    }
                    event.stopPropagation();
                    pointerTimestampRef.current = performance.now();
                    onSelectCommitFile?.(commit.sha, child.path, orderedFileEntries, {
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
