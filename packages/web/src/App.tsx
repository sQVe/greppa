import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';

import { DetailPanel } from './components/DetailPanel/DetailPanel';
import { DiffViewer } from './components/DiffViewer/DiffViewer';
import { FileTree } from './components/FileTree/FileTree';
import { Header } from './components/Header/Header';
import { StatusBar } from './components/StatusBar/StatusBar';
import { comments, diffs, fileInfoMap, files } from './fixtures';
import { useFileSelection } from './useFileSelection';

import styles from './App.module.css';

const PANEL_IDS = ['file-tree', 'diff-viewer', 'detail-panel'];

export const App = () => {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'gr-panels',
    panelIds: PANEL_IDS,
  });

  const {
    selectedFilePath,
    selectFile,
    reviewedCount,
    totalCount,
    selectedDiff,
    selectedThreads,
    selectedFileInfo,
  } = useFileSelection(files, diffs, comments, fileInfoMap);

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
      <StatusBar reviewedCount={reviewedCount} totalCount={totalCount} />
    </div>
  );
};
