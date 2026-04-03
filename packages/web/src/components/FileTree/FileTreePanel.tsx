import { IconFileDiff, IconGitBranch } from '@tabler/icons-react';
import { useState } from 'react';

import type { FileNode } from '../../fixtures/types';
import { collectFiles } from '../../useFileSelection';
import { FileTree } from './FileTree';

import styles from './FileTreePanel.module.css';

interface FileTreePanelProps {
  committedFiles: FileNode[];
  worktreeFiles: FileNode[];
  selectedFilePath: string | null;
  selectedSource: 'committed' | 'worktree' | null;
  committedExpandedKeys: Iterable<string>;
  worktreeExpandedKeys: Iterable<string>;
  onSelectCommittedFile: (path: string) => void;
  onSelectWorktreeFile: (path: string) => void;
  onCommittedExpandedKeysChange: (keys: Set<string | number>) => void;
  onWorktreeExpandedKeysChange: (keys: Set<string | number>) => void;
}

const ICON_SIZE = 14;
const ICON_STROKE = 2;

export const FileTreePanel = ({
  committedFiles,
  worktreeFiles,
  selectedFilePath,
  selectedSource,
  committedExpandedKeys,
  worktreeExpandedKeys,
  onSelectCommittedFile,
  onSelectWorktreeFile,
  onCommittedExpandedKeysChange,
  onWorktreeExpandedKeysChange,
}: FileTreePanelProps) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const hasCommitted = committedFiles.length > 0;
  const hasWorktree = worktreeFiles.length > 0;

  const committedCount = collectFiles(committedFiles).length;
  const worktreeCount = collectFiles(worktreeFiles).length;

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <div className={styles.panel}>
      {hasCommitted && (
        <div
          className={`${styles.section} ${collapsedSections.has('committed') ? styles.collapsed : ''}`}
        >
          <div
            className={styles.sectionHeader}
            role="button"
            onClick={() =>{  toggleSection('committed'); }}
          >
            <span className={styles.sectionChevron}>&#x25B6;</span>
            <span className={styles.sectionIcon}>
              <IconGitBranch size={ICON_SIZE} stroke={ICON_STROKE} />
            </span>
            <span className={styles.sectionTitle}>Changes</span>
            <span className={styles.sectionCount}>{committedCount}</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.sectionBodyInner}>
              <FileTree
                files={committedFiles}
                selectedFilePath={selectedSource === 'committed' ? selectedFilePath : null}
                expandedKeys={committedExpandedKeys}
                onSelectFile={onSelectCommittedFile}
                onExpandedKeysChange={onCommittedExpandedKeysChange}
              />
            </div>
          </div>
        </div>
      )}
      {hasWorktree && (
        <div
          className={`${styles.section} ${collapsedSections.has('worktree') ? styles.collapsed : ''}`}
        >
          <div
            className={styles.sectionHeader}
            role="button"
            onClick={() =>{  toggleSection('worktree'); }}
          >
            <span className={styles.sectionChevron}>&#x25B6;</span>
            <span className={styles.sectionIcon}>
              <IconFileDiff size={ICON_SIZE} stroke={ICON_STROKE} />
            </span>
            <span className={styles.sectionTitle}>Working tree</span>
            <span className={styles.sectionCount}>{worktreeCount}</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.sectionBodyInner}>
              <FileTree
                files={worktreeFiles}
                selectedFilePath={selectedSource === 'worktree' ? selectedFilePath : null}
                expandedKeys={worktreeExpandedKeys}
                onSelectFile={onSelectWorktreeFile}
                onExpandedKeysChange={onWorktreeExpandedKeysChange}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
