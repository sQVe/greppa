import { IconChevronRight, IconFileDiff, IconGitBranch } from '@tabler/icons-react';
import { motion } from 'motion/react';
import { useRef, useState } from 'react';

import type { FileNode } from '../../fixtures/types';
import { collectFiles } from '../../useFileSelection';
import { FileTree } from './FileTree';

import styles from './FileTreePanel.module.css';

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
  selectedPaths: Set<string>;
  selectedSource: 'committed' | 'worktree' | null;
  committedExpandedKeys: Iterable<string>;
  worktreeExpandedKeys: Iterable<string>;
  onSelectCommittedFile: (path: string, shiftKey: boolean) => void;
  onSelectWorktreeFile: (path: string, shiftKey: boolean) => void;
  onSelectAllCommitted: () => void;
  onSelectAllWorktree: () => void;
  onSelectCommittedDirectory: (path: string) => void;
  onSelectWorktreeDirectory: (path: string) => void;
  onCommittedExpandedKeysChange: (keys: Set<string | number>) => void;
  onWorktreeExpandedKeysChange: (keys: Set<string | number>) => void;
}

const ICON_SIZE = 14;
const ICON_STROKE = 2;

export const FileTreePanel = ({
  committedFiles,
  worktreeFiles,
  selectedPaths,
  selectedSource,
  committedExpandedKeys,
  worktreeExpandedKeys,
  onSelectCommittedFile,
  onSelectWorktreeFile,
  onSelectAllCommitted,
  onSelectAllWorktree,
  onSelectCommittedDirectory,
  onSelectWorktreeDirectory,
  onCommittedExpandedKeysChange,
  onWorktreeExpandedKeysChange,
}: FileTreePanelProps) => {
  const hasCommitted = committedFiles.length > 0;
  const hasWorktree = worktreeFiles.length > 0;

  const defaultSection = hasCommitted ? 'committed' : 'worktree';
  const [expandedSection, setExpandedSection] = useState<string>(defaultSection);

  const committedBodyRef = useRef<HTMLDivElement>(null);
  const worktreeBodyRef = useRef<HTMLDivElement>(null);

  const committedCount = collectFiles(committedFiles).length;
  const worktreeCount = collectFiles(worktreeFiles).length;

  const lockScroll = () => {
    if (committedBodyRef.current) {
      committedBodyRef.current.style.overflowY = 'hidden';
    }
    if (worktreeBodyRef.current) {
      worktreeBodyRef.current.style.overflowY = 'hidden';
    }
  };

  const toggleSection = (section: string) => {
    lockScroll();
    setExpandedSection(section);
  };

  const handleExpandComplete = (section: string) => {
    if (section !== expandedSection) {
      return;
    }
    const ref = section === 'committed' ? committedBodyRef : worktreeBodyRef;
    if (ref.current) {
      ref.current.style.overflowY = 'auto';
    }
  };

  return (
    <div className={styles.panel}>
      {hasCommitted && (
        <div
          className={`${styles.section} ${expandedSection !== 'committed' ? styles.collapsed : ''}`}
        >
          <div
            className={styles.sectionHeader}
            role="button"
            onClick={() => {
              if (expandedSection === 'committed') {
                onSelectAllCommitted();
              } else {
                toggleSection('committed');
              }
            }}
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
          </div>
          <motion.div
            ref={committedBodyRef}
            className={styles.sectionBody}
            variants={sectionBodyVariants}
            animate={expandedSection === 'committed' ? 'expanded' : 'collapsed'}
            initial={false}
            transition={transition}
            onAnimationComplete={() =>{  handleExpandComplete('committed'); }}
          >
            <FileTree
              files={committedFiles}
              selectedPaths={selectedSource === 'committed' ? selectedPaths : new Set()}
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
          <div
            className={styles.sectionHeader}
            role="button"
            onClick={() => {
              if (expandedSection === 'worktree') {
                onSelectAllWorktree();
              } else {
                toggleSection('worktree');
              }
            }}
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
          </div>
          <motion.div
            ref={worktreeBodyRef}
            className={styles.sectionBody}
            variants={sectionBodyVariants}
            animate={expandedSection === 'worktree' ? 'expanded' : 'collapsed'}
            initial={false}
            transition={transition}
            onAnimationComplete={() =>{  handleExpandComplete('worktree'); }}
          >
            <FileTree
              files={worktreeFiles}
              selectedPaths={selectedSource === 'worktree' ? selectedPaths : new Set()}
              expandedKeys={worktreeExpandedKeys}
              onSelectFile={onSelectWorktreeFile}
              onSelectDirectory={onSelectWorktreeDirectory}
              onExpandedKeysChange={onWorktreeExpandedKeysChange}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
};
