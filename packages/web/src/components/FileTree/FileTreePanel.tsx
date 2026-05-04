import type { CommitEntry } from '@greppa/core';
import { IconChevronRight, IconFileDiff, IconGitBranch, IconGitCommit } from '@tabler/icons-react';
import { motion } from 'motion/react';
import { useMemo, useRef } from 'react';

import type { CommitFileEntry } from '../../commitFileKey';
import type { ChangeType, FileNode } from '../../fixtures/types';
import type { ReviewedStatus } from '../../hooks/useFileFilter';
import { collectFiles } from '../../useFileSelection';
import { CommitList } from '../CommitList/CommitList';
import { FileFilterBar } from './FileFilterBar';
import { FileTree } from './FileTree';

import styles from './FileTreePanel.module.css';

interface CommittedFilter {
  query: string;
  isActive: boolean;
  setQuery: (query: string) => void;
  reset: () => void;
  visibleCount: number;
  totalCount: number;
  extensions: { extension: string; count: number }[];
  changeTypes: { type: ChangeType; count: number }[];
  statuses: { status: ReviewedStatus; count: number }[];
  selectedExtensions: ReadonlySet<string>;
  selectedChangeTypes: ReadonlySet<ChangeType>;
  selectedStatuses: ReadonlySet<ReviewedStatus>;
  onToggleExtension: (extension: string) => void;
  onToggleChangeType: (type: ChangeType) => void;
  onToggleStatus: (status: ReviewedStatus) => void;
}

export type FileTreeSection = 'committed' | 'worktree' | 'commits';

