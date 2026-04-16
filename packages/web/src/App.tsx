import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels';
import { useCallback, useMemo, useRef, useState } from 'react';

import { ActivityRail } from './components/ActivityRail/ActivityRail';
import { DetailPanel } from './components/DetailPanel/DetailPanel';
import { StackedDiffViewer } from './components/StackedDiffViewer/StackedDiffViewer';
import type { StackedDiffViewerHandle } from './components/StackedDiffViewer/StackedDiffViewer';
import { collectDirectoryIds } from './components/FileTree/FileTree';
import { FileTreePanel } from './components/FileTree/FileTreePanel';
import type { FileTreeSection } from './components/FileTree/FileTreePanel';
import { StatusBar } from './components/StatusBar/StatusBar';
import type { StatusBarProps } from './components/StatusBar/StatusBar';
import type { DiffFile, FileNode } from './fixtures/types';
import { comments, diffs, fileInfoMap } from './fixtures';
import { buildDiffFile } from './hooks/buildDiffFile';
import { useComputedDiffs } from './hooks/useComputedDiffs';
import { useDiffComputation } from './hooks/useDiffComputation';
import { useDiffContent } from './hooks/useDiffContent';
import { useFileList } from './hooks/useFileList';
import type { useMultiSelect } from './hooks/useMultiSelect';
import { useRefs } from './hooks/useRefs';
import { useReviewState } from './hooks/useReviewState';
import { useHashScroll } from './hooks/useHashScroll';
import { useSelectionCoordinator } from './hooks/useSelectionCoordinator';
import { useWarmup } from './hooks/useWarmup';
import { useWorktreeDiffContent } from './hooks/useWorktreeDiffContent';
import { useWorktreeFiles } from './hooks/useWorktreeFiles';
import { collectFiles, useFileSelection } from './useFileSelection';
import type { FileSource } from './useFileSelection';

import styles from './App.module.css';

interface ComputedDiffInput {
  selectedFilePath: string | null;
  selectedSource: FileSource | null;
  oldRef: string;
  newRef: string;
  fixtureDiff: DiffFile | null;
}

interface SelectedDiffsInput {
  selectedFilePath: string | null;
  selectedSource: FileSource | null;
  oldRef: string;
  newRef: string;
  fixtureDiff: DiffFile | null;
  multiSelect: ReturnType<typeof useMultiSelect>;
  committedFilePaths: string[];
  worktreeFilePaths: string[];
}

interface ActiveTreeStateInput {
  activeSource: FileSource | null;
  committedReviewedPaths: Set<string>;
  worktreeReviewedPaths: Set<string>;
  toggleCommittedReviewed: (path: string) => void;
  toggleWorktreeReviewed: (path: string) => void;
}

interface StatusBarPropsInput {
  activeSection: FileTreeSection;
  selectedCommitShas: Set<string>;
  commitDiffCount: number;
  worktreeFileCount: number;
  committedReviewedCount: number;
  committedFileCount: number;
}

const EMPTY_FILES: FileNode[] = [];
const EMPTY_PATHS = new Set<string>();
const PANEL_IDS = ['file-tree', 'diff-viewer', 'detail-panel'];

const useTreeState = (files: FileNode[], sessionId: string) => {
  const { state: reviewState, set: setReviewState } = useReviewState(sessionId);
  const allDirectoryIds = useMemo(() => collectDirectoryIds(files), [files]);
  const expandedKeys = useMemo(
    () => {
      const collapsed = new Set(reviewState.collapsedPaths);
      return new Set(allDirectoryIds.filter((id) => !collapsed.has(id)));
    },
    [allDirectoryIds, reviewState.collapsedPaths],
  );
  const handleExpandedKeysChange = useCallback(
    (keys: Set<string | number>) => {
      const collapsed = allDirectoryIds.filter((id) => !keys.has(id));
      setReviewState({ collapsedPaths: collapsed });
    },
    [allDirectoryIds, setReviewState],
  );

  const reviewedPaths = useMemo(
    () => new Set(reviewState.reviewedPaths),
    [reviewState.reviewedPaths],
  );

  const toggleReviewed = useCallback(
    (path: string) => {
      const current = reviewState.reviewedPaths;
      const next = current.includes(path)
        ? current.filter((p) => p !== path)
        : [...current, path];
      setReviewState({ reviewedPaths: next });
    },
    [reviewState.reviewedPaths, setReviewState],
  );

  return { expandedKeys, handleExpandedKeysChange, reviewedPaths, toggleReviewed };
};

