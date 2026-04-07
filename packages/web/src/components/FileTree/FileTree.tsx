import { Badge, FileIcon, Tree } from '@greppa/ui';
import { useRef } from 'react';
import type { ReactNode } from 'react';

import type { ChangeType, FileNode } from '../../fixtures/types';

import styles from './FileTree.module.css';

const COLLAPSED_DIR: string = styles.collapsedDir ?? '';

interface FileTreeProps {
  files: FileNode[];
  selectedPaths: Set<string>;
  expandedKeys: Iterable<string>;
  onSelectFile: (path: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => void;
  onSelectDirectory?: (path: string) => void;
  onExpandedKeysChange: (keys: Set<string | number>) => void;
  onCollapseDirectory?: (path: string) => void;
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
  onSelectDirectory,
  onExpandedKeysChange,
  onCollapseDirectory,
}: FileTreeProps) => {
  const expandedKeysRef = useRef(expandedKeys);
  expandedKeysRef.current = expandedKeys;

  const renderItem = (node: FileNode): ReactNode => {
    const isDirectory = node.type === 'directory';
    const { changeType } = node;
    const label = node.displayName ?? node.name;

    return (
      <Tree.Item
        key={node.path}
        id={node.path}
        textValue={label}
        className={(renderProps) => isDirectory && !renderProps.isExpanded ? COLLAPSED_DIR : ''}
        onPointerDown={(event) => {
          const metaKey = event.metaKey || event.ctrlKey;
          if (isDirectory) {
            if (metaKey) {
              const keys = new Set<string | number>(expandedKeysRef.current);
              if (keys.has(node.path)) {
                onSelectFile(node.path, { shiftKey: false, metaKey: true });
              } else {
                keys.add(node.path);
                onExpandedKeysChange(keys);
              }
            } else if (event.shiftKey) {
              onSelectDirectory?.(node.path);
            } else {
              const keys = new Set<string | number>(expandedKeysRef.current);
              if (keys.has(node.path)) {
                keys.delete(node.path);
                onCollapseDirectory?.(node.path);
              } else {
                keys.add(node.path);
              }
              onExpandedKeysChange(keys);
            }
            return;
          }
          onSelectFile(node.path, { shiftKey: event.shiftKey, metaKey });
        }}
      >
        <Tree.ItemContent>
          {({ isExpanded }) => (
            <>
              {isDirectory ? <Tree.Chevron /> : <Tree.Indent />}
              <FileIcon name={node.name} isDirectory={isDirectory} isExpanded={isExpanded} />
              <Tree.Label>{label}</Tree.Label>
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
      onSelectionChange={() => { /* managed via onPointerDown */ }}
    >
      <Tree.Collection items={files}>{renderItem}</Tree.Collection>
    </Tree.Root>
  );
};
