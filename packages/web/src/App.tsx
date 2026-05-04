import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels';

import { ActivityRail } from './components/ActivityRail/ActivityRail';
import { DetailPanel } from './components/DetailPanel/DetailPanel';
import { FileTreePanel } from './components/FileTree/FileTreePanel';
import type { FileTreeSection } from './components/FileTree/FileTreePanel';
import { StackedDiffViewer } from './components/StackedDiffViewer/StackedDiffViewer';
import type { StackedDiffViewerHandle } from './components/StackedDiffViewer/StackedDiffViewer';
import { StatusBar } from './components/StatusBar/StatusBar';
import type { StatusBarProps } from './components/StatusBar/StatusBar';
import { encodeCommitFileKey } from './commitFileKey';
import { comments, diffs, fileInfoMap } from './fixtures';
import type { DiffFile, FileNode } from './fixtures/types';
import { buildDiffFile } from './hooks/buildDiffFile';
import { computeCommitVisibility } from './hooks/commitFileVisibility';
import { useComputedDiffs } from './hooks/useComputedDiffs';
import { useDiffComputation } from './hooks/useDiffComputation';
import { useDiffContent } from './hooks/useDiffContent';
import { useFileList } from './hooks/useFileList';
import { useHashScroll } from './hooks/useHashScroll';
import type { useMultiSelect } from './hooks/useMultiSelect';
import { useRefs } from './hooks/useRefs';
import { useReviewState } from './hooks/useReviewState';
import { useSectionFilter } from './hooks/useSectionFilter';
import { useSelectionCoordinator } from './hooks/useSelectionCoordinator';
import { useTreeState } from './hooks/useTreeState';
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
  isCommits: boolean;
  committedReviewedPaths: Set<string>;
  worktreeReviewedPaths: Set<string>;
  reviewedCommitFiles: Set<string>;
  toggleCommittedReviewed: (path: string) => void;
  toggleWorktreeReviewed: (path: string) => void;
  toggleReviewedCommitFile: (key: string) => void;
}

interface StatusBarPropsInput {
  activeSection: FileTreeSection;
  selectedCommitShas: Set<string>;
  commitDiffCount: number;
  commitReviewedCount: number;
  worktreeFileCount: number;
  committedReviewedCount: number;
  committedFileCount: number;
  committedVisible: { matched: number; total: number } | null;
  worktreeVisible: { matched: number; total: number } | null;
  commitsVisible: { matched: number; total: number } | null;
}

const EMPTY_FILES: FileNode[] = [];
const EMPTY_PATHS = new Set<string>();
const PANEL_IDS = ['file-tree', 'diff-viewer', 'detail-panel'];

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

  const orderedFilePaths =
    multiSelect.activeSource === 'worktree' ? worktreeFilePaths : committedFilePaths;
  const multiDiffPaths = useMemo(
    () =>
      multiSelect.isMultiSelect
        ? orderedFilePaths.filter((p) => multiSelect.selectedPaths.has(p))
        : [],
    [multiSelect.isMultiSelect, multiSelect.selectedPaths, orderedFilePaths],
  );
  const multiDiffs = useComputedDiffs(multiDiffPaths, multiSelect.activeSource, oldRef, newRef);

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
  isCommits,
  committedReviewedPaths,
  worktreeReviewedPaths,
  reviewedCommitFiles,
  toggleCommittedReviewed,
  toggleWorktreeReviewed,
  toggleReviewedCommitFile,
}: ActiveTreeStateInput) => {
  if (isCommits) {
    return {
      activeReviewedPaths: reviewedCommitFiles,
      activeToggleReviewed: toggleReviewedCommitFile,
    };
  }
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
  commitReviewedCount,
  worktreeFileCount,
  committedReviewedCount,
  committedFileCount,
  committedVisible,
  worktreeVisible,
  commitsVisible,
}: StatusBarPropsInput): StatusBarProps =>
  useMemo(() => {
    if (activeSection === 'commits') {
      return {
        mode: 'commit-review',
        commitSha: [...selectedCommitShas][0],
        reviewedCount: commitReviewedCount,
        totalCount: commitDiffCount,
        ...(commitsVisible != null ? { visible: commitsVisible } : {}),
      };
    }
    if (activeSection === 'worktree') {
      return {
        mode: 'working-tree',
        modifiedCount: worktreeFileCount,
        ...(worktreeVisible != null ? { visible: worktreeVisible } : {}),
      };
    }
    return {
      mode: 'file-review',
      reviewedCount: committedReviewedCount,
      totalCount: committedFileCount,
      ...(committedVisible != null ? { visible: committedVisible } : {}),
    };
  }, [
    activeSection,
    selectedCommitShas,
    commitDiffCount,
    commitReviewedCount,
    worktreeFileCount,
    committedReviewedCount,
    committedFileCount,
    committedVisible,
    worktreeVisible,
    commitsVisible,
  ]);