const useComputedDiff = ({
  selectedFilePath,
  selectedSource,
  oldRef,
  newRef,
  fixtureDiff,
}: ComputedDiffInput) => {
  const committedPath = selectedSource === 'committed' ? selectedFilePath : null;
  const worktreePath = selectedSource === 'worktree' ? selectedFilePath : null;

  const { diff: committedDiff } = useDiffContent(oldRef, newRef, committedPath);
  const { diff: worktreeDiff } = useWorktreeDiffContent(worktreePath);

  const apiDiff = committedDiff ?? worktreeDiff;

  const { changes: computedChanges } = useDiffComputation(
    apiDiff?.path ?? null,
    apiDiff?.oldContent ?? null,
    apiDiff?.newContent ?? null,
  );

  return useMemo(() => {
    if (apiDiff == null || computedChanges == null) {
      return fixtureDiff;
    }

    return buildDiffFile({
      filePath: apiDiff.path,
      changeType: apiDiff.changeType,
      oldPath: apiDiff.oldPath ?? null,
      oldContent: apiDiff.oldContent,
      newContent: apiDiff.newContent,
      changes: computedChanges,
    });
  }, [apiDiff, computedChanges, fixtureDiff]);
};

const useSelectedDiffs = ({
  selectedFilePath,
  selectedSource,
  oldRef,
  newRef,
  fixtureDiff,
  multiSelect,
  committedFilePaths,
  worktreeFilePaths,
}: SelectedDiffsInput) => {
  const selectedDiff = useComputedDiff({
    selectedFilePath,
    selectedSource,
    oldRef,
    newRef,
    fixtureDiff,
  });

  const orderedFilePaths = multiSelect.activeSource === 'worktree' ? worktreeFilePaths : committedFilePaths;
  const multiDiffPaths = useMemo(
    () => (multiSelect.isMultiSelect ? orderedFilePaths.filter((p) => multiSelect.selectedPaths.has(p)) : []),
    [multiSelect.isMultiSelect, multiSelect.selectedPaths, orderedFilePaths],
  );
  const multiDiffs = useComputedDiffs(
    multiDiffPaths,
    multiSelect.activeSource,
    oldRef,
    newRef,
  );

  return useMemo(() => {
    if (multiSelect.isMultiSelect) {
      return multiDiffs.diffs;
    }
    return selectedDiff != null ? [selectedDiff] : [];
  }, [multiSelect.isMultiSelect, multiDiffs.diffs, selectedDiff]);
};

const resolveActiveSection = (pathname: string) => {
  if (pathname === '/commits') {
    return 'commits';
  }
  if (pathname === '/worktree') {
    return 'worktree';
  }
  return 'committed';
};

const useActiveTreeState = ({
  activeSource,
  committedReviewedPaths,
  worktreeReviewedPaths,
  toggleCommittedReviewed,
  toggleWorktreeReviewed,
}: ActiveTreeStateInput) => {
  const isWorktree = activeSource === 'worktree';
  return {
    activeReviewedPaths: isWorktree ? worktreeReviewedPaths : committedReviewedPaths,
    activeToggleReviewed: isWorktree ? toggleWorktreeReviewed : toggleCommittedReviewed,
  };
};

const useTreeSelection = (
  multiSelect: ReturnType<typeof useMultiSelect>,
  selectedFilePath: string | null,
  selectedSource: FileSource | null,
) => {
  const treeSelectedPaths = useMemo(() => {
    if (multiSelect.selectedPaths.size > 0) {
      return multiSelect.selectedPaths;
    }
    if (selectedFilePath != null && selectedSource != null) {
      return new Set([selectedFilePath]);
    }
    return EMPTY_PATHS;
  }, [multiSelect.selectedPaths, selectedFilePath, selectedSource]);

  const treeSelectedSource =
    multiSelect.selectedPaths.size > 0 ? multiSelect.activeSource : selectedSource;

  return { treeSelectedPaths, treeSelectedSource };
};

