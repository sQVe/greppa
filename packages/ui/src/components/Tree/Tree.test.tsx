// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Tree } from './Tree';

const renderTree = (rootProps?: Partial<Parameters<typeof Tree.Root>[0]>) =>
  render(
    <Tree.Root aria-label="Files" {...rootProps}>
      <Tree.Collection items={[{ id: '1', name: 'file.ts' }]}>
        {(item) => (
          <Tree.Item key={item.id} id={item.id} textValue={item.name}>
            <Tree.ItemContent>
              <Tree.Chevron />
              <Tree.Label>{item.name}</Tree.Label>
            </Tree.ItemContent>
          </Tree.Item>
        )}
      </Tree.Collection>
    </Tree.Root>,
  );

afterEach(() => {
  cleanup();
});

describe('Tree', () => {
  it('renders a treegrid with aria label', () => {
    renderTree();
    expect(screen.getByRole('treegrid', { name: 'Files' })).toBeDefined();
  });

  it('applies internal styles to Root', () => {
    renderTree();
    expect(screen.getByRole('treegrid').className).toContain('root');
  });

  it('applies internal styles to Item', () => {
    renderTree();
    const row = screen.getByRole('row');
    expect(row.className).toContain('item');
  });

  it('renders Chevron with default character', () => {
    renderTree();
    expect(screen.getByText('▸')).toBeDefined();
  });

  it('applies internal styles to Label', () => {
    renderTree();
    expect(screen.getByText('file.ts').className).toContain('label');
  });

  it('merges consumer className on Root', () => {
    renderTree({ className: 'custom-tree' });
    const tree = screen.getByRole('treegrid');
    expect(tree.className).toContain('root');
    expect(tree.className).toContain('custom-tree');
  });

  it('renders Indent as a span with indent style', () => {
    render(
      <Tree.Root aria-label="Files">
        <Tree.Collection items={[{ id: '1', name: 'file.ts' }]}>
          {(item) => (
            <Tree.Item key={item.id} id={item.id} textValue={item.name}>
              <Tree.ItemContent>
                <Tree.Indent />
                <Tree.Label>{item.name}</Tree.Label>
              </Tree.ItemContent>
            </Tree.Item>
          )}
        </Tree.Collection>
      </Tree.Root>,
    );

    const row = screen.getByRole('row');
    const indent = row.querySelector('span');
    expect(indent).not.toBeNull();
    expect(indent!.className).toContain('indent');
  });

  it('renders nested items within a directory', () => {
    render(
      <Tree.Root aria-label="Files" defaultExpandedKeys={['src']}>
        <Tree.Collection items={[{ id: 'src', name: 'src' }]}>
          {(dir) => (
            <Tree.Item key={dir.id} id={dir.id} textValue={dir.name}>
              <Tree.ItemContent>
                <Tree.Chevron />
                <Tree.Label>{dir.name}</Tree.Label>
              </Tree.ItemContent>
              <Tree.Collection items={[{ id: 'src/index.ts', name: 'index.ts' }]}>
                {(file) => (
                  <Tree.Item key={file.id} id={file.id} textValue={file.name}>
                    <Tree.ItemContent>
                      <Tree.Label>{file.name}</Tree.Label>
                    </Tree.ItemContent>
                  </Tree.Item>
                )}
              </Tree.Collection>
            </Tree.Item>
          )}
        </Tree.Collection>
      </Tree.Root>,
    );

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('src')).toBeDefined();
    expect(screen.getByText('index.ts')).toBeDefined();
  });
});
