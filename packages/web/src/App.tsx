import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { useMemo } from 'react';

import { DetailPanel } from './components/DetailPanel/DetailPanel';
import { DiffViewer } from './components/DiffViewer/DiffViewer';
import { FileTree } from './components/FileTree/FileTree';
import { Header } from './components/Header/Header';
import { StatusBar } from './components/StatusBar/StatusBar';
import { comments, diffs, fileInfoMap, files as fixtureFiles } from './fixtures';
import { buildDiffFile } from './hooks/buildDiffFile';
import { useDiffComputation } from './hooks/useDiffComputation';
import { useDiffContent } from './hooks/useDiffContent';
import { useFileList } from './hooks/useFileList';
import { useFileSelection } from './useFileSelection';

import styles from './App.module.css';

const PANEL_IDS = ['file-tree', 'diff-viewer', 'detail-panel'];

export const App = () => {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'gr-panels',
    panelIds: PANEL_IDS,
  });

  const { files: apiFiles, isError } = useFileList('HEAD~1', 'HEAD');
  const files = isError || apiFiles == null ? fixtureFiles : apiFiles;

  const {
    selectedFilePath,
    selectFile,
    reviewedCount,
    totalCount,
    selectedDiff: fixtureDiff,
    selectedThreads,
    selectedFileInfo,
  } = useFileSelection(files, diffs, comments, fileInfoMap);

  const { diff: apiDiff } = useDiffContent('HEAD~1', 'HEAD', selectedFilePath);
  const { changes: computedChanges } = useDiffComputation(
    apiDiff?.path ?? null,
    apiDiff?.oldContent ?? null,
    apiDiff?.newContent ?? null,
  );
  const computedDiff = useMemo(
    () =>
      buildDiffFile({
        filePath: apiDiff?.path ?? null,
        changeType: apiDiff?.changeType ?? null,
        oldPath: apiDiff?.oldPath ?? null,
        oldContent: apiDiff?.oldContent ?? null,
        newContent: apiDiff?.newContent ?? null,
        changes: computedChanges,
      }),
    [apiDiff, computedChanges],
  );

  const selectedDiff = computedDiff ?? fixtureDiff;

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
        <Panel id="file-tree" defaultSize="20%" minSize={10} collapsible>
          <FileTree files={files} selectedFilePath={selectedFilePath} onSelectFile={selectFile} />
        </Panel>
        <Separator className={styles.separator} />
        <Panel id="diff-viewer" minSize={20}>
          <DiffViewer diff={selectedDiff} />
        </Panel>
        <Separator className={styles.separator} />
        <Panel id="detail-panel" defaultSize="25%" minSize={15} collapsible>
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