const useStatusBarProps = ({
  activeSection,
  selectedCommitShas,
  commitDiffCount,
  worktreeFileCount,
  committedReviewedCount,
  committedFileCount,
}: StatusBarPropsInput): StatusBarProps =>
  useMemo(() => {
    if (activeSection === 'commits') {
      return {
        mode: 'commit-review',
        commitSha: [...selectedCommitShas][0],
        reviewedCount: 0,
        totalCount: commitDiffCount,
      };
    }
    if (activeSection === 'worktree') {
      return { mode: 'working-tree', modifiedCount: worktreeFileCount };
    }
    return {
      mode: 'file-review',
      reviewedCount: committedReviewedCount,
      totalCount: committedFileCount,
    };
  }, [
    activeSection,
    selectedCommitShas,
    commitDiffCount,
    worktreeFileCount,
    committedReviewedCount,
    committedFileCount,
  ]);

export const App = () => {
  const { newRef, mergeBaseRef, isLoading: refsLoading, isError: refsError } = useRefs();
  const stackedDiffRef = useRef<StackedDiffViewerHandle>(null);
  const fileTreePanelRef = usePanelRef();
  const [isFileTreeExpanded, setIsFileTreeExpanded] = useState(true);
  const navigate = useNavigate();

  const pathname = useRouterState({ select: (s: { location: { pathname: string } }) => s.location.pathname });
  const activeSection = resolveActiveSection(pathname);

  const handleToggleSection = useCallback((section: FileTreeSection) => {
    const routes = { committed: '/changes', worktree: '/worktree', commits: '/commits' } as const;
    void navigate({ to: routes[section] });
  }, [navigate]);

  const handleToggleFileTree = useCallback(() => {
    const panel = fileTreePanelRef.current;
    if (panel == null) {
      return;
    }
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [fileTreePanelRef]);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'gr-panels',
    panelIds: PANEL_IDS,
  });

  const { files: apiFiles } = useFileList(mergeBaseRef ?? '', newRef ?? '');
  const files = apiFiles ?? EMPTY_FILES;

  useWarmup(mergeBaseRef ?? null, newRef ?? null, apiFiles);

  const { files: worktreeFiles } = useWorktreeFiles();

  const { expandedKeys, handleExpandedKeysChange, reviewedPaths, toggleReviewed } = useTreeState(files, 'committed');
  const {
    expandedKeys: worktreeExpandedKeys,
    handleExpandedKeysChange: handleWorktreeExpandedKeysChange,
    reviewedPaths: worktreeReviewedPaths,
    toggleReviewed: toggleWorktreeReviewed,
  } = useTreeState(worktreeFiles ?? EMPTY_FILES, 'worktree');

  const {
    selectedFilePath,
    selectedSource,
    selectedDiff: fixtureDiff,
    selectedThreads,
    selectedFileInfo,
  } = useFileSelection(files, worktreeFiles ?? EMPTY_FILES, diffs, comments, fileInfoMap);

  const {
    multiSelect,
    commits,
    commitSelection,
    commitDiffs,
    commitFileSelection,
    commitFileDiffs,
    committedFilePaths,
    worktreeFilePaths,
    handleSelectCommit,
    handleSelectCommittedFile,
    handleSelectWorktreeFile,
    handleSelectCommittedDirectory,
    handleSelectWorktreeDirectory,
  } = useSelectionCoordinator({
    files,
    worktreeFiles: worktreeFiles ?? EMPTY_FILES,
    oldRef: mergeBaseRef ?? '',
    newRef: newRef ?? '',
  });

  const fileDiffs = useSelectedDiffs({
    selectedFilePath,
    selectedSource,
    oldRef: mergeBaseRef ?? '',
    newRef: newRef ?? '',
    fixtureDiff,
    multiSelect,
    committedFilePaths,
    worktreeFilePaths,
  });

  const selectedDiffs = useMemo(
    () => {
      const base = commitSelection.isActive ? commitDiffs.diffs : fileDiffs;
      return commitFileDiffs.diffs.length > 0 ? [...base, ...commitFileDiffs.diffs] : base;
    },
    [commitSelection.isActive, commitDiffs.diffs, commitFileDiffs.diffs, fileDiffs],
  );

  const hash = useRouterState({ select: (s: { location: { hash: string } }) => s.location.hash });
  useHashScroll(stackedDiffRef, selectedDiffs, hash);

  const committedFileCount = committedFilePaths.length;
  const committedReviewedCount = useMemo(
    () => committedFilePaths.filter((p) => reviewedPaths.has(p)).length,
    [committedFilePaths, reviewedPaths],
  );
  const worktreeFileCount = useMemo(() => collectFiles(worktreeFiles ?? EMPTY_FILES).length, [worktreeFiles]);

  const { activeReviewedPaths, activeToggleReviewed } = useActiveTreeState({
    activeSource: multiSelect.activeSource,
    committedReviewedPaths: reviewedPaths,
    worktreeReviewedPaths,
    toggleCommittedReviewed: toggleReviewed,
    toggleWorktreeReviewed,
  });

  const { treeSelectedPaths, treeSelectedSource } = useTreeSelection(
    multiSelect,
    selectedFilePath,
    selectedSource,
  );

  const statusBarProps = useStatusBarProps({
    activeSection,
    selectedCommitShas: commitSelection.selectedShas,
    commitDiffCount: commitDiffs.diffs.length,
    worktreeFileCount,
    committedReviewedCount,
    committedFileCount,
  });

  if (refsLoading || refsError) {
    return <div className={styles.app} />;
  }

  return (
    <div className={styles.app}>
      <div className={styles.main}>
        <ActivityRail isFileTreeExpanded={isFileTreeExpanded} onToggleFileTree={handleToggleFileTree} />
        <Group
          id="gr-panels"
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
          className={styles.body}
        >
          <Panel
            id="file-tree"
            defaultSize={240}
            minSize={200}
            collapsible
            groupResizeBehavior="preserve-pixel-size"
            panelRef={fileTreePanelRef}
            onResize={() => {
              const panel = fileTreePanelRef.current;
              if (panel != null) {
                setIsFileTreeExpanded(!panel.isCollapsed());
              }
            }}
          >
            <FileTreePanel
              expandedSection={activeSection}
              committedFiles={files}
              worktreeFiles={worktreeFiles ?? EMPTY_FILES}
              commits={commits}
              selectedPaths={treeSelectedPaths}
              selectedSource={treeSelectedSource}
              selectedCommitShas={commitSelection.selectedShas}
              committedExpandedKeys={expandedKeys}
              worktreeExpandedKeys={worktreeExpandedKeys}
              onToggleSection={handleToggleSection}
              onSelectCommittedFile={handleSelectCommittedFile}
              onSelectWorktreeFile={handleSelectWorktreeFile}
              onSelectCommittedDirectory={handleSelectCommittedDirectory}
              onSelectWorktreeDirectory={handleSelectWorktreeDirectory}
              onSelectCommit={handleSelectCommit}
              onSelectCommitFile={(sha, path) => { commitFileSelection.toggle(sha, path); }}
              onCommittedExpandedKeysChange={handleExpandedKeysChange}
              onWorktreeExpandedKeysChange={handleWorktreeExpandedKeysChange}
            />
          </Panel>
          <Separator className={styles.separator} />
          <Panel id="diff-viewer" minSize={300}>
            <StackedDiffViewer
              ref={stackedDiffRef}
              diffs={selectedDiffs}
              reviewedPaths={activeReviewedPaths}
              onToggleReviewed={activeToggleReviewed}
            />
          </Panel>
          <Separator className={styles.separator} />
          <Panel
            id="detail-panel"
            defaultSize={320}
            minSize={200}
            collapsible
            groupResizeBehavior="preserve-pixel-size"
          >
            <DetailPanel threads={selectedThreads} fileInfo={selectedFileInfo} />
          </Panel>
        </Group>
      </div>
      <StatusBar {...statusBarProps} />
    </div>
  );
};
