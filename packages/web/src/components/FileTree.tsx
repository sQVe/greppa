import { Button, Collection, Tree, TreeItem, TreeItemContent } from 'react-aria-components';

import type { FileNode } from '../fixtures/types';

import styles from './FileTree.module.css';

const CHANGE_TYPE_LABELS: Record<string, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
};

interface FileTreeProps {
  files: FileNode[];
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
}

const collectDirectoryIds = (nodes: FileNode[]): string[] =>
  nodes.flatMap((node) =>
    node.type === 'directory' ? [node.path, ...collectDirectoryIds(node.children ?? [])] : [],
  );

const renderItem = (node: FileNode) => {
  const isDirectory = node.type === 'directory';
  const badge = node.changeType != null ? CHANGE_TYPE_LABELS[node.changeType] : null;

  return (
    <TreeItem key={node.path} id={node.path} textValue={node.name} className={styles.treeItem}>
      <TreeItemContent>
        {isDirectory ? (
          <Button slot="chevron" className={styles.chevron}>
            ▸
          </Button>
        ) : null}
        <span className={styles.label}>{node.name}</span>
        {badge != null ? (
          <span className={`${styles.badge} ${styles[`badge${badge}`] ?? ''}`}>{badge}</span>
        ) : null}
      </TreeItemContent>
      {isDirectory ? <Collection items={node.children ?? []}>{renderItem}</Collection> : null}
    </TreeItem>
  );
};

export const FileTree = ({ files, selectedFilePath, onSelectFile }: FileTreeProps) => {
  const expandedKeys = collectDirectoryIds(files);

  return (
    <Tree
      aria-label="File tree"
      className={styles.tree}
      selectionMode="single"
      selectedKeys={selectedFilePath != null ? [selectedFilePath] : []}
      defaultExpandedKeys={expandedKeys}
      onSelectionChange={(keys) => {
        if (keys === 'all') {
          return;
        }
        const selected = [...keys][0];
        if (typeof selected === 'string') {
          onSelectFile(selected);
        }
      }}
    >
      <Collection items={files}>{renderItem}</Collection>
    </Tree>
  );
};
