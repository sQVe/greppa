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
import { comments, diffs, fileInfoMap, files as fixtureFiles } from './fixtures';
import { buildDiffFile } from './hooks/buildDiffFile';
import { useComputedDiffs } from './hooks/useComputedDiffs';
import { useDiffComputation } from './hooks/useDiffComputation';
import { useDiffContent } from './hooks/useDiffContent';
import { useFileList } from './hooks/useFileList';
import type { useMultiSelect } from './hooks/useMultiSelect';
import { useRefs } from './hooks/useRefs';
import { useReviewState } from './hooks/useReviewState';
import { useSelectionCoordinator } from './hooks/useSelectionCoordinator';
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

// eslint-disable-next-line complexity -- pre-existing; extracting sub-hooks tracked separately
export const App = () => {
  const { newRef, mergeBaseRef, isLoading: refsLoading, isError: refsError } = useRefs();
  const stackedDiffRef = useRef<StackedDiffViewerHandle>(null);
  const fileTreePanelRef = usePanelRef();
  const [isFileTreeExpanded, setIsFileTreeExpanded] = useState(true);
  const [activeSection, setActiveSection] = useState<FileTreeSection>('committed');

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

  const { files: apiFiles, isError } = useFileList(mergeBaseRef ?? '', newRef ?? '');
  const files = isError || apiFiles == null ? fixtureFiles : apiFiles;

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
    selectCommittedFile,
    selectWorktreeFile,
    selectedDiff: fixtureDiff,
    selectedThreads,
    selectedFileInfo,
  } = useFileSelection(files, worktreeFiles ?? EMPTY_FILES, diffs, comments, fileInfoMap);

  const {
    multiSelect,
    commits,
    commitSelection,
    commitDiffs,
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
    selectCommittedFile,
    selectWorktreeFile,
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
    () => (commitSelection.isActive ? commitDiffs.diffs : fileDiffs),
    [commitSelection.isActive, commitDiffs.diffs, fileDiffs],
  );

  const committedFileCount = committedFilePaths.length;
  const committedReviewedCount = useMemo(
    () => committedFilePaths.filter((p) => reviewedPaths.has(p)).length,
    [committedFilePaths, reviewedPaths],
  );
  const worktreeFileCount = useMemo(() => collectFiles(worktreeFiles ?? EMPTY_FILES).length, [worktreeFiles]);

  const activeReviewedPaths = multiSelect.activeSource === 'worktree' ? worktreeReviewedPaths : reviewedPaths;

  const activeToggleReviewed = multiSelect.activeSource === 'worktree' ? toggleWorktreeReviewed : toggleReviewed;

  const treeSelectedPaths = useMemo(() => {
    if (multiSelect.selectedPaths.size > 0) {
      return multiSelect.selectedPaths;
    }
    if (selectedFilePath != null && selectedSource != null) {
      return new Set([selectedFilePath]);
    }
    return EMPTY_PATHS;
  }, [multiSelect.selectedPaths, selectedFilePath, selectedSource]);

  const treeSelectedSource = multiSelect.selectedPaths.size > 0
    ? multiSelect.activeSource
    : selectedSource;

  const statusBarProps: StatusBarProps = useMemo(() => {
    if (activeSection === 'commits') {
      return {
        mode: 'commit-review',
        commitSha: [...commitSelection.selectedShas][0],
        reviewedCount: 0,
        totalCount: commitDiffs.diffs.length,
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
  }, [activeSection, commitSelection.selectedShas, commitDiffs.diffs.length, worktreeFileCount, committedReviewedCount, committedFileCount]);

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
            minSize={160}
            maxSize="35%"
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
              committedFiles={files}
              worktreeFiles={worktreeFiles ?? EMPTY_FILES}
              commits={commits}
              selectedPaths={treeSelectedPaths}
              selectedSource={treeSelectedSource}
              selectedCommitShas={commitSelection.selectedShas}
              committedExpandedKeys={expandedKeys}
              worktreeExpandedKeys={worktreeExpandedKeys}
              onSelectCommittedFile={handleSelectCommittedFile}
              onSelectWorktreeFile={handleSelectWorktreeFile}
              onSelectCommittedDirectory={handleSelectCommittedDirectory}
              onSelectWorktreeDirectory={handleSelectWorktreeDirectory}
              onSelectCommit={handleSelectCommit}
              onCommittedExpandedKeysChange={handleExpandedKeysChange}
              onWorktreeExpandedKeysChange={handleWorktreeExpandedKeysChange}
              onSectionChange={setActiveSection}
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
            maxSize="35%"
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