export const App = () => {
  const { newRef, mergeBaseRef, isLoading: refsLoading, isError: refsError } = useRefs();
  const stackedDiffRef = useRef<StackedDiffViewerHandle>(null);
  const fileTreePanelRef = usePanelRef();
  const [isFileTreeExpanded, setIsFileTreeExpanded] = useState(true);
  const navigate = useNavigate();

  const pathname = useRouterState({
    select: (s: { location: { pathname: string } }) => s.location.pathname,
  });
  const activeSection = resolveActiveSection(pathname);

  const handleToggleSection = useCallback(
    (section: FileTreeSection) => {
      const routes = { committed: '/changes', worktree: '/worktree', commits: '/commits' } as const;
      void navigate({ to: routes[section] });
    },
    [navigate],
  );

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

  const { state: committedReviewState } = useReviewState('committed');
  const committedReviewedSet = useMemo(
    () => new Set(committedReviewState.reviewedPaths),
    [committedReviewState.reviewedPaths],
  );
  const committedSection = useSectionFilter('committed', files, committedReviewedSet);

  const { state: worktreeReviewState } = useReviewState('worktree');
  const worktreeReviewedSet = useMemo(
    () => new Set(worktreeReviewState.reviewedPaths),
    [worktreeReviewState.reviewedPaths],
  );
  const worktreeFilesSafe = worktreeFiles ?? EMPTY_FILES;
  const worktreeSection = useSectionFilter('worktree', worktreeFilesSafe, worktreeReviewedSet);

  const {
    expandedKeys,
    handleExpandedKeysChange,
    reviewedPaths,
    toggleReviewed,
    reviewedCommitFiles,
    toggleReviewedCommitFile,
  } = useTreeState(files, 'committed', committedSection.filtered.autoExpand);

  const fileLookupByPath = useMemo(() => {
    const map = new Map<string, FileNode>();
    for (const file of collectFiles(files)) {
      map.set(file.path, file);
    }
    return map;
  }, [files]);
  const {
    expandedKeys: worktreeExpandedKeys,
    handleExpandedKeysChange: handleWorktreeExpandedKeysChange,
    reviewedPaths: worktreeReviewedPaths,
    toggleReviewed: toggleWorktreeReviewed,
  } = useTreeState(worktreeFilesSafe, 'worktree', worktreeSection.filtered.autoExpand);

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
    commitFileDiffs,
    selectedCommitFileKeys,
    committedFilePaths,
    worktreeFilePaths,
    handleSelectCommit,
    handleSelectCommittedFile,
    handleSelectWorktreeFile,
    handleSelectCommittedDirectory,
    handleSelectWorktreeDirectory,
    handleSelectCommitFile,
    handleSelectAllFilesInCommit,
  } = useSelectionCoordinator({
    files,
    worktreeFiles: worktreeFiles ?? EMPTY_FILES,
    oldRef: mergeBaseRef ?? '',
    newRef: newRef ?? '',
  });

  const commitFiles = useMemo(() => {
    const result: FileNode[] = [];
    for (const commit of commits) {
      for (const path of commit.files) {
        const key = encodeCommitFileKey({ sha: commit.sha, path });
        const name = path.split('/').pop() ?? path;
        const existing = fileLookupByPath.get(path);
        const node: FileNode = {
          path: key,
          name,
          type: 'file',
          ...(existing?.changeType != null ? { changeType: existing.changeType } : {}),
        };
        result.push(node);
      }
    }
    return result;
  }, [commits, fileLookupByPath]);

  const commitsSection = useSectionFilter('commits', commitFiles, reviewedCommitFiles);

  const commitVisibility = useMemo(
    () =>
      computeCommitVisibility(
        commits,
        reviewedCommitFiles,
        {
          query: commitsSection.filter.query,
          extensions: commitsSection.filter.extensions,
          changeTypes: commitsSection.filter.changeTypes,
          statuses: commitsSection.filter.statuses,
        },
        fileLookupByPath,
      ),
    [
      commits,
      reviewedCommitFiles,
      commitsSection.filter.query,
      commitsSection.filter.extensions,
      commitsSection.filter.changeTypes,
      commitsSection.filter.statuses,
      fileLookupByPath,
    ],
  );

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

  const selectedDiffs = useMemo(() => {
    if (selectedCommitFileKeys.size > 0) {
      return commitFileDiffs.diffs;
    }
    return commitSelection.isActive ? commitDiffs.diffs : fileDiffs;
  }, [
    selectedCommitFileKeys,
    commitSelection.isActive,
    commitDiffs.diffs,
    commitFileDiffs.diffs,
    fileDiffs,
  ]);

  const hash = useRouterState({ select: (s: { location: { hash: string } }) => s.location.hash });
  useHashScroll(stackedDiffRef, selectedDiffs, hash);

  const committedFileCount = committedFilePaths.length;
  const committedReviewedCount = useMemo(
    () => committedFilePaths.filter((p) => reviewedPaths.has(p)).length,
    [committedFilePaths, reviewedPaths],
  );
  const worktreeFileCount = useMemo(
    () => collectFiles(worktreeFiles ?? EMPTY_FILES).length,
    [worktreeFiles],
  );

  const { activeReviewedPaths, activeToggleReviewed } = useActiveTreeState({
    activeSource: multiSelect.activeSource,
    isCommits:
      commitSelection.selectedShas.size === 1 || selectedCommitFileKeys.size > 0,
    committedReviewedPaths: reviewedPaths,
    worktreeReviewedPaths,
    reviewedCommitFiles,
    toggleCommittedReviewed: toggleReviewed,
    toggleWorktreeReviewed,
    toggleReviewedCommitFile,
  });

  const { treeSelectedPaths, treeSelectedSource } = useTreeSelection(
    multiSelect,
    selectedFilePath,
    selectedSource,
  );

  const committedVisible = useMemo(
    () =>
      activeSection === 'committed' && committedSection.filter.isActive
        ? {
            matched: committedSection.filtered.visibleCount,
            total: committedSection.filtered.totalCount,
          }
        : null,
    [
      activeSection,
      committedSection.filter.isActive,
      committedSection.filtered.visibleCount,
      committedSection.filtered.totalCount,
    ],
  );
  const worktreeVisible = useMemo(
    () =>
      activeSection === 'worktree' && worktreeSection.filter.isActive
        ? {
            matched: worktreeSection.filtered.visibleCount,
            total: worktreeSection.filtered.totalCount,
          }
        : null,
    [
      activeSection,
      worktreeSection.filter.isActive,
      worktreeSection.filtered.visibleCount,
      worktreeSection.filtered.totalCount,
    ],
  );
  const commitsVisible = useMemo(
    () =>
      activeSection === 'commits' && commitsSection.filter.isActive
        ? { matched: commitVisibility.totalVisible, total: commitVisibility.totalFiles }
        : null,
    [
      activeSection,
      commitsSection.filter.isActive,
      commitVisibility.totalVisible,
      commitVisibility.totalFiles,
    ],
  );

  const commitDisplayedDiffs =
    selectedCommitFileKeys.size > 0 ? commitFileDiffs.diffs : commitDiffs.diffs;
  const commitReviewedCount = useMemo(
    () =>
      commitDisplayedDiffs.filter(
        (d) =>
          d.sha != null
          && reviewedCommitFiles.has(encodeCommitFileKey({ sha: d.sha, path: d.path })),
      ).length,
    [commitDisplayedDiffs, reviewedCommitFiles],
  );

  const statusBarProps = useStatusBarProps({
    activeSection,
    selectedCommitShas: commitSelection.selectedShas,
    commitDiffCount: commitDisplayedDiffs.length,
    commitReviewedCount,
    worktreeFileCount,
    committedReviewedCount,
    committedFileCount,
    committedVisible,
    worktreeVisible,
    commitsVisible,
  });

  if (refsLoading || refsError) {
    return <div className={styles.app} />;
  }

  return (
    <div className={styles.app}>
      <div className={styles.main}>
        <ActivityRail
          isFileTreeExpanded={isFileTreeExpanded}
          onToggleFileTree={handleToggleFileTree}
        />
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
              committedFiles={committedSection.filtered.files}
              worktreeFiles={worktreeSection.filtered.files}
              commits={commits}
              selectedPaths={treeSelectedPaths}
              selectedSource={treeSelectedSource}
              selectedCommitShas={commitSelection.selectedShas}
              selectedCommitFiles={selectedCommitFileKeys}
              committedReviewedPaths={reviewedPaths}
              worktreeReviewedPaths={worktreeReviewedPaths}
              reviewedCommitFiles={reviewedCommitFiles}
              committedExpandedKeys={expandedKeys}
              worktreeExpandedKeys={worktreeExpandedKeys}
              committedFilter={{
                query: committedSection.filter.query,
                isActive: committedSection.filter.isActive,
                setQuery: committedSection.filter.setQuery,
                reset: committedSection.filter.reset,
                visibleCount: committedSection.filtered.visibleCount,
                totalCount: committedSection.filtered.totalCount,
                extensions: committedSection.rows.extensions,
                changeTypes: committedSection.rows.changeTypes,
                statuses: committedSection.rows.statuses,
                selectedExtensions: committedSection.selectedSets.extensions,
                selectedChangeTypes: committedSection.selectedSets.changeTypes,
                selectedStatuses: committedSection.selectedSets.statuses,
                onToggleExtension: committedSection.toggles.toggleExtension,
                onToggleChangeType: committedSection.toggles.toggleChangeType,
                onToggleStatus: committedSection.toggles.toggleStatus,
              }}
              worktreeFilter={{
                query: worktreeSection.filter.query,
                isActive: worktreeSection.filter.isActive,
                setQuery: worktreeSection.filter.setQuery,
                reset: worktreeSection.filter.reset,
                visibleCount: worktreeSection.filtered.visibleCount,
                totalCount: worktreeSection.filtered.totalCount,
                extensions: worktreeSection.rows.extensions,
                changeTypes: worktreeSection.rows.changeTypes,
                statuses: worktreeSection.rows.statuses,
                selectedExtensions: worktreeSection.selectedSets.extensions,
                selectedChangeTypes: worktreeSection.selectedSets.changeTypes,
                selectedStatuses: worktreeSection.selectedSets.statuses,
                onToggleExtension: worktreeSection.toggles.toggleExtension,
                onToggleChangeType: worktreeSection.toggles.toggleChangeType,
                onToggleStatus: worktreeSection.toggles.toggleStatus,
              }}
              commitsFilter={{
                query: commitsSection.filter.query,
                isActive: commitsSection.filter.isActive,
                setQuery: commitsSection.filter.setQuery,
                reset: commitsSection.filter.reset,
                visibleCount: commitVisibility.totalVisible,
                totalCount: commitVisibility.totalFiles,
                extensions: commitsSection.rows.extensions,
                changeTypes: commitsSection.rows.changeTypes,
                statuses: commitsSection.rows.statuses,
                selectedExtensions: commitsSection.selectedSets.extensions,
                selectedChangeTypes: commitsSection.selectedSets.changeTypes,
                selectedStatuses: commitsSection.selectedSets.statuses,
                onToggleExtension: commitsSection.toggles.toggleExtension,
                onToggleChangeType: commitsSection.toggles.toggleChangeType,
                onToggleStatus: commitsSection.toggles.toggleStatus,
              }}
              commitsVisibleFilesBySha={
                commitsSection.filter.isActive ? commitVisibility.visibleFilesBySha : undefined
              }
              onToggleSection={handleToggleSection}
              onSelectCommittedFile={handleSelectCommittedFile}
              onSelectWorktreeFile={handleSelectWorktreeFile}
              onSelectCommittedDirectory={handleSelectCommittedDirectory}
              onSelectWorktreeDirectory={handleSelectWorktreeDirectory}
              onSelectCommit={handleSelectCommit}
              onSelectCommitFile={handleSelectCommitFile}
              onSelectAllFilesInCommit={handleSelectAllFilesInCommit}
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
