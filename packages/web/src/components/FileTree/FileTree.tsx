import { Badge, FileIcon, Tree } from '@greppa/ui';

import type { ChangeType, FileNode } from '../../fixtures/types';

import styles from './FileTree.module.css';

interface FileTreeProps {
  files: FileNode[];
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
}

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
};

const collectDirectoryIds = (nodes: FileNode[]): string[] =>
  nodes.flatMap((node) =>
    node.type === 'directory' ? [node.path, ...collectDirectoryIds(node.children ?? [])] : [],
  );

const renderItem = (node: FileNode) => {
  const isDirectory = node.type === 'directory';
  const { changeType } = node;

  return (
    <Tree.Item key={node.path} id={node.path} textValue={node.name}>
      <Tree.ItemContent>
        {({ isExpanded }) => (
          <>
            {isDirectory ? <Tree.Chevron /> : <Tree.Indent />}
            <FileIcon name={node.name} isDirectory={isDirectory} isExpanded={isExpanded} />
            <Tree.Label className={changeType != null ? styles[changeType] : undefined}>
              {node.name}
            </Tree.Label>
            {changeType != null && !isDirectory ? (
              <Badge variant={changeType}>{CHANGE_TYPE_LABELS[changeType]}</Badge>
            ) : null}
          </>
        )}
      </Tree.ItemContent>
      {isDirectory ? (
        <Tree.Collection items={node.children ?? []}>{renderItem}</Tree.Collection>
      ) : null}
    </Tree.Item>
  );
};

export const FileTree = ({ files, selectedFilePath, onSelectFile }: FileTreeProps) => {
  const expandedKeys = collectDirectoryIds(files);

  return (
    <Tree.Root
      aria-label="File tree"
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
      <Tree.Collection items={files}>{renderItem}</Tree.Collection>
    </Tree.Root>
  );
};
