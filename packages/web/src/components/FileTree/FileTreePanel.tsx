import type { CommitEntry } from '@greppa/core';
import { IconChevronRight, IconFileDiff, IconGitBranch, IconGitCommit } from '@tabler/icons-react';
import { motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';

import type { FileNode } from '../../fixtures/types';
import { collectFiles } from '../../useFileSelection';
import { CommitList } from '../CommitList/CommitList';
import { FileTree } from './FileTree';

import styles from './FileTreePanel.module.css';

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

interface FileTreePanelProps {
  committedFiles: FileNode[];
  worktreeFiles: FileNode[];
  commits: CommitEntry[];
  selectedPaths: Set<string>;
  selectedSource: 'committed' | 'worktree' | null;
  selectedCommitShas: Set<string>;
  committedExpandedKeys: Iterable<string>;
  worktreeExpandedKeys: Iterable<string>;
  onSelectCommittedFile: (path: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => void;
  onSelectWorktreeFile: (path: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => void;
  onSelectCommittedDirectory: (path: string) => void;
  onSelectWorktreeDirectory: (path: string) => void;
  onSelectCommit: (sha: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => void;
  onCommittedExpandedKeysChange: (keys: Set<string | number>) => void;
  onWorktreeExpandedKeysChange: (keys: Set<string | number>) => void;
}

const ICON_SIZE = 14;
const ICON_STROKE = 2;

export const FileTreePanel = ({
  committedFiles,
  worktreeFiles,
  commits,
  selectedPaths,
  selectedSource,
  selectedCommitShas,
  committedExpandedKeys,
  worktreeExpandedKeys,
  onSelectCommittedFile,
  onSelectWorktreeFile,
  onSelectCommittedDirectory,
  onSelectWorktreeDirectory,
  onSelectCommit,
  onCommittedExpandedKeysChange,
  onWorktreeExpandedKeysChange,
}: FileTreePanelProps) => {
  const hasCommitted = committedFiles.length > 0;
  const hasWorktree = worktreeFiles.length > 0;
  const hasCommits = commits.length > 0;

  const defaultSection = hasCommitted ? 'committed' : 'worktree';
  const [expandedSection, setExpandedSection] = useState<string>(defaultSection);

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

  const toggleSection = (section: string) => {
    if (section === expandedSection) {
      return;
    }
    lockScroll();
    setExpandedSection(section);
  };

  const handleExpandComplete = (section: string) => {
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
      {hasCommitted && (
        <div
          className={`${styles.section} ${expandedSection !== 'committed' ? styles.collapsed : ''}`}
        >
          <button
            type="button"
            className={styles.sectionHeader}
            aria-expanded={expandedSection === 'committed'}
            onClick={() => { toggleSection('committed'); }}
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
            <FileTree
              files={committedFiles}
              selectedPaths={selectedSource === 'committed' ? selectedPaths : EMPTY_SET}
              expandedKeys={committedExpandedKeys}
              onSelectFile={onSelectCommittedFile}
              onSelectDirectory={onSelectCommittedDirectory}
              onExpandedKeysChange={onCommittedExpandedKeysChange}
            />
          </motion.div>
        </div>
      )}
      {hasWorktree && (
        <div
          className={`${styles.section} ${expandedSection !== 'worktree' ? styles.collapsed : ''}`}
        >
          <button
            type="button"
            className={styles.sectionHeader}
            aria-expanded={expandedSection === 'worktree'}
            onClick={() => { toggleSection('worktree'); }}
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
              onSelectFile={onSelectWorktreeFile}
              onSelectDirectory={onSelectWorktreeDirectory}
              onExpandedKeysChange={onWorktreeExpandedKeysChange}
            />
          </motion.div>
        </div>
      )}
      {hasCommits && (
        <div
          className={`${styles.section} ${expandedSection !== 'commits' ? styles.collapsed : ''}`}
        >
          <button
            type="button"
            className={styles.sectionHeader}
            aria-expanded={expandedSection === 'commits'}
            onClick={() => { toggleSection('commits'); }}
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
              onSelectCommit={onSelectCommit}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
};
