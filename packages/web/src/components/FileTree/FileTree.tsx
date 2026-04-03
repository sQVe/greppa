import { Badge, FileIcon, Tree } from '@greppa/ui';
import type { ReactNode } from 'react';

import type { ChangeType, FileNode } from '../../fixtures/types';

import styles from './FileTree.module.css';

interface FileTreeProps {
  files: FileNode[];
  selectedPaths: Set<string>;
  expandedKeys: Iterable<string>;
  onSelectFile: (path: string, shiftKey: boolean) => void;
  onExpandedKeysChange: (keys: Set<string | number>) => void;
}

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
};

export const collectDirectoryIds = (nodes: FileNode[]): string[] =>
  nodes.flatMap((node) =>
    node.type === 'directory' ? [node.path, ...collectDirectoryIds(node.children ?? [])] : [],
  );

export const FileTree = ({
  files,
  selectedPaths,
  expandedKeys,
  onSelectFile,
  onExpandedKeysChange,
}: FileTreeProps) => {
  const renderItem = (node: FileNode): ReactNode => {
    const isDirectory = node.type === 'directory';
    const { changeType } = node;
    const label = node.displayName ?? node.name;

    return (
      <Tree.Item
        key={node.path}
        id={node.path}
        textValue={label}
        selected={selectedPaths.has(node.path)}
        onPointerDown={(event) => {
          onSelectFile(node.path, event.shiftKey);
        }}
      >
        <Tree.ItemContent>
          {({ isExpanded }) => (
            <>
              {isDirectory ? <Tree.Chevron /> : <Tree.Indent />}
              <FileIcon name={node.name} isDirectory={isDirectory} isExpanded={isExpanded} />
              <Tree.Label className={changeType != null ? styles[changeType] : undefined}>
                {label}
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

  return (
    <Tree.Root
      aria-label="File tree"
      selectionMode="multiple"
      selectedKeys={selectedPaths}
      expandedKeys={expandedKeys}
      onExpandedChange={onExpandedKeysChange}
    >
      <Tree.Collection items={files}>{renderItem}</Tree.Collection>
    </Tree.Root>
  );
};
