import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { useCallback, useMemo } from 'react';

import { DetailPanel } from './components/DetailPanel/DetailPanel';
import { DiffViewer } from './components/DiffViewer/DiffViewer';
import { collectDirectoryIds, FileTree } from './components/FileTree/FileTree';
import { Header } from './components/Header/Header';
import { StatusBar } from './components/StatusBar/StatusBar';
import type { FileNode } from './fixtures/types';
import { comments, diffs, fileInfoMap, files as fixtureFiles } from './fixtures';
import { buildDiffFile } from './hooks/buildDiffFile';
import { useDiffComputation } from './hooks/useDiffComputation';
import { useDiffContent } from './hooks/useDiffContent';
import { useFileList } from './hooks/useFileList';
import { useRefs } from './hooks/useRefs';
import { useReviewState } from './hooks/useReviewState';
import { useFileSelection } from './useFileSelection';

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

const useSelectedDiff = (
  files: FileNode[],
  selectedFilePath: string | null,
  oldRef: string | null,
  newRef: string | null,
) => {
  const { diff: apiDiff } = useDiffContent(oldRef ?? '', newRef ?? '', selectedFilePath);
  const { changes: computedChanges } = useDiffComputation(
    apiDiff?.path ?? null,
    apiDiff?.oldContent ?? null,
    apiDiff?.newContent ?? null,
  );
  const computedDiff = useMemo(() => {
    if (apiDiff == null || computedChanges == null) {
      return null;
    }

    return buildDiffFile({
      filePath: apiDiff.path,
      changeType: apiDiff.changeType,
      oldPath: apiDiff.oldPath ?? null,
      oldContent: apiDiff.oldContent,
      newContent: apiDiff.newContent,
      changes: computedChanges,
    });
  }, [apiDiff, computedChanges]);

  const {
    selectedDiff: fixtureDiff,
    selectedThreads,
    selectedFileInfo,
  } = useFileSelection(files, diffs, comments, fileInfoMap);

  return {
    selectedDiff: computedDiff ?? fixtureDiff,
    selectedThreads,
    selectedFileInfo,
  };
};

export const App = () => {
  const { oldRef, newRef, isLoading: refsLoading } = useRefs();

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'gr-panels',
    panelIds: PANEL_IDS,
  });

  const { files: apiFiles, isError } = useFileList(oldRef ?? '', newRef ?? '');
  const files = isError || apiFiles == null ? fixtureFiles : apiFiles;

  const { expandedKeys, handleExpandedKeysChange } = useTreeState(files);

  const {
    selectedFilePath,
    selectFile,
    reviewedCount,
    totalCount,
  } = useFileSelection(files, diffs, comments, fileInfoMap);

  const { selectedDiff, selectedThreads, selectedFileInfo } = useSelectedDiff(files, selectedFilePath, oldRef, newRef);

  if (refsLoading) {
    return <div className={styles.app} />;
  }

  return (
    <div className={styles.app}>
      <Header
        filePath={selectedDiff?.path}
        oldPath={selectedDiff?.oldPath}
        changeType={selectedDiff?.changeType}
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
          minSize={160}
          maxSize="35%"
          collapsible
          groupResizeBehavior="preserve-pixel-size"
        >
          <FileTree
            files={files}
            selectedFilePath={selectedFilePath}
            expandedKeys={expandedKeys}
            onSelectFile={selectFile}
            onExpandedKeysChange={handleExpandedKeysChange}
          />
        </Panel>
        <Separator className={styles.separator} />
        <Panel id="diff-viewer" minSize={300}>
          <DiffViewer diff={selectedDiff} />
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
