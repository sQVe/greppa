import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { useCallback, useMemo } from 'react';

import { DetailPanel } from './components/DetailPanel/DetailPanel';
import { StackedDiffViewer } from './components/StackedDiffViewer/StackedDiffViewer';
import { collectDirectoryIds } from './components/FileTree/FileTree';
import { FileTreePanel } from './components/FileTree/FileTreePanel';
import { Header } from './components/Header/Header';
import { StatusBar } from './components/StatusBar/StatusBar';
import type { DiffFile, FileNode } from './fixtures/types';
import { comments, diffs, fileInfoMap, files as fixtureFiles } from './fixtures';
import { buildDiffFile } from './hooks/buildDiffFile';
import { useComputedDiffs } from './hooks/useComputedDiffs';
import { useDiffComputation } from './hooks/useDiffComputation';
import { useDiffContent } from './hooks/useDiffContent';
import { useFileList } from './hooks/useFileList';
import { useMultiSelect } from './hooks/useMultiSelect';
import { useRefs } from './hooks/useRefs';
import { useReviewState } from './hooks/useReviewState';
import { useWorktreeDiffContent } from './hooks/useWorktreeDiffContent';
import { useWorktreeFiles } from './hooks/useWorktreeFiles';
import type { FileSource } from './useFileSelection';
import { collectDescendantFilePaths, collectFiles, useFileSelection } from './useFileSelection';

import styles from './App.module.css';

const PANEL_IDS = ['file-tree', 'diff-viewer', 'detail-panel'];

const useTreeState = (files: FileNode[]) => {
  const { state: reviewState, set: setReviewState } = useReviewState('default');
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

  return { expandedKeys, handleExpandedKeysChange };
};

interface ComputedDiffInput {
  selectedFilePath: string | null;
  selectedSource: FileSource | null;
  oldRef: string;
  newRef: string;
  fixtureDiff: DiffFile | null;
}

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

const useFileSelectionHandlers = (
  files: FileNode[],
  worktreeFiles: FileNode[],
  multiSelect: ReturnType<typeof useMultiSelect>,
  selectCommittedFile: (path: string) => void,
  selectWorktreeFile: (path: string) => void,
) => {
  const committedFilePaths = useMemo(
    () => collectFiles(files).map((f) => f.path),
    [files],
  );
  const allCommittedFilePaths = useMemo(
    () => new Set(committedFilePaths),
    [committedFilePaths],
  );
  const worktreeFilePaths = useMemo(
    () => collectFiles(worktreeFiles).map((f) => f.path),
    [worktreeFiles],
  );
  const allWorktreeFilePaths = useMemo(
    () => new Set(worktreeFilePaths),
    [worktreeFilePaths],
  );

  const handleSelectAllCommitted = useCallback(() => {
    multiSelect.selectAll(committedFilePaths, 'committed');
  }, [committedFilePaths, multiSelect]);

  const handleSelectAllWorktree = useCallback(() => {
    multiSelect.selectAll(worktreeFilePaths, 'worktree');
  }, [worktreeFilePaths, multiSelect]);

  const handleSelectCommittedFile = useCallback(
    (path: string, shiftKey: boolean) => {
      const isFile = allCommittedFilePaths.has(path);
      if (isFile) {
        if (shiftKey) {
          multiSelect.toggle(path, 'committed');
        } else {
          multiSelect.select(path, 'committed');
          selectCommittedFile(path);
        }
      } else {
        const children = collectDescendantFilePaths(files, path);
        if (children.length > 0) {
          if (shiftKey) {
            multiSelect.toggleAll(children, 'committed');
          } else {
            multiSelect.selectAll(children, 'committed');
          }
        }
      }
    },
    [allCommittedFilePaths, files, multiSelect, selectCommittedFile],
  );

  const handleSelectWorktreeFile = useCallback(
    (path: string, shiftKey: boolean) => {
      const isFile = allWorktreeFilePaths.has(path);
      if (isFile) {
        if (shiftKey) {
          multiSelect.toggle(path, 'worktree');
        } else {
          multiSelect.select(path, 'worktree');
          selectWorktreeFile(path);
        }
      } else {
        const children = collectDescendantFilePaths(worktreeFiles, path);
        if (children.length > 0) {
          if (shiftKey) {
            multiSelect.toggleAll(children, 'worktree');
          } else {
            multiSelect.selectAll(children, 'worktree');
          }
        }
      }
    },
    [allWorktreeFilePaths, worktreeFiles, multiSelect, selectWorktreeFile],
  );

  return {
    committedFilePaths,
    worktreeFilePaths,
    handleSelectAllCommitted,
    handleSelectAllWorktree,
    handleSelectCommittedFile,
    handleSelectWorktreeFile,
  };
};

