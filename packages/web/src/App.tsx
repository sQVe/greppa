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
import { comments, diffs, fileInfoMap } from './fixtures';
import type { ChangeType, DiffFile, FileNode } from './fixtures/types';
import { applyFilter } from './hooks/applyFilter';
import { buildDiffFile } from './hooks/buildDiffFile';
import { buildFilterPredicate } from './hooks/buildFilterPredicate';
import {
  collectChangeTypeCounts,
  collectExtensionCounts,
  collectStatusCounts,
} from './hooks/facetCounts';
import { useComputedDiffs } from './hooks/useComputedDiffs';
import { useDiffComputation } from './hooks/useDiffComputation';
import { useDiffContent } from './hooks/useDiffContent';
import { useFileFilter } from './hooks/useFileFilter';
import { useFileList } from './hooks/useFileList';
import { useHashScroll } from './hooks/useHashScroll';
import type { useMultiSelect } from './hooks/useMultiSelect';
import { useRefs } from './hooks/useRefs';
import { useReviewState } from './hooks/useReviewState';
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
  worktreeFileCount: number;
  committedReviewedCount: number;
  committedFileCount: number;
  committedVisible: { matched: number; total: number } | null;
  worktreeVisible: { matched: number; total: number } | null;
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
  worktreeFileCount,
  committedReviewedCount,
  committedFileCount,
  committedVisible,
  worktreeVisible,
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
    worktreeFileCount,
    committedReviewedCount,
    committedFileCount,
    committedVisible,
    worktreeVisible,
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

  const committedFilter = useFileFilter('committed');
  const { state: committedReviewState } = useReviewState('committed');
  const committedReviewedSet = useMemo(
    () => new Set(committedReviewState.reviewedPaths),
    [committedReviewState.reviewedPaths],
  );
  const committedPredicate = useMemo(
    () =>
      buildFilterPredicate(
        {
          query: committedFilter.query,
          extensions: committedFilter.extensions,
          changeTypes: committedFilter.changeTypes,
          statuses: committedFilter.statuses,
        },
        committedReviewedSet,
      ),
    [
      committedFilter.query,
      committedFilter.extensions,
      committedFilter.changeTypes,
      committedFilter.statuses,
      committedReviewedSet,
    ],
  );
  const filteredCommitted = useMemo(
    () => applyFilter(files, committedPredicate),
    [files, committedPredicate],
  );

  const worktreeFilter = useFileFilter('worktree');
  const { state: worktreeReviewState } = useReviewState('worktree');
  const worktreeReviewedSet = useMemo(
    () => new Set(worktreeReviewState.reviewedPaths),
    [worktreeReviewState.reviewedPaths],
  );
  const worktreePredicate = useMemo(
    () =>
      buildFilterPredicate(
        {
          query: worktreeFilter.query,
          extensions: worktreeFilter.extensions,
          changeTypes: worktreeFilter.changeTypes,
          statuses: worktreeFilter.statuses,
        },
        worktreeReviewedSet,
      ),
    [
      worktreeFilter.query,
      worktreeFilter.extensions,
      worktreeFilter.changeTypes,
      worktreeFilter.statuses,
      worktreeReviewedSet,
    ],
  );
  const filteredWorktree = useMemo(
    () => applyFilter(worktreeFiles ?? EMPTY_FILES, worktreePredicate),
    [worktreeFiles, worktreePredicate],
  );

  const extensionRows = useMemo(() => collectExtensionCounts(files), [files]);
  const changeTypeRows = useMemo(() => {
    const counts = collectChangeTypeCounts(files);
    return (['added', 'modified', 'deleted', 'renamed'] as ChangeType[]).map((type) => ({
      type,
      count: counts[type],
    }));
  }, [files]);
  const statusRows = useMemo(() => {
    const counts = collectStatusCounts(files, committedReviewedSet);
    return [
      { status: 'reviewed' as const, count: counts.reviewed },
      { status: 'unreviewed' as const, count: counts.unreviewed },
    ];
  }, [files, committedReviewedSet]);

  const selectedExtensionsSet = useMemo(
    () => new Set(committedFilter.extensions),
    [committedFilter.extensions],
  );
  const selectedChangeTypesSet = useMemo(
    () => new Set(committedFilter.changeTypes),
    [committedFilter.changeTypes],
  );
  const selectedStatusesSet = useMemo(
    () => new Set(committedFilter.statuses),
    [committedFilter.statuses],
  );

  const toggleExtension = useCallback(
    (extension: string) => {
      const next = selectedExtensionsSet.has(extension)
        ? committedFilter.extensions.filter((e) => e !== extension)
        : [...committedFilter.extensions, extension];
      committedFilter.setExtensions(next);
    },
    [selectedExtensionsSet, committedFilter],
  );
  const toggleChangeType = useCallback(
    (type: ChangeType) => {
      const next = selectedChangeTypesSet.has(type)
        ? committedFilter.changeTypes.filter((t) => t !== type)
        : [...committedFilter.changeTypes, type];
      committedFilter.setChangeTypes(next);
    },
    [selectedChangeTypesSet, committedFilter],
  );
  const toggleStatus = useCallback(
    (status: 'reviewed' | 'unreviewed') => {
      const next = selectedStatusesSet.has(status)
        ? committedFilter.statuses.filter((s) => s !== status)
        : [...committedFilter.statuses, status];
      committedFilter.setStatuses(next);
    },
    [selectedStatusesSet, committedFilter],
  );

  const worktreeFilesSafe = worktreeFiles ?? EMPTY_FILES;
  const worktreeExtensionRows = useMemo(
    () => collectExtensionCounts(worktreeFilesSafe),
    [worktreeFilesSafe],
  );
  const worktreeChangeTypeRows = useMemo(() => {
    const counts = collectChangeTypeCounts(worktreeFilesSafe);
    return (['added', 'modified', 'deleted', 'renamed'] as ChangeType[]).map((type) => ({
      type,
      count: counts[type],
    }));
  }, [worktreeFilesSafe]);
  const worktreeStatusRows = useMemo(() => {
    const counts = collectStatusCounts(worktreeFilesSafe, worktreeReviewedSet);
    return [
      { status: 'reviewed' as const, count: counts.reviewed },
      { status: 'unreviewed' as const, count: counts.unreviewed },
    ];
  }, [worktreeFilesSafe, worktreeReviewedSet]);

  const worktreeSelectedExtensionsSet = useMemo(
    () => new Set(worktreeFilter.extensions),
    [worktreeFilter.extensions],
  );
  const worktreeSelectedChangeTypesSet = useMemo(
    () => new Set(worktreeFilter.changeTypes),
    [worktreeFilter.changeTypes],
  );
  const worktreeSelectedStatusesSet = useMemo(
    () => new Set(worktreeFilter.statuses),
    [worktreeFilter.statuses],
  );

  const toggleWorktreeExtension = useCallback(
    (extension: string) => {
      const next = worktreeSelectedExtensionsSet.has(extension)
        ? worktreeFilter.extensions.filter((e) => e !== extension)
        : [...worktreeFilter.extensions, extension];
      worktreeFilter.setExtensions(next);
    },
    [worktreeSelectedExtensionsSet, worktreeFilter],
  );
  const toggleWorktreeChangeType = useCallback(
    (type: ChangeType) => {
      const next = worktreeSelectedChangeTypesSet.has(type)
        ? worktreeFilter.changeTypes.filter((t) => t !== type)
        : [...worktreeFilter.changeTypes, type];
      worktreeFilter.setChangeTypes(next);
    },
    [worktreeSelectedChangeTypesSet, worktreeFilter],
  );
  const toggleWorktreeStatus = useCallback(
    (status: 'reviewed' | 'unreviewed') => {
      const next = worktreeSelectedStatusesSet.has(status)
        ? worktreeFilter.statuses.filter((s) => s !== status)
        : [...worktreeFilter.statuses, status];
      worktreeFilter.setStatuses(next);
    },
    [worktreeSelectedStatusesSet, worktreeFilter],
  );

  const {
    expandedKeys,
    handleExpandedKeysChange,
    reviewedPaths,
    toggleReviewed,
    reviewedCommitFiles,
    toggleReviewedCommitFile,
  } = useTreeState(files, 'committed', filteredCommitted.autoExpand);
  const {
    expandedKeys: worktreeExpandedKeys,
    handleExpandedKeysChange: handleWorktreeExpandedKeysChange,
    reviewedPaths: worktreeReviewedPaths,
    toggleReviewed: toggleWorktreeReviewed,
  } = useTreeState(worktreeFiles ?? EMPTY_FILES, 'worktree', filteredWorktree.autoExpand);

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
    isCommits: selectedCommitFileKeys.size > 0,
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
      activeSection === 'committed' && committedFilter.isActive
        ? { matched: filteredCommitted.visibleCount, total: filteredCommitted.totalCount }
        : null,
    [
      activeSection,
      committedFilter.isActive,
      filteredCommitted.visibleCount,
      filteredCommitted.totalCount,
    ],
  );
  const worktreeVisible = useMemo(
    () =>
      activeSection === 'worktree' && worktreeFilter.isActive
        ? { matched: filteredWorktree.visibleCount, total: filteredWorktree.totalCount }
        : null,
    [
      activeSection,
      worktreeFilter.isActive,
      filteredWorktree.visibleCount,
      filteredWorktree.totalCount,
    ],
  );

  const statusBarProps = useStatusBarProps({
    activeSection,
    selectedCommitShas: commitSelection.selectedShas,
    commitDiffCount:
      selectedCommitFileKeys.size > 0 ? commitFileDiffs.diffs.length : commitDiffs.diffs.length,
    worktreeFileCount,
    committedReviewedCount,
    committedFileCount,
    committedVisible,
    worktreeVisible,
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
              committedFiles={filteredCommitted.files}
              worktreeFiles={filteredWorktree.files}
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
                query: committedFilter.query,
                isActive: committedFilter.isActive,
                setQuery: committedFilter.setQuery,
                reset: committedFilter.reset,
                visibleCount: filteredCommitted.visibleCount,
                totalCount: filteredCommitted.totalCount,
                extensions: extensionRows,
                changeTypes: changeTypeRows,
                statuses: statusRows,
                selectedExtensions: selectedExtensionsSet,
                selectedChangeTypes: selectedChangeTypesSet,
                selectedStatuses: selectedStatusesSet,
                onToggleExtension: toggleExtension,
                onToggleChangeType: toggleChangeType,
                onToggleStatus: toggleStatus,
              }}
              worktreeFilter={{
                query: worktreeFilter.query,
                isActive: worktreeFilter.isActive,
                setQuery: worktreeFilter.setQuery,
                reset: worktreeFilter.reset,
                visibleCount: filteredWorktree.visibleCount,
                totalCount: filteredWorktree.totalCount,
                extensions: worktreeExtensionRows,
                changeTypes: worktreeChangeTypeRows,
                statuses: worktreeStatusRows,
                selectedExtensions: worktreeSelectedExtensionsSet,
                selectedChangeTypes: worktreeSelectedChangeTypesSet,
                selectedStatuses: worktreeSelectedStatusesSet,
                onToggleExtension: toggleWorktreeExtension,
                onToggleChangeType: toggleWorktreeChangeType,
                onToggleStatus: toggleWorktreeStatus,
              }}
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