interface FileTreePanelProps {
  expandedSection: FileTreeSection;
  committedFiles: FileNode[];
  worktreeFiles: FileNode[];
  commits: CommitEntry[];
  selectedPaths: Set<string>;
  selectedSource: 'committed' | 'worktree' | null;
  selectedCommitShas: Set<string>;
  selectedCommitFiles?: ReadonlySet<string>;
  committedReviewedPaths?: ReadonlySet<string>;
  worktreeReviewedPaths?: ReadonlySet<string>;
  reviewedCommitFiles?: ReadonlySet<string>;
  committedExpandedKeys: Iterable<string>;
  worktreeExpandedKeys: Iterable<string>;
  committedFilter?: CommittedFilter;
  onToggleSection: (section: FileTreeSection) => void;
  onSelectCommittedFile: (path: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => void;
  onSelectWorktreeFile: (path: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => void;
  onSelectCommittedDirectory: (path: string) => void;
  onSelectWorktreeDirectory: (path: string) => void;
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
  onCommittedExpandedKeysChange: (keys: Set<string | number>) => void;
  onWorktreeExpandedKeysChange: (keys: Set<string | number>) => void;
  onCollapseCommittedDirectory?: (path: string) => void;
  onCollapseWorktreeDirectory?: (path: string) => void;
}

const EMPTY_SET = new Set<string>();

const sectionBodyVariants = {
  expanded: { height: 'auto' },
  collapsed: { height: 0 },
};

const chevronVariants = {
  expanded: { rotate: 90 },
  collapsed: { rotate: 0 },
};

const transition = { type: 'spring' as const, duration: 0.25, bounce: 0 };

const ICON_SIZE = 14;
const ICON_STROKE = 2;

export const FileTreePanel = ({
  expandedSection,
  committedFiles,
  worktreeFiles,
  commits,
  selectedPaths,
  selectedSource,
  selectedCommitShas,
  selectedCommitFiles,
  committedReviewedPaths,
  worktreeReviewedPaths,
  reviewedCommitFiles,
  committedExpandedKeys,
  worktreeExpandedKeys,
  committedFilter,
  onToggleSection,
  onSelectCommittedFile,
  onSelectWorktreeFile,
  onSelectCommittedDirectory,
  onSelectWorktreeDirectory,
  onSelectCommit,
  onSelectCommitFile,
  onSelectAllFilesInCommit,
  onCommittedExpandedKeysChange,
  onWorktreeExpandedKeysChange,
  onCollapseCommittedDirectory,
  onCollapseWorktreeDirectory,
}: FileTreePanelProps) => {
  const committedBodyRef = useRef<HTMLDivElement>(null);
  const worktreeBodyRef = useRef<HTMLDivElement>(null);
  const commitsBodyRef = useRef<HTMLDivElement>(null);

  const committedCount = useMemo(() => collectFiles(committedFiles).length, [committedFiles]);
  const worktreeCount = useMemo(() => collectFiles(worktreeFiles).length, [worktreeFiles]);

  const lockScroll = () => {
    for (const ref of [committedBodyRef, worktreeBodyRef, commitsBodyRef]) {
      if (ref.current) {
        ref.current.style.overflowY = 'hidden';
      }
    }
  };

  const handleToggle = (section: FileTreeSection) => {
    if (section === expandedSection) {
      return;
    }
    lockScroll();
    onToggleSection(section);
  };

  const handleExpandComplete = (section: FileTreeSection) => {
    if (section !== expandedSection) {
      return;
    }
    const refMap: Record<string, React.RefObject<HTMLDivElement | null>> = {
      committed: committedBodyRef,
      worktree: worktreeBodyRef,
      commits: commitsBodyRef,
    };
    const ref = refMap[section];
    if (ref?.current) {
      ref.current.style.overflowY = 'auto';
    }
  };

  return (
    <div className={styles.panel}>
      <div
        className={`${styles.section} ${expandedSection !== 'committed' ? styles.collapsed : ''}`}
      >
        <button
          type="button"
          className={styles.sectionHeader}
          aria-expanded={expandedSection === 'committed'}
          onClick={() => { handleToggle('committed'); }}
        >
          <motion.span
            className={styles.sectionChevron}
            variants={chevronVariants}
            animate={expandedSection === 'committed' ? 'expanded' : 'collapsed'}
            transition={transition}
          >
            <IconChevronRight size={12} stroke={2.5} />
          </motion.span>
          <span className={styles.sectionIcon}>
            <IconGitBranch size={ICON_SIZE} stroke={ICON_STROKE} />
          </span>
          <span className={styles.sectionTitle}>Changes</span>
          <span className={styles.sectionCount}>{committedCount}</span>
        </button>
        <motion.div
          ref={committedBodyRef}
          className={styles.sectionBody}
          variants={sectionBodyVariants}
          animate={expandedSection === 'committed' ? 'expanded' : 'collapsed'}
          initial={false}
          transition={transition}
          onAnimationComplete={() => { handleExpandComplete('committed'); }}
        >
          {committedFilter != null && (
            <FileFilterBar
              query={committedFilter.query}
              setQuery={committedFilter.setQuery}
              reset={committedFilter.reset}
              extensions={committedFilter.extensions}
              changeTypes={committedFilter.changeTypes}
              statuses={committedFilter.statuses}
              selectedExtensions={committedFilter.selectedExtensions}
              selectedChangeTypes={committedFilter.selectedChangeTypes}
              selectedStatuses={committedFilter.selectedStatuses}
              onToggleExtension={(extension) => { committedFilter.onToggleExtension(extension); }}
              onToggleChangeType={(type) => { committedFilter.onToggleChangeType(type); }}
              onToggleStatus={(status) => { committedFilter.onToggleStatus(status); }}
            />
          )}
          {committedFilter != null
          && committedFilter.isActive
          && committedFilter.visibleCount === 0 ? (
            <div className={styles.emptyFilter}>
              <p className={styles.emptyFilterText}>No files match.</p>
              <button
                type="button"
                className={styles.emptyFilterButton}
                onClick={() => { committedFilter.reset(); }}
              >
                Clear filter
              </button>
            </div>
          ) : (
            <FileTree
              files={committedFiles}
              selectedPaths={selectedSource === 'committed' ? selectedPaths : EMPTY_SET}
              expandedKeys={committedExpandedKeys}
              reviewedPaths={committedReviewedPaths}
              onSelectFile={onSelectCommittedFile}
              onSelectDirectory={onSelectCommittedDirectory}
              onExpandedKeysChange={onCommittedExpandedKeysChange}
              onCollapseDirectory={onCollapseCommittedDirectory}
            />
          )}
        </motion.div>
      </div>
      <div
        className={`${styles.section} ${expandedSection !== 'worktree' ? styles.collapsed : ''}`}
      >
        <button
          type="button"
          className={styles.sectionHeader}
          aria-expanded={expandedSection === 'worktree'}
          onClick={() => { handleToggle('worktree'); }}
        >
          <motion.span
            className={styles.sectionChevron}
            variants={chevronVariants}
            animate={expandedSection === 'worktree' ? 'expanded' : 'collapsed'}
            transition={transition}
          >
            <IconChevronRight size={12} stroke={2.5} />
          </motion.span>
          <span className={styles.sectionIcon}>
            <IconFileDiff size={ICON_SIZE} stroke={ICON_STROKE} />
          </span>
          <span className={styles.sectionTitle}>Working tree</span>
          <span className={styles.sectionCount}>{worktreeCount}</span>
        </button>
        <motion.div
          ref={worktreeBodyRef}
          className={styles.sectionBody}
          variants={sectionBodyVariants}
          animate={expandedSection === 'worktree' ? 'expanded' : 'collapsed'}
          initial={false}
          transition={transition}
          onAnimationComplete={() => { handleExpandComplete('worktree'); }}
        >
          <FileTree
            files={worktreeFiles}
            selectedPaths={selectedSource === 'worktree' ? selectedPaths : EMPTY_SET}
            expandedKeys={worktreeExpandedKeys}
            reviewedPaths={worktreeReviewedPaths}
            onSelectFile={onSelectWorktreeFile}
            onSelectDirectory={onSelectWorktreeDirectory}
            onExpandedKeysChange={onWorktreeExpandedKeysChange}
            onCollapseDirectory={onCollapseWorktreeDirectory}
          />
        </motion.div>
      </div>
      <div
        className={`${styles.section} ${expandedSection !== 'commits' ? styles.collapsed : ''}`}
      >
        <button
          type="button"
          className={styles.sectionHeader}
          aria-expanded={expandedSection === 'commits'}
          onClick={() => { handleToggle('commits'); }}
        >
          <motion.span
            className={styles.sectionChevron}
            variants={chevronVariants}
            animate={expandedSection === 'commits' ? 'expanded' : 'collapsed'}
            transition={transition}
          >
            <IconChevronRight size={12} stroke={2.5} />
          </motion.span>
          <span className={styles.sectionIcon}>
            <IconGitCommit size={ICON_SIZE} stroke={ICON_STROKE} />
          </span>
          <span className={styles.sectionTitle}>Commits</span>
          <span className={styles.sectionCount}>{commits.length}</span>
        </button>
        <motion.div
          ref={commitsBodyRef}
          className={styles.sectionBody}
          variants={sectionBodyVariants}
          animate={expandedSection === 'commits' ? 'expanded' : 'collapsed'}
          initial={false}
          transition={transition}
          onAnimationComplete={() => { handleExpandComplete('commits'); }}
        >
          <CommitList
            commits={commits}
            selectedShas={selectedCommitShas}
            selectedCommitFiles={selectedCommitFiles}
            reviewedCommitFiles={reviewedCommitFiles}
            onSelectCommit={onSelectCommit}
            onSelectCommitFile={onSelectCommitFile}
            onSelectAllFilesInCommit={onSelectAllFilesInCommit}
          />
        </motion.div>
      </div>
    </div>
  );
};
