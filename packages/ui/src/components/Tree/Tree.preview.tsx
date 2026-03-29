import { Tree } from './Tree';

interface FileNode {
  id: string;
  name: string;
  children?: FileNode[];
}

const files: FileNode[] = [
  {
    id: 'src',
    name: 'src',
    children: [
      {
        id: 'src/components',
        name: 'components',
        children: [
          { id: 'src/components/Badge.tsx', name: 'Badge.tsx' },
          { id: 'src/components/Tabs.tsx', name: 'Tabs.tsx' },
        ],
      },
      { id: 'src/index.ts', name: 'index.ts' },
      { id: 'src/tokens.css', name: 'tokens.css' },
    ],
  },
  { id: 'package.json', name: 'package.json' },
  { id: 'tsconfig.json', name: 'tsconfig.json' },
];

const renderItem = (node: FileNode) => (
  <Tree.Item key={node.id} id={node.id} textValue={node.name}>
    <Tree.ItemContent>
      {node.children != null ? <Tree.Chevron /> : null}
      <Tree.Label>{node.name}</Tree.Label>
    </Tree.ItemContent>
    {node.children != null ? (
      <Tree.Collection items={node.children}>
        {renderItem}
      </Tree.Collection>
    ) : null}
  </Tree.Item>
);

const TreePreview = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
    <Tree.Root aria-label="Expanded tree" defaultExpandedKeys={['src', 'src/components']}>
      <Tree.Collection items={files}>{renderItem}</Tree.Collection>
    </Tree.Root>

    <hr style={{ border: 'none', borderTop: '1px solid var(--gr-color-border-muted)' }} />

    <Tree.Root aria-label="Collapsed tree">
      <Tree.Collection items={files}>{renderItem}</Tree.Collection>
    </Tree.Root>
  </div>
);

export default TreePreview;