export const App = () => {
  const { oldRef, newRef, isLoading: refsLoading, isError: refsError } = useRefs();

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'gr-panels',
    panelIds: PANEL_IDS,
  });

  const { files: apiFiles, isError } = useFileList(oldRef ?? '', newRef ?? '');
  const files = isError || apiFiles == null ? fixtureFiles : apiFiles;

  const { files: worktreeFiles } = useWorktreeFiles();

  const { expandedKeys, handleExpandedKeysChange } = useTreeState(files);
  const {
    expandedKeys: worktreeExpandedKeys,
    handleExpandedKeysChange: handleWorktreeExpandedKeysChange,
  } = useTreeState(worktreeFiles ?? []);

  const {
    selectedFilePath,
    selectedSource,
    selectCommittedFile,
    selectWorktreeFile,
    reviewedCount,
    totalCount,
    selectedDiff: fixtureDiff,
    selectedThreads,
    selectedFileInfo,
  } = useFileSelection(files, worktreeFiles ?? [], diffs, comments, fileInfoMap);

  const multiSelect = useMultiSelect();

  const {
    committedFilePaths,
    worktreeFilePaths,
    handleSelectAllCommitted,
    handleSelectAllWorktree,
    handleSelectCommittedFile,
    handleSelectWorktreeFile,
  } = useFileSelectionHandlers(
    files,
    worktreeFiles ?? [],
    multiSelect,
    selectCommittedFile,
    selectWorktreeFile,
  );

  const selectedDiff = useComputedDiff({
    selectedFilePath,
    selectedSource,
    oldRef: oldRef ?? '',
    newRef: newRef ?? '',
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
    oldRef ?? '',
    newRef ?? '',
  );

  const selectedDiffs = useMemo(() => {
    if (multiSelect.isMultiSelect) {
      return multiDiffs;
    }
    return selectedDiff != null ? [selectedDiff] : [];
  }, [multiSelect.isMultiSelect, multiDiffs, selectedDiff]);

  if (refsLoading || refsError) {
    return <div className={styles.app} />;
  }

  return (
    <div className={styles.app}>
      <Header />
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
        >
          <FileTreePanel
            committedFiles={files}
            worktreeFiles={worktreeFiles ?? []}
            selectedPaths={multiSelect.selectedPaths}
            selectedSource={multiSelect.activeSource}
            committedExpandedKeys={expandedKeys}
            worktreeExpandedKeys={worktreeExpandedKeys}
            onSelectCommittedFile={handleSelectCommittedFile}
            onSelectWorktreeFile={handleSelectWorktreeFile}
            onSelectAllCommitted={handleSelectAllCommitted}
            onSelectAllWorktree={handleSelectAllWorktree}
            onCommittedExpandedKeysChange={handleExpandedKeysChange}
            onWorktreeExpandedKeysChange={handleWorktreeExpandedKeysChange}
          />
        </Panel>
        <Separator className={styles.separator} />
        <Panel id="diff-viewer" minSize={300}>
          <StackedDiffViewer diffs={selectedDiffs} />
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
      <StatusBar
        reviewedCount={reviewedCount}
        totalCount={totalCount}
        language={selectedFileInfo?.language}
        encoding={selectedFileInfo?.encoding}
      />
    </div>
  );
};
