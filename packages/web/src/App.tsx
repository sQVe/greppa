import { useCallback, useState } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';

import { DetailPanel } from './components/DetailPanel';
import { DiffViewer } from './components/DiffViewer';
import { FileTree } from './components/FileTree';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { comments, diffs, fileInfoMap, files } from './fixtures';
import type { FileNode } from './fixtures/types';

import styles from './App.module.css';

const PANEL_IDS = ['file-tree', 'diff-viewer', 'detail-panel'];

const collectFiles = (nodes: FileNode[]): FileNode[] =>
  nodes.flatMap((node) => (node.type === 'file' ? [node] : collectFiles(node.children ?? [])));

const allFiles = collectFiles(files);
const initialReviewed = new Set(allFiles.filter((f) => f.status === 'reviewed').map((f) => f.path));

export const App = () => {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'gr-panels',
    panelIds: PANEL_IDS,
  });

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [reviewedPaths, setReviewedPaths] = useState(initialReviewed);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFilePath(path);
    setReviewedPaths((prev) => (prev.has(path) ? prev : new Set([...prev, path])));
  }, []);

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
          <FileTree
            files={files}
            selectedFilePath={selectedFilePath}
            onSelectFile={handleSelectFile}
          />
        </Panel>
        <Separator className={styles.separator} />
        <Panel id="diff-viewer" minSize={20}>
          <DiffViewer
            diff={selectedFilePath != null ? (diffs.get(selectedFilePath) ?? null) : null}
          />
        </Panel>
        <Separator className={styles.separator} />
        <Panel id="detail-panel" defaultSize="25%" minSize={15} collapsible>
          <DetailPanel
            threads={
              selectedFilePath != null
                ? comments.filter((t) => t.filePath === selectedFilePath)
                : []
            }
            fileInfo={selectedFilePath != null ? (fileInfoMap.get(selectedFilePath) ?? null) : null}
          />
        </Panel>
      </Group>
      <StatusBar reviewedCount={reviewedPaths.size} totalCount={allFiles.length} />
    </div>
  );
};
