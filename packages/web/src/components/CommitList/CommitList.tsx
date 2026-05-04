import { FileIcon, Tree } from '@greppa/ui';
import { IconCheck } from '@tabler/icons-react';
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
  reviewedCommitFiles?: ReadonlySet<string>;
  visibleFilesBySha?: ReadonlyMap<string, readonly string[]>;
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
  reviewedCommitFiles,
  visibleFilesBySha,
  onSelectCommit,
  onSelectCommitFile,
  onSelectAllFilesInCommit,
}: CommitListProps) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string | number>>(new Set());
  const expandedKeysRef = useRef(expandedKeys);
  expandedKeysRef.current = expandedKeys;

  const visibleByCommit = useMemo<Map<string, readonly string[]>>(() => {
    const map = new Map<string, readonly string[]>();
    for (const commit of commits) {
      map.set(commit.sha, visibleFilesBySha?.get(commit.sha) ?? commit.files);
    }
    return map;
  }, [commits, visibleFilesBySha]);

  const visibleByCommitRef = useRef(visibleByCommit);
  visibleByCommitRef.current = visibleByCommit;

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
      const visible = visibleByCommit.get(commit.sha) ?? commit.files;
      const selectedFiles = filesPerSha.get(commit.sha);
      const allFilesSelected =
        selectedFiles != null &&
        visible.length > 0 &&
        visible.every((path) => selectedFiles.has(path));

      // A commit is implicitly selected when every visible file under it is
      // selected, or when it sits in selectedShas with no file-level selection
      // active anywhere to demote it.
      const isSelected =
        allFilesSelected || (selectedShas.has(commit.sha) && !hasFileSelection);

      if (!isSelected) {
        continue;
      }

      if (expandedKeys.has(commit.sha) && visible.length > 0) {
        // Expanded commit rows are never highlighted; highlight all visible
        // files under the commit instead.
        for (const path of visible) {
          result.add(encodeCommitFileKey({ sha: commit.sha, path }));
        }
      } else {
        result.add(commit.sha);
      }
    }

    return result;
  }, [commits, selectedShas, selectedCommitFiles, expandedKeys, visibleByCommit]);

  const commitsRef = useRef(commits);
  commitsRef.current = commits;

  const filesForSelectAll = (sha: string, fallback: readonly string[]): readonly string[] =>
    visibleByCommitRef.current.get(sha) ?? fallback;

  const fileChildrenByCommit = useMemo(() => {
    const map = new Map<string, { id: string; path: string }[]>();
    for (const commit of commits) {
      const visible = visibleByCommit.get(commit.sha) ?? commit.files;
      map.set(
        commit.sha,
        visible.map((path) => ({ id: encodeCommitFileKey({ sha: commit.sha, path }), path })),
      );
    }
    return map;
  }, [commits, visibleByCommit]);

  // All visible commit files, ordered by commit then by file — shift-range
  // slices this list over the filtered visible set.
  const orderedFileEntries = useMemo<CommitFileEntry[]>(() => {
    const entries: CommitFileEntry[] = [];
    for (const c of commits) {
      const visible = visibleByCommit.get(c.sha) ?? c.files;
      for (const p of visible) {
        entries.push({ sha: c.sha, path: p });
      }
    }
    return entries;
  }, [commits, visibleByCommit]);

  // Pointer handlers invoke onPointerDown (with modifier support) and RAC then
  // fires onSelectionChange for the same interaction. We want onSelectionChange
  // only for keyboard-driven selection, so suppress the next one after a pointer.
  const suppressNextSelectionChangeRef = useRef(false);
  const armSelectionChangeSuppression = () => {
    suppressNextSelectionChangeRef.current = true;
    queueMicrotask(() => {
      suppressNextSelectionChangeRef.current = false;
    });
  };

  return (
    <Tree.Root
      aria-label="Commits"
      selectionMode="multiple"
      selectedKeys={selectedKeys}
      expandedKeys={expandedKeys}
      onExpandedChange={setExpandedKeys}
      onSelectionChange={(keys) => {
        if (suppressNextSelectionChangeRef.current) {
          suppressNextSelectionChangeRef.current = false;
          return;
        }
        if (keys === 'all') {
          return;
        }
        const nextKeys = new Set<string>([...keys].map(String));
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
            onSelectAllFilesInCommit(toggled, filesForSelectAll(toggled, commit.files), modifiers);
            return;
          }
        }
        onSelectCommit(toggled, modifiers);
      }}
    >
      <Tree.Collection items={commits}>
        {(commit: CommitEntry) => {
          const visibleCount = visibleFilesBySha?.get(commit.sha)?.length ?? commit.files.length;
          const isFiltered = visibleFilesBySha != null;
          const isDimmed = isFiltered && visibleCount === 0;
          return (
          <Tree.Item
            key={commit.sha}
            id={commit.sha}
            textValue={commit.subject}
            data-dimmed={isDimmed ? 'true' : undefined}
            className={isDimmed ? styles.dimmedCommit : undefined}
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              const target = event.target;
              if (target instanceof Element && target.closest('[slot="chevron"]') != null) {
                return;
              }
              armSelectionChangeSuppression();
              const modifiers = {
                shiftKey: event.shiftKey,
                metaKey: event.metaKey || event.ctrlKey,
              };
              const isExpanded = expandedKeysRef.current.has(commit.sha);
              if (isExpanded && onSelectAllFilesInCommit != null) {
                onSelectAllFilesInCommit(
                  commit.sha,
                  filesForSelectAll(commit.sha, commit.files),
                  modifiers,
                );
                return;
              }
              onSelectCommit(commit.sha, modifiers);
            }}
          >
            <Tree.ItemContent>
              <Tree.Chevron />
              <span className={styles.subject}>{commit.subject}</span>
              {isFiltered && (
                <span className={styles.matchAnnotation}>
                  ({visibleCount} / {commit.files.length} matching)
                </span>
              )}
              <span className={styles.meta}>{formatRelativeTime(commit.date)}</span>
            </Tree.ItemContent>
            <Tree.Collection items={fileChildrenByCommit.get(commit.sha) ?? []}>
              {(child: { id: string; path: string }) => {
                const isReviewed = reviewedCommitFiles?.has(child.id) ?? false;
                return (
                  <Tree.Item
                    key={child.id}
                    id={child.id}
                    textValue={child.path}
                    data-reviewed={isReviewed ? 'true' : undefined}
                    className={isReviewed ? styles.reviewedFile : undefined}
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }
                      event.stopPropagation();
                      armSelectionChangeSuppression();
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
                      {isReviewed ? (
                        <span className={styles.reviewedCheck} aria-label="Reviewed">
                          <IconCheck size={12} stroke={2.5} />
                        </span>
                      ) : null}
                    </Tree.ItemContent>
                  </Tree.Item>
                );
              }}
            </Tree.Collection>
          </Tree.Item>
          );
        }}
      </Tree.Collection>
    </Tree.Root>
  );
};
